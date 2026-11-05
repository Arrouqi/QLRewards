import assert from "node:assert/strict";
import test from "node:test";
import { mapMerchant } from "./mapMerchant";
import { mapOffer } from "./mapOffer";
import { createBackofficeClient, BackofficeError, QA_API_ORIGIN, UNCERTAIN_RESULT_PREFIX, type BackofficeConfig } from "./client";
import type { Merchant, MerchantDeal } from "@shared/schema";
import type { BackofficeMappings, MerchantPayload, OfferPayload } from "./contracts";
import { syntheticImageKey, syntheticOfferDetails } from "./offerTestHelpers";
import type { OfferQaDetails } from "@shared/offerQaDetails";

// Synthetic examples only: no captured IDs, customer details, PINs or SAS URLs.
const merchant = mapMerchant({
  id: "local-merchant", companyType: "individual", companyName: "Synthetic QA Test",
  email: "qa@example.invalid", phone: "00000000", crNumber: "TEST0001",
} as Merchant);
const offer = mapOffer({
  id: "local-offer", merchantId: "local-merchant", title: "Synthetic Test Offer",
  description: "Synthetic fixture", dealType: "discount", category: "Test category", subCategory: "Test subcategory",
  claimRules: ["Show claim"], generalRules: ["Test term"], images: ["/test-image.webp"],
  branches: ["Synthetic branch"], startDate: "2026-10-21", endDate: "2026-12-31",
} as MerchantDeal);
const day = { closed: true, open: "", close: "" };
const merchantMapping: Partial<MerchantPayload> = {
  agencyName: "Synthetic QA Brand", agencyEmail: "qa@example.invalid",
  contactMobile: "00000000", contactWhatsapp: "00000000",
  agencyLogoUri: "https://files.example.invalid/logo.webp", coverPhoto: "https://files.example.invalid/cover.webp",
  aboutAgency: "A synthetic business description.", crNumber: "TEST0001", crUri: "https://files.example.invalid/cr.pdf",
  agencyId: 101, userEmail: "qa@example.invalid", categoryId: 201, isPriceList: false,
  workingHours: { saturday: day, sunday: day, monday: day, tuesday: day, wednesday: day, thursday: day, friday: day },
  branches: [{ name: "Synthetic branch", locationId: 301, locationUri: "", contactMobile: "00000000", pin: "", pinEnabled: false, qrEnabled: false }],
};
const offerMapping: Partial<OfferPayload> = {
  categoryIds: [201], subCategoryIds: [202], offerTypeId: 401, price: 10,
  redemptionType: 1, offerDuration: 30, branchIds: [501], claimRuleIds: [601],
  paymentConditionIds: [701], estimatedSavings: 5,
};
function setup(patch: Partial<BackofficeConfig> = {}, response = () => new Response(JSON.stringify({ merchantProfileId: 1001, merchantModerationProfileId: 9991, offerId: 2001, offerModerationId: 9992 }), { status: 201 })) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const config: BackofficeConfig = {
    dryRun: false, qaWritesEnabled: true, baseUrl: QA_API_ORIGIN,
    apiToken: "synthetic-test-placeholder", authHeader: "Authorization", authScheme: "TestOnly",
    mappings: { merchants: { "local-merchant": structuredClone(merchantMapping) }, offers: { "local-offer": structuredClone(offerMapping) } },
    ...patch,
  };
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return response();
  };
  const rawAdapter = createBackofficeClient(() => config, fakeFetch);
  // Test fixtures supply explicit merchant details, as the service now does.
  const adapter = {
    ...rawAdapter,
    createMerchantInBackoffice: (source: Parameters<typeof rawAdapter.createMerchantInBackoffice>[0], details = config.mappings?.merchants?.[source.sourceRequestId]) => rawAdapter.createMerchantInBackoffice(source, details),
    createOfferInBackoffice: (parent: string, source: Parameters<typeof rawAdapter.createOfferInBackoffice>[1], details: OfferQaDetails = syntheticOfferDetails({
      title: source.title, titleAr: source.titleAr ?? "", description: source.description ?? "",
      descriptionAr: source.descriptionAr ?? "", startDate: source.validity.startDate!, endDate: source.validity.endDate!,
      termsAndConditions: [...source.terms.claimRules, ...source.terms.generalRules, source.terms.otherRules].filter(Boolean).join("\n"),
    })) => rawAdapter.createOfferInBackoffice(parent, source, details),
  };
  return { config, calls, adapter, rawAdapter };
}

