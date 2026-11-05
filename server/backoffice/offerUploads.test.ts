import assert from "node:assert/strict";
import test from "node:test";
import { qaOfferImageMaxBytes } from "@shared/offerQaDetails";
import { createOfferImageUploader, createPublishedOfferImageSync } from "./offerUploads";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const settings = { writesEnabled: () => true, folderId: () => "00000000-0000-4000-8000-000000000001", fileId: () => "synthetic-file" };
function fixture(patch: { signStatus?: number; putStatus?: number; target?: string; path?: string; malformed?: boolean; oversized?: boolean; network?: boolean } = {}) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  let invalidations = 0;
  const upload = createOfferImageUploader({ getToken: async () => "synthetic-token", invalidate: () => { invalidations++; } }, async (url, init) => {
    const target = new URL(String(url)); calls.push({ url: target, init });
    if (patch.network) throw new Error("PRIVATE-NETWORK");
    if (init?.method === "GET") {
      if (patch.malformed) return new Response("PRIVATE-INVALID-JSON");
      if (patch.oversized) return new Response("x".repeat(65537));
      const path = target.searchParams.get("path");
      return Response.json([{ path: patch.path ?? path, signedUrl: patch.target
        ?? `https://qlrstorageqa.blob.core.windows.net/ad-images/qa/${path}?sig=synthetic-signature` }], { status: patch.signStatus ?? 200 });
    }
    return new Response(null, { status: patch.putStatus ?? 201 });
  }, settings);
  return { upload, calls, invalidations: () => invalidations };
}

