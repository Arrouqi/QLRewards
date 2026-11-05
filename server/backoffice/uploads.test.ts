import assert from "node:assert/strict";
import test from "node:test";
import { createQaFileUploader } from "./uploads";
import { isMerchantAssetReference, isQaStorageKey, qaFileMaxBytes } from "@shared/qaFiles";
import { merchantQaDetailsSchema } from "@shared/merchantQaDetails";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const pdf = Buffer.from("%PDF-1.7\nsynthetic fixture");
const webp = Buffer.from("RIFF0000WEBPsynthetic");
const settings = { writesEnabled: () => true, fileId: () => "synthetic-unique-file" };

function fixture(patch: { signStatus?: number; putStatus?: number; target?: string; responsePath?: string; malformed?: boolean; oversized?: boolean; network?: boolean } = {}) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  let invalidations = 0;
  const upload = createQaFileUploader({ getToken: async () => "synthetic-token", invalidate: () => { invalidations++; } }, async (url, init) => {
    const parsed = new URL(String(url));
    calls.push({ url: parsed, init });
    if (patch.network) throw new Error("PRIVATE-FAILURE");
    if (init?.method === "GET") {
      if (patch.malformed) return new Response("not-json");
      if (patch.oversized) return new Response("x".repeat(65537));
      const path = parsed.searchParams.get("path");
      const container = parsed.searchParams.get("fileType") === "4" ? "license-files" : "logos";
      return Response.json([{
        path: patch.responsePath ?? path,
        signedUrl: patch.target ?? `https://qlsharedstorageqa.blob.core.windows.net/${container}/qa/${path}?sig=synthetic-signature`,
      }], { status: patch.signStatus ?? 200 });
    }
    return new Response(null, { status: patch.putStatus ?? 201 });
  }, settings);
  return { upload, calls, invalidations: () => invalidations };
}

test("confirmed signer query, Azure PUT and stable file keys are used for all three file kinds", async () => {
  for (const [kind, bytes, mime, prefix, fileType] of [
    ["logo", png, "image/png", "default", "2"],
    ["cover", webp, "image/webp", "0", "2"],
    ["cr", pdf, "application/pdf", "0", "4"],
  ] as const) {
    const f = fixture();
    const result = await f.upload(kind, bytes, mime);
    assert.equal(f.calls.length, 2);
    const [signed, put] = f.calls;
    assert.equal(signed.url.origin, "https://ql-shared-qa.qatarliving.com");
    assert.equal(signed.url.pathname, "/generateSignedURL");
    assert.equal(signed.url.searchParams.get("fileType"), fileType);
    assert.equal(signed.url.searchParams.get("mimeType"), "");
    assert.match(signed.url.searchParams.get("path")!, new RegExp(`^${prefix}/`));
    assert.equal((signed.init?.headers as Record<string, string>).platform, "0");
    assert.equal(put.url.origin, "https://qlsharedstorageqa.blob.core.windows.net");
    assert.equal(put.init?.method, "PUT");
    assert.equal(put.init?.redirect, "error");
    const headers = put.init?.headers as Record<string, string>;
    assert.equal(headers["Content-Type"], mime);
    assert.equal(headers["x-ms-blob-type"], "BlockBlob");
    assert.equal(headers.Authorization, undefined);
    assert.deepEqual(Buffer.from(put.init!.body as Uint8Array), bytes);
    assert.equal(result.reference, `qa/${signed.url.searchParams.get("path")}`);
    assert.equal(isQaStorageKey(result.reference), true);
    assert.doesNotMatch(JSON.stringify(result), /sig=|synthetic-token/);
  }
});