test("dry-run with full mappings prepares both QA payloads without HTTP; missing mappings are warnings", async () => {
  const f = setup({ dryRun: true });
  const created = await f.adapter.createMerchantInBackoffice(merchant);
  assert.match(created.id, /^dry-run-merchant-/);
  assert.equal(created.warnings, undefined);
  assert.equal((await f.adapter.createOfferInBackoffice("1001", offer)).warnings, undefined);
  assert.equal(f.calls.length, 0);
  f.config.mappings = {};
  const warning = await f.adapter.createMerchantInBackoffice(merchant);
  assert.match(warning.warnings?.join() ?? "", /userEmail/);
  assert.equal(f.calls.length, 0);
});

test("merchant uses confirmed endpoint/field names and stores primary ID, never moderation ID", async () => {
  const f = setup();
  const result = await f.adapter.createMerchantInBackoffice(merchant);
  assert.deepEqual(result, { id: "1001", dryRun: false });
  assert.equal(f.calls[0].url, `${QA_API_ORIGIN}/admin/merchant-profiles`);
  assert.equal(f.calls[0].init?.method, "POST");
  assert.equal(f.calls[0].init?.redirect, "error");
  const body = JSON.parse(String(f.calls[0].init?.body));
  assert.equal(body.agencyName, "Synthetic QA Brand");
  assert.equal(body.agencyId, 101);
  assert.equal(body.categoryId, 201);
  assert.equal(body.branches[0].locationId, 301);
  assert.equal(body.companyName, undefined);
  assert.equal(body.sourceRequestId, undefined);
  assert.equal((f.calls[0].init?.headers as Record<string, string>)["Content-Type"], "application/json");
});

test("offer posts a flat payload to /admin/offers with stable merchant and branch IDs", async () => {
  const f = setup();
  // Operator mappings cannot redirect an offer to a different merchant.
  f.config.mappings!.offers!["local-offer"].merchantProfileId = 9999;
  const result = await f.adapter.createOfferInBackoffice("1001", offer);
  assert.deepEqual(result, { id: "2001", dryRun: false });
  assert.equal(f.calls[0].url, `${QA_API_ORIGIN}/admin/offers`);
  const body = JSON.parse(String(f.calls[0].init?.body));
  assert.equal(body.merchantProfileId, 1001);
  assert.deepEqual(body.branchIds, [501]);
  assert.deepEqual(body.images, [{ uri: syntheticImageKey, sortOrder: 1 }]);
  assert.match(body.termsAndConditions, /Test term/);
  assert.equal(body.offer, undefined);
  assert.equal(body.merchantBackofficeId, undefined);
});

test("confirmed platform header zero is included for both QA create endpoints", async () => {
  const f = setup({ platform: "0" });
  await f.adapter.createMerchantInBackoffice(merchant);
  await f.adapter.createOfferInBackoffice("1001", offer);
  assert.equal(f.calls.length, 2);
  for (const call of f.calls) {
    assert.equal((call.init?.headers as Record<string, string>).platform, "0");
  }
});

