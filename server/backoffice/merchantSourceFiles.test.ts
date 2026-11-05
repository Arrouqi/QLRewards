import assert from "node:assert/strict";
import test from "node:test";
import type { Merchant } from "@shared/schema";
import type { MerchantQaDetails } from "@shared/merchantQaDetails";
import { mapMerchant } from "./mapMerchant";
import { createMerchantFilePreparer, isTrustedMerchantSourceFile, merchantQaFileIssues } from "./merchantSourceFiles";

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const pdf = Buffer.from("%PDF-1.7\nsynthetic");
const root = "https://qlrstoragedev.blob.core.windows.net/deals-clients/merchant-documents/123";
const source = mapMerchant({ logo: `${root}/logo.png`, coverImage: `${root}/cover.png`, crDocument: `${root}/cr.pdf` } as Merchant);
const details = {
  agencyLogoUri: source.assets.logo, coverPhoto: source.assets.coverImage, crUri: source.assets.crDocument,
  agencyName: "Retained brand",
} as MerchantQaDetails;

test("submitted merchant files are safely transferred and checkpointed without changing business details", async () => {
  const reads: string[] = []; const uploads: string[] = []; const checkpoints: MerchantQaDetails[] = [];
  const prepare = createMerchantFilePreparer(async (input, init) => {
    const url = String(input); reads.push(url);
    assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string, string>).Authorization, undefined);
    return new Response(url.endsWith(".pdf") ? pdf : png, { headers: { "content-type": url.endsWith(".pdf") ? "application/pdf" : "image/png" } });
  });
  assert.deepEqual(merchantQaFileIssues(source, details), []);
  assert.equal(reads.length, 0, "Read-only readiness never transfers files");
  const result = await prepare(source, details, async (kind, bytes, type) => {
    uploads.push(kind);
    assert.deepEqual(bytes, kind === "cr" ? pdf : png);
    assert.equal(type, kind === "cr" ? "application/pdf" : "image/png");
    return { kind: kind as "logo" | "cover" | "cr", reference: `qa/0/${kind}.${kind === "cr" ? "pdf" : "png"}` };
  }, async (value) => { checkpoints.push(structuredClone(value)); });
  assert.deepEqual(uploads, ["logo", "cover", "cr"]);
  assert.equal(reads.length, 3);
  assert.equal(checkpoints.length, 3);
  assert.equal(result.agencyName, details.agencyName);
  assert.equal(result.agencyLogoUri, "qa/0/logo.png");
  assert.equal(result.coverPhoto, "qa/0/cover.png");
  assert.equal(result.crUri, "qa/0/cr.pdf");
  assert.equal(details.agencyLogoUri, source.assets.logo, "Source/draft not mutated");
});

test("manual QA keys are preserved and no source is fetched for already-transferred files", async () => {
  const saved = { ...details, agencyLogoUri: "qa/default/logo.png", coverPhoto: "qa/0/cover.png", crUri: "qa/0/cr.pdf" };
  const prepare = createMerchantFilePreparer(async () => { throw new Error("Must not fetch"); });
  const result = await prepare(source, saved, async () => { throw new Error("Must not upload"); }, async () => { throw new Error("Must not save"); });
  assert.deepEqual(result, saved);
});

test("untrusted or unrelated references reject the whole request before any downloads or uploads", async () => {
  const prepare = createMerchantFilePreparer(async () => { throw new Error("Must not fetch"); });
  for (const value of [
    "http://127.0.0.1/private", `${root}/different.png`, `${root}/logo.png?sig=secret`,
    `${root}/../logo.png`, `${root}/%2e%2e/logo.png`,
    source.assets.logo!.replace("https://", "https://user:password@"),
    source.assets.logo!.replace("merchant-documents", "merchant-deal-images"),
  ]) {
    assert.equal(merchantQaFileIssues(source, { ...details, agencyLogoUri: value }).length, 1);
    await assert.rejects(prepare(source, { ...details, agencyLogoUri: value },
      async () => { throw new Error("Must not upload"); }, async () => {}), /unsupported merchant asset/);
  }
  assert.equal(isTrustedMerchantSourceFile(`${root}/logo.png#fragment`), false);
});

test("completed transfers are retained and skipped on a partial failure retry", async () => {
  let saved = details; let failed = false; const uploaded: string[] = [];
  const prepare = createMerchantFilePreparer(async (url) => new Response(String(url).endsWith(".pdf") ? pdf : png,
    { headers: { "content-type": String(url).endsWith(".pdf") ? "application/pdf" : "image/png" } }));
  const upload = async (kind: string) => {
    uploaded.push(kind);
    if (kind === "cover" && !failed) { failed = true; throw new Error("private upstream failure"); }
    return { kind: kind as "logo" | "cover" | "cr", reference: `qa/0/${kind}.${kind === "cr" ? "pdf" : "png"}` };
  };
  const checkpoint = async (value: MerchantQaDetails) => { saved = value; };
  await assert.rejects(prepare(source, saved, upload, checkpoint), /Completed uploads were retained/);
  assert.equal(saved.agencyLogoUri, "qa/0/logo.png");
  assert.equal(saved.coverPhoto, source.assets.coverImage);
  const result = await prepare(source, saved, upload, checkpoint);
  assert.equal(result.coverPhoto, "qa/0/cover.png");
  assert.deepEqual(uploaded, ["logo", "cover", "cover", "cr"]);
});

test("MIME mismatch, non-images, large bodies, and source errors never produce a QA reference", async () => {
  for (const response of [
    () => new Response(png, { headers: { "content-type": "text/html" } }),
    () => new Response(pdf, { headers: { "content-type": "application/pdf" } }),
    () => new Response(png, { headers: { "content-type": "image/png", "content-length": String(6 * 1024 * 1024) } }),
    () => new Response(null, { status: 404 }),
  ]) {
    const prepare = createMerchantFilePreparer(async () => response());
    await assert.rejects(prepare(source, details, async () => { throw new Error("Must not upload"); },
      async () => { throw new Error("Must not save"); }), /could not all be transferred/);
  }
});