test("offer signing and PUT use separate QA storage, bounded safe headers and only a stable key in the result", async () => {
  for (const [bytes, type] of [[png, "image/png"], [Buffer.from([255, 216, 255, 0]), "image/jpeg"], [Buffer.from("RIFF0000WEBPfixture"), "image/webp"]] as const) {
    const f = fixture();
    const result = await f.upload(bytes, type);
    assert.equal(f.calls.length, 2);
    const [sign, put] = f.calls;
    assert.equal(sign.url.origin, "https://qlr-bo-qa.qatarliving.com");
    assert.equal(sign.url.pathname, "/images/generateSignedURL");
    assert.deepEqual([...sign.url.searchParams.keys()], ["path"]);
    assert.equal(put.url.origin, "https://qlrstorageqa.blob.core.windows.net");
    assert.equal(put.url.pathname, `/ad-images/${result.reference}`);
    assert.equal(put.init?.redirect, "error");
    assert.equal(put.init?.method, "PUT");
    const headers = put.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers["x-ms-blob-type"], "BlockBlob");
    assert.equal(headers["Content-Type"], type);
    assert.deepEqual(Buffer.from(put.init!.body as Uint8Array), bytes);
    assert.doesNotMatch(JSON.stringify(result), /sig=|synthetic-token|https:/);
  }
});
test("images belonging to one offer use the same verified folder", async () => {
  const sharedFolder = "1881abce-5555-4ff4-8888-12a4b99620da";
  const f = fixture();
  // The default file name in this fixture is constant; production generates a
  // unique name per call. The important contract is the stable offer folder.
  const first = await f.upload(png, "image/png", sharedFolder);
  const second = await f.upload(png, "image/png", sharedFolder);
  assert.equal(first.reference.split("/")[1], sharedFolder);
  assert.equal(second.reference.split("/")[1], sharedFolder);
  assert.equal(f.calls.filter((call) => call.init?.method === "GET").length, 2);
  await assert.rejects(f.upload(png, "image/png", "../foreign"), /offer image folder/);
  assert.equal(f.calls.filter((call) => call.init?.method === "GET").length, 2);
});
test("published offer sync fills missing normalized paths without overwriting the cover", async () => {
  const calls: { url: URL; method: string; headers?: HeadersInit }[] = [];
  const first = "qa/00000000-0000-4000-8000-000000000001/first.png";
  const second = "qa/00000000-0000-4000-8000-000000000001/second.png";
  let copied = false;
  const sync = createPublishedOfferImageSync(
    { getToken: async () => "synthetic-token", invalidate() {} },
    async (input, init) => {
      const url = new URL(String(input)); const method = init?.method ?? "GET";
      calls.push({ url, method, headers: init?.headers });
      if (method === "HEAD" && url.pathname.endsWith("/first.png")) return new Response(null, { status: 200 });
      if (method === "HEAD" && url.pathname.endsWith("/second.png")) return new Response(null, { status: copied ? 200 : 404 });
      if (url.pathname === `/ad-images/${second}` && method === "GET")
        return new Response(png, { headers: { "content-type": "image/png", "content-length": String(png.length) } });
      if (url.pathname === "/images/generateSignedURL")
        return Response.json([{ path: "4062/second.png", signedUrl: "https://qlrstorageqa.blob.core.windows.net/ad-images/qa/4062/second.png?sig=synthetic" }]);
      if (method === "PUT") {
        assert.equal(url.origin, "https://qlrstorageqa.blob.core.windows.net");
        assert.equal(url.pathname, "/ad-images/qa/4062/second.png");
        assert.equal((init?.headers as Record<string, string>)["If-None-Match"], "*");
        assert.equal((init?.headers as Record<string, string>).Authorization, undefined);
        copied = true;
        return new Response(null, { status: 201 });
      }
      throw new Error("Unexpected request");
    },
  );
  await sync("4062", [first, second]);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
  assert.equal(calls.find((call) => call.url.pathname === "/images/generateSignedURL")?.url.searchParams.get("path"), "4062/second.png");
  await sync("4062", [first, second]);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 1, "Retry never overwrites a completed image");
  await assert.rejects(sync("../other", [first, second]), /Cannot verify/);
  await assert.rejects(sync("4062", [first, first]), /distinct filenames/);
});
test("invalid offer files and disabled QA uploads never request credentials or touch the network", async () => {
  let tokenCalls = 0;
  const token = { getToken: async () => { tokenCalls++; return "synthetic"; }, invalidate: () => {} };
  const upload = createOfferImageUploader(token, async () => { throw new Error("Must not fetch"); }, settings);
  for (const [file, type] of [
    [Buffer.alloc(0), "image/png"], [Buffer.from("%PDF-1.7"), "application/pdf"],
    [Buffer.from("<svg>bad</svg>"), "image/svg+xml"], [png, "text/html"], [Buffer.alloc(qaOfferImageMaxBytes + 1), "image/png"],
  ] as const) await assert.rejects(upload(file, type));
  const disabled = createOfferImageUploader(token, async () => { throw new Error("Must not fetch"); }, { ...settings, writesEnabled: () => false });
  await assert.rejects(disabled(png, "image/png"), /QA writes enabled/);
  assert.equal(tokenCalls, 0);
});
test("offer image signing cannot redirect data to another host, container, path or credential-bearing URL", async () => {
  const expected = `/ad-images/qa/${settings.folderId()}/synthetic-file.png`;
  for (const target of [
    `https://evil.invalid${expected}?sig=private`,
    `https://qlsharedstorageqa.blob.core.windows.net${expected}?sig=private`,
    `http://qlrstorageqa.blob.core.windows.net${expected}?sig=private`,
    `https://qlrstorageqa.blob.core.windows.net/logos/qa/${settings.folderId()}/synthetic-file.png?sig=private`,
    `https://qlrstorageqa.blob.core.windows.net${expected.replace("synthetic-file", "other-file")}?sig=private`,
    `https://private:private@qlrstorageqa.blob.core.windows.net${expected}?sig=private`,
    `https://qlrstorageqa.blob.core.windows.net${expected}`,
  ]) {
    const f = fixture({ target });
    await assert.rejects(f.upload(png, "image/png"), (e: Error) => {
      assert.match(e.message, /No image was added/); assert.doesNotMatch(e.message, /private|evil|sig=/); return true;
    });
    assert.equal(f.calls.length, 1);
  }
});
test("failed or ambiguous uploads never replay, leak signing responses or return a fabricated key", async () => {
  for (const patch of [
    { signStatus: 401 }, { signStatus: 500 }, { putStatus: 403 }, { putStatus: 500 },
    { path: "wrong-path" }, { malformed: true }, { oversized: true }, { network: true },
  ]) {
    const f = fixture(patch);
    await assert.rejects(f.upload(png, "image/png"), /could not be confirmed/);
    assert.equal(f.calls.length, patch.putStatus ? 2 : 1);
    if (patch.signStatus === 401) assert.equal(f.invalidations(), 1);
  }
});