test("QA-only host restriction, write flag, missing auth/mappings and simulated IDs prevent all HTTP", async () => {
  for (const baseUrl of ["https://qlr-bo.qatarliving.com", "http://qlr-bo-qa.qatarliving.com", "https://qlr-bo-qa.qatarliving.com.evil.invalid", "https://qlr-bo-qa.qatarliving.com/other", `${QA_API_ORIGIN}?token=placeholder`, "https://name:placeholder@qlr-bo-qa.qatarliving.com"]) {
    const f = setup({ baseUrl });
    await assert.rejects(f.adapter.createMerchantInBackoffice(merchant), /Only the confirmed QA API origin/);
    assert.equal(f.calls.length, 0);
  }
  for (const patch of [
    { qaWritesEnabled: false }, { mappings: {} }, { apiToken: undefined },
    { authHeader: undefined }, { authScheme: undefined }, { authHeader: "Cookie" },
    { platform: "invalid\r\nheader" }, { mappingJson: "{", mappings: undefined },
  ] as Partial<BackofficeConfig>[]) {
    const f = setup(patch);
    await assert.rejects(f.adapter.createMerchantInBackoffice(merchant), BackofficeError);
    assert.equal(f.calls.length, 0);
  }
  const f = setup();
  await assert.rejects(f.adapter.createOfferInBackoffice("dry-run-merchant-test", offer), /simulated ID/);
  await assert.rejects(f.adapter.createOfferInBackoffice("invalid-id", offer), /mapping/);
  assert.equal(f.calls.length, 0);
});

test("token provider is not called until all creation safety gates pass", async () => {
  for (const patch of [
    { dryRun: true }, { qaWritesEnabled: false }, { mappings: {} },
    { baseUrl: "https://invalid.example" }, { authHeader: "Cookie" },
    { platform: "bad\r\nheader" }, { timeoutMs: -1 },
  ] as Partial<BackofficeConfig>[]) {
    let logins = 0;
    const f = setup({ getApiToken: async () => { logins++; return "synthetic-login-token"; }, ...patch });
    if (patch.dryRun) await f.adapter.createMerchantInBackoffice(merchant);
    else await assert.rejects(f.adapter.createMerchantInBackoffice(merchant));
    assert.equal(logins, 0);
    assert.equal(f.calls.length, 0);
  }
});

test("both actions use login token; login failure blocks POST; 401 invalidates without replay", async () => {
  let logins = 0;
  const f = setup({ getApiToken: async () => { logins++; return "synthetic-login-token"; } });
  await f.adapter.createMerchantInBackoffice(merchant);
  await f.adapter.createOfferInBackoffice("1001", offer);
  assert.equal(logins, 2);
  for (const call of f.calls) assert.equal((call.init?.headers as Record<string, string>).Authorization, "TestOnly synthetic-login-token");
  const failed = setup({ getApiToken: async () => { throw new Error("PRIVATE-LOGIN"); } });
  await assert.rejects(failed.adapter.createMerchantInBackoffice(merchant), /QA sign-in failed/);
  assert.equal(failed.calls.length, 0);
  let invalidated = 0;
  const rejected = setup({
    getApiToken: async () => "synthetic-login-token",
    invalidateApiToken: (token) => { assert.equal(token, "synthetic-login-token"); invalidated++; },
  }, () => new Response(null, { status: 401 }));
  await assert.rejects(rejected.adapter.createMerchantInBackoffice(merchant), /HTTP 401/);
  assert.equal(rejected.calls.length, 1);
  assert.equal(invalidated, 1);
});

test("sensitive upstream error content is not echoed; confirmed rejection is retryable", async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    const f = setup({}, () => new Response(JSON.stringify({ error: "PRIVATE-UPSTREAM-CONTENT" }), { status }));
    await assert.rejects(f.adapter.createMerchantInBackoffice(merchant), (e: unknown) => {
      assert.ok(e instanceof BackofficeError);
      assert.doesNotMatch(e.message, /PRIVATE-UPSTREAM-CONTENT|synthetic-test-placeholder/);
      assert.match(e.message, new RegExp(`HTTP ${status}`));
      assert.doesNotMatch(e.message, /QA_RESULT_UNCERTAIN/);
      return true;
    });
    assert.equal(f.calls.length, 1);
  }
});

test("404 classifies known missing references without leaking upstream values", async () => {
  for (const [body, expected] of [
    [{ message: "User with PRIVATE-UPSTREAM-CONTENT not found" }, /registered QA user/],
    [{ code: "USER_NOT_FOUND" }, /registered QA user/],
    [{ error: { message: "Location PRIVATE-UPSTREAM-CONTENT does not exist" } }, /referenced location/],
    [{ message: ["Agency PRIVATE-UPSTREAM-CONTENT not found"] }, /referenced agency/],
    [{ message: "Not Found" }, /endpoint or a referenced resource/],
  ] as const) {
    const f = setup({}, () => new Response(JSON.stringify(body), { status: 404 }));
    await assert.rejects(f.adapter.createMerchantInBackoffice(merchant), (error: unknown) => {
      assert.ok(error instanceof BackofficeError);
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /PRIVATE-UPSTREAM-CONTENT|synthetic-test-placeholder|QA_RESULT_UNCERTAIN/);
      return true;
    });
    assert.equal(f.calls.length, 1);
  }
});