test("invalid kind, format, content-type and sizes fail before authentication or HTTP", async () => {
  let calls = 0;
  const upload = createQaFileUploader({ getToken: async () => { calls++; return "synthetic"; }, invalidate: () => {} },
    async () => { throw new Error("Must not fetch"); }, settings);
  for (const [kind, bytes, type] of [
    ["unknown", png, "image/png"], ["logo", Buffer.alloc(0), "image/png"],
    ["cover", pdf, "application/pdf"], ["logo", Buffer.from("<svg>bad</svg>"), "image/svg+xml"],
    ["logo", png, "application/pdf"], ["cr", Buffer.from("not a pdf"), "application/pdf"],
    ["logo", Buffer.alloc(qaFileMaxBytes.logo + 1), "image/png"],
    ["cr", Buffer.alloc(qaFileMaxBytes.cr + 1), "application/pdf"],
  ] as const) await assert.rejects(upload(kind, bytes, type));
  assert.equal(calls, 0);
  const blocked = createQaFileUploader({ getToken: async () => { calls++; return "synthetic"; }, invalidate: () => {} },
    async () => { throw new Error("Must not fetch"); }, { ...settings, writesEnabled: () => false });
  await assert.rejects(blocked("logo", png, "image/png"), /QA writes enabled/);
  assert.equal(calls, 0);
});

test("signer cannot redirect uploads outside the exact QA container/path or forward credentials", async () => {
  for (const target of [
    "https://evil.invalid/logos/qa/default/synthetic-unique-file.png?sig=private",
    "http://qlsharedstorageqa.blob.core.windows.net/logos/qa/default/synthetic-unique-file.png?sig=private",
    "https://qlsharedstorageqa.blob.core.windows.net.evil.invalid/logos/qa/default/synthetic-unique-file.png?sig=private",
    "https://qlsharedstorageqa.blob.core.windows.net/other/qa/default/synthetic-unique-file.png?sig=private",
    "https://qlsharedstorageqa.blob.core.windows.net/logos/qa/default/wrong.png?sig=private",
    "https://account:private@qlsharedstorageqa.blob.core.windows.net/logos/qa/default/synthetic-unique-file.png?sig=private",
    "https://qlsharedstorageqa.blob.core.windows.net/logos/qa/default/synthetic-unique-file.png",
  ]) {
    const f = fixture({ target });
    await assert.rejects(f.upload("logo", png, "image/png"), (error: Error) => {
      assert.match(error.message, /could not be confirmed/);
      assert.doesNotMatch(error.message, /sig=|evil|private|synthetic-token/);
      return true;
    });
    assert.equal(f.calls.length, 1);
  }
  const mismatched = fixture({ responsePath: "default/other.png" });
  await assert.rejects(mismatched.upload("logo", png, "image/png"));
  assert.equal(mismatched.calls.length, 1);
});

test("upstream errors, malformed signing responses and network failures are sanitized with no replay", async () => {
  for (const patch of [
    { signStatus: 401 }, { signStatus: 500 }, { putStatus: 403 }, { putStatus: 500 },
    { malformed: true }, { oversized: true }, { network: true },
  ]) {
    const f = fixture(patch);
    await assert.rejects(f.upload("logo", png, "image/png"), /reference was not changed/);
    assert.equal(f.calls.length, patch.putStatus ? 2 : 1);
    if (patch.signStatus === 401) assert.equal(f.invalidations(), 1);
  }
});

test("QA storage keys pass asset validation without accepting traversal, signatures or executable schemes", () => {
  const schema = merchantQaDetailsSchema.shape.agencyLogoUri;
  for (const value of ["qa/default/file.png", "qa/0/file.webp", "qa/3973/file.pdf", "https://files.example.invalid/logo.png", "/uploads/file.pdf"]) {
    assert.equal(isMerchantAssetReference(value), true, value);
    assert.equal(schema.safeParse(value).success, true);
  }
  for (const value of [
    "qa/../file.png", "qa/default/../file.png", "qa/default/%2e%2e", "qa/default/a%2fb.png",
    "qa/default/file.png?sig=private", "qa/default/file.png#bad", "//evil.invalid/file",
    "https://files.example.invalid/file?sig=private", "javascript:alert(1)", "data:image/png;base64,AAA",
  ]) assert.equal(isMerchantAssetReference(value), false, value);
});