test("404 malformed or oversized bodies use a safe fallback without retrying", async () => {
  for (const body of ["<html>PRIVATE-UPSTREAM-CONTENT</html>", JSON.stringify({ message: "PRIVATE-UPSTREAM-CONTENT".repeat(1000) })]) {
    const f = setup({}, () => new Response(body, { status: 404 }));
    await assert.rejects(f.adapter.createMerchantInBackoffice(merchant), (error: unknown) => {
      assert.ok(error instanceof BackofficeError);
      assert.match(error.message, /HTTP 404/);
      assert.doesNotMatch(error.message, /PRIVATE-UPSTREAM-CONTENT|QA_RESULT_UNCERTAIN/);
      return true;
    });
    assert.equal(f.calls.length, 1);
  }
});

test("5xx, malformed success and missing primary IDs are uncertain and never automatically retried", async () => {
  for (const response of [
    () => new Response("upstream failure", { status: 503 }),
    () => new Response("not-json", { status: 201 }),
    () => new Response(JSON.stringify({ merchantModerationProfileId: 9991 }), { status: 201 }),
    () => new Response(JSON.stringify({ merchantProfileId: 0 }), { status: 201 }),
  ]) {
    const f = setup({}, response);
    await assert.rejects(f.adapter.createMerchantInBackoffice(merchant),
      (e: unknown) => e instanceof BackofficeError && e.message.startsWith(UNCERTAIN_RESULT_PREFIX));
    assert.equal(f.calls.length, 1);
  }
});

test("timeouts and network failures are uncertain, without leaking underlying error details", async () => {
  let calls = 0;
  const config = setup().config;
  const failing: typeof fetch = async () => { calls++; throw new Error("PRIVATE-NETWORK-DETAILS"); };
  const failure = createBackofficeClient(() => config, failing);
  await assert.rejects(failure.createMerchantInBackoffice(merchant, merchantMapping),
    (e: unknown) => e instanceof BackofficeError && e.message.startsWith(UNCERTAIN_RESULT_PREFIX) && !e.message.includes("PRIVATE-NETWORK"));
  assert.equal(calls, 1);
  const timed: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("Timeout")), { once: true });
  });
  config.timeoutMs = 5;
  await assert.rejects(createBackofficeClient(() => config, timed).createMerchantInBackoffice(merchant, merchantMapping),
    (e: unknown) => e instanceof BackofficeError && e.message.startsWith(UNCERTAIN_RESULT_PREFIX));
});

test("unconfirmed weekday/tranche encodings, missing redemption mappings and invalid dates fail before POST", async () => {
  for (const changed of [
    { ...offer, validity: { ...offer.validity, specificDays: true } },
    { ...offer, validity: { ...offer.validity, isTwoTranches: true } },
    { ...offer, limitPerUser: "2" },
    { ...offer, validity: { ...offer.validity, endDate: "2020-01-01" } },
  ]) {
    const f = setup();
    await assert.rejects(f.adapter.createOfferInBackoffice("1001", changed), /mapping/);
    assert.equal(f.calls.length, 0);
  }
});

test("legacy per-ID fixture JSON cannot supply or override actual merchant details", async () => {
  const source: BackofficeMappings = { merchants: { "local-merchant": merchantMapping } };
  const f = setup({ mappings: undefined, mappingJson: JSON.stringify(source) });
  await assert.rejects(f.rawAdapter.createMerchantInBackoffice(merchant), /mapping/);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.rawAdapter.createMerchantInBackoffice(merchant, merchantMapping)).id, "1001");
  assert.equal(f.calls.length, 1);
});
