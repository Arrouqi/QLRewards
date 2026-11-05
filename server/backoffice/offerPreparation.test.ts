import assert from "node:assert/strict";
import test from "node:test";
import type { Merchant, MerchantDeal } from "@shared/schema";
import type { OfferQaDetails } from "@shared/offerQaDetails";
import { OfferQaWorkflow } from "./offerDetails";
import { BackofficeService } from "./service";
import { offerSourcePrefill } from "./offerPrefill";
import { mapOffer } from "./mapOffer";
import { createSourceImageReader, isTrustedOfferSourceImage } from "./offerSourceImages";
import type { BackofficeRepository, BackofficeUnit, OfferRequest } from "./types";
import { syntheticImageKey, syntheticOfferDetails, syntheticOfferOptions } from "./offerTestHelpers";

const portalImage = (name: string) => `https://qlrstoragedev.blob.core.windows.net/deals-clients/merchant-deal-images/123/${name}.png`;
function fixture(source: "deals" | "merchant_deals" = "merchant_deals") {
  let merchant = { id: "merchant", backofficeMerchantId: "1001", status: "created", lastBackofficeError: null } as Merchant;
  let offer = {
    ...syntheticOfferDetails(), id: "offer", merchantId: "merchant", source, status: "pending",
    category: "Synthetic category", subCategory: "Synthetic subcategory", dealType: "discount", duration: "1 year",
    redemption: "unlimited", limitPerUser: null, originalPrice: "42", estimatedSavings: "5",
    images: [portalImage("first"), portalImage("second")], branches: ["Existing branch"],
    claimRules: ["Synthetic claim rule"], generalRules: ["General rule not a payment condition"], otherRules: "Actual other terms",
    startDate: "2026-10-21", endDate: "2026-12-31", offerStartDate: "2026-10-21", offerEndDate: "2026-12-31",
    specificDays: false, isTwoTranches: false, backofficeOfferId: null, lastBackofficeError: null,
  } as unknown as OfferRequest;
  let details: OfferQaDetails | null = null;
  let transfers: Record<string, string> = {};
  let failingUpload = 0;
  let uploads = 0;
  let creates = 0;
  const events: string[] = [];
  const unit: BackofficeUnit = {
    async getMerchant() { return merchant; }, async getOffer() { return offer; }, async isMerchantDeleted() { return false; },
    async getBrands() { return []; }, async getMerchantQaDetails() { return null; }, async saveMerchantQaDetails() {},
    async getOfferQaDetails() { return details; },
    async saveOfferQaDetails(_offer, value) { events.push("save"); details = value; },
    async getOfferQaTransfers() { return structuredClone(transfers); },
    async saveOfferQaTransfers(_offer, value) { events.push("checkpoint"); transfers = structuredClone(value); },
    async saveMerchant(_id, patch) { merchant = { ...merchant, ...patch }; return merchant; },
    async saveOffer(_offer, patch) { offer = { ...offer, ...patch }; return offer; },
    async audit() { events.push("audit"); },
  };
  let queue = Promise.resolve();
  const repository: BackofficeRepository = { transaction(work) {
    const result = queue.then(async () => {
      const snapshot = structuredClone({ merchant, offer, details, transfers });
      try { return await work(unit); } catch (error) {
        merchant = snapshot.merchant; offer = snapshot.offer; details = snapshot.details; transfers = snapshot.transfers;
        throw error;
      }
    });
    queue = result.then(() => {}, () => {});
    return result;
  } };
  const options = { ...syntheticOfferOptions(), offerTypes: [{ id: 401, name: "Discount" }], branches: [{ id: 501, name: "Existing branch" }] };
  const tools = {
    async loadOptions(parent: string | null, refresh = false) {
      events.push(`options:${parent}:${refresh}`);
      return { ...options, merchantProfileId: parent };
    },
    async readSourceImage(ref: string) { events.push(`read:${ref.endsWith("first.png") ? "first" : "second"}`); return { bytes: Buffer.from("synthetic"), contentType: "image/png" }; },
    async uploadImage() {
      uploads++;
      events.push("upload");
      if (uploads === failingUpload) throw new Error("PRIVATE upstream failure");
      return { reference: syntheticImageKey.replace("test-image", `transferred-${uploads}`) };
    },
  };
  const workflow = new OfferQaWorkflow(repository, tools);
  const service = new BackofficeService(repository, {
    isBackofficeDryRun() { return true; },
    async createMerchantInBackoffice() { throw new Error("not expected"); },
    async createOfferInBackoffice(parent, _source, mapping) {
      creates++; events.push("create");
      assert.equal(parent, "1001");
      assert.deepEqual(mapping, details);
      return { id: "dry-run-offer-fixture", dryRun: true };
    },
  }, undefined, undefined, tools);
  return { workflow, service, options, events,
    details: () => details, transfers: () => transfers, uploads: () => uploads, creates: () => creates,
    setDetails(value: OfferQaDetails | null) { details = value; },
    setMerchant(patch: Partial<Merchant>) { merchant = { ...merchant, ...patch }; },
    setOffer(patch: Partial<OfferRequest>) { offer = { ...offer, ...patch }; },
    failUploadAt(count: number) { failingUpload = count; },
  };
}

test("read-only prefill reuses verified source choices and confirmed QA duration", async () => {
  for (const source of ["deals", "merchant_deals"] as const) {
    const f = fixture(source);
    const response = await f.workflow.get("offer");
    assert.deepEqual(response.prefill.categoryIds, [201]);
    assert.deepEqual(response.prefill.subCategoryIds, [202]);
    assert.equal(response.prefill.offerTypeId, 401);
    assert.deepEqual(response.prefill.branchIds, [501]);
    assert.deepEqual(response.prefill.claimRuleIds, [601]);
    assert.deepEqual(response.prefill.paymentConditionIds, []);
    assert.equal(response.prefill.startDate, "2026-10-21");
    assert.equal(response.prefill.estimatedSavings, 5);
    assert.equal(response.prefill.price, 42);
    assert.equal(response.prefill.redemptionType, 1);
    assert.equal(response.prefill.redemptionLimit, null);
    assert.equal(response.prefill.offerDuration, 2);
    assert.deepEqual(response.sourceValues, { price: "42", duration: "1 year", redemption: "unlimited", branches: ["Existing branch"] });
    assert.equal(response.sourceImages?.length, 2);
    assert.equal(f.uploads(), 0);
    assert.equal(f.details(), null);
    assert.equal(f.creates(), 0);
  }
});

test("submitted rules match verified labels despite terminal full stops and general rules select matching payment conditions", () => {
  const source = mapOffer({
    title: "Submitted deal", category: "Food", subCategory: "Fast Food", dealType: "bogo",
    originalPrice: "30", redemption: "unlimited", duration: "1 Year", limitPerUser: "9",
    claimRules: ["Offer Valid only for Dine-in (Not valid on Delivery / Take away).", "Offer Valid only for Delivery / Take away."],
    generalRules: ["Offer is not applicable on public holidays & all special events.", "Advance booking or reservation requirement."],
    branches: ["City Center"], images: [],
  } as unknown as MerchantDeal);
  const options = { ...syntheticOfferOptions(),
    branches: [{ id: 5260, name: "City Center" }],
    claimRules: [{ id: 1, name: "Offer Valid only for Dine-in (Not valid on Delivery / Take away)" }, { id: 2, name: "Offer Valid only for Delivery / Take away" }],
    paymentConditions: [{ id: 7, name: "Offer is not applicable on public holidays & all special events" }, { id: 8, name: "Advance booking or reservation requirement" }],
  };
  const prefill = offerSourcePrefill(source, "1001", options);
  assert.deepEqual(prefill.claimRuleIds, [1, 2]);
  assert.deepEqual(prefill.paymentConditionIds, [7, 8]);
  assert.deepEqual(prefill.branchIds, [5260]);
  assert.equal(prefill.price, 30);
  assert.equal(prefill.offerDuration, 2);
  assert.equal(prefill.redemptionType, 1);
  assert.equal(prefill.redemptionLimit, null, "Unlimited does not retain an unrelated stale limit");
  assert.ok(prefill.termsAndConditions?.includes(source.terms.generalRules[0]));
  options.claimRules.push({ id: 3, name: options.claimRules[0].name + "." });
  assert.deepEqual(offerSourcePrefill(source, "1001", options).claimRuleIds, [2], "Ambiguous normalized labels are not guessed");
});

test("only valid actual prices and known redemption labels are converted, including zero and limited counts", () => {
  const base = mapOffer({ title: "Submitted", images: [], claimRules: [], generalRules: [], originalPrice: "0", redemption: "limited", limitPerUser: "2" } as unknown as MerchantDeal);
  const limited = offerSourcePrefill(base, "1001");
  assert.equal(limited.price, 0);
  assert.equal(limited.redemptionType, 2);
  assert.equal(limited.redemptionLimit, 2);
  for (const value of ["", " ", "not a price", "-5", "Infinity", "1e999"]) {
    assert.equal(offerSourcePrefill({ ...base, pricing: { ...base.pricing, originalPrice: value } }, "1001").price, undefined);
  }
  assert.equal(offerSourcePrefill({ ...base, redemption: "unknown" }, "1001").redemptionType, undefined);
  assert.equal(offerSourcePrefill(base, "1001").offerDuration, undefined);
});

test("QA duration is a confirmed selector code, never inferred from numeric text or dates", () => {
  const base = mapOffer({ title: "Submitted", images: [], duration: "1 Year", startDate: "2026-10-27", endDate: "2027-10-27" } as unknown as MerchantDeal);
  for (const value of ["1 Year", "ONE YEAR", " Yearly ", "Yearly Offer"]) {
    assert.equal(offerSourcePrefill({ ...base, validity: { ...base.validity, duration: value } }, "1001").offerDuration, 2);
  }
  for (const value of ["1 Month", "One Month", " monthly ", "Monthly Offer"]) {
    assert.equal(offerSourcePrefill({ ...base, validity: { ...base.validity, duration: value } }, "1001").offerDuration, 1);
  }
  for (const value of ["", "2 Months", "12 Months", "365 days", "1", "2", "Monthly and Yearly", "1 Year or 1 Month"]) {
    assert.equal(offerSourcePrefill({ ...base, validity: { ...base.validity, duration: value } }, "1001").offerDuration, undefined);
  }
  assert.equal(offerSourcePrefill({ ...base, validity: { ...base.validity, duration: "" } }, "1001").offerDuration, undefined);
});

test("source matching requires unique current scoped options; ambiguous IDs and foreign branches are never guessed", () => {
  const source = mapOffer({
    category: "Food &amp; Dining", subCategory: "Dining", dealType: "bogo", title: "Source",
    branches: ["Al Sadd"], claimRules: [], generalRules: [], images: [syntheticImageKey],
  } as unknown as MerchantDeal);
  const options = { ...syntheticOfferOptions(), categories: [{ id: 11, name: "Food & Dining", subCategories: [{ id: 12, name: "Dining" }] }],
    offerTypes: [{ id: 2, name: "Buy 1 Get 1" }], branches: [{ id: 5, name: "Al Sadd" }, { id: 6, name: "Al Sadd" }] };
  const prefill = offerSourcePrefill(source, "1001", options);
  assert.deepEqual(prefill.categoryIds, [11]);
  assert.deepEqual(prefill.subCategoryIds, [12]);
  assert.equal(prefill.offerTypeId, 2);
  assert.equal(prefill.branchIds, undefined);
  assert.deepEqual(prefill.images, [syntheticImageKey]);
  assert.equal(offerSourcePrefill(source, "1002", options).categoryIds, undefined);
  options.categories.push({ ...options.categories[0], id: 13 });
  assert.equal(offerSourcePrefill(source, "1001", options).categoryIds, undefined);
});

test("one confirmed prepare saves reused images and actual corrections before guarded creation for both deal sources", async () => {
  for (const source of ["deals", "merchant_deals"] as const) {
    const f = fixture(source);
    const setup = await f.service.prepareOfferQaDetails("offer", { details: { ...syntheticOfferDetails({ images: [], price: 0, title: "Corrected" }) }, useSourceImages: true }, "moderator");
    assert.equal(setup.details?.price, 0);
    assert.equal(setup.details?.title, "Corrected");
    assert.equal(setup.details?.images.length, 2);
    assert.equal(f.uploads(), 2);
    assert.equal(f.creates(), 0);
    assert.ok(f.events.includes("options:1001:true"));
    assert.equal(Object.keys(f.transfers()).length, 2);
    await f.service.createOffer("offer", "moderator");
    assert.ok(f.events.indexOf("save") < f.events.indexOf("create"));
    assert.equal(f.creates(), 1);
    await f.service.createOffer("offer", "moderator");
    assert.equal(f.creates(), 1);
    await assert.rejects(f.workflow.prepare("offer", { details: syntheticOfferDetails(), useSourceImages: true }, "moderator"), /Already created/);
    assert.equal(f.uploads(), 2);
  }
});

test("saved edits take precedence and stable QA images need no transfer", async () => {
  const f = fixture();
  f.setDetails(syntheticOfferDetails({ title: "Saved correction", price: 0, claimRuleIds: [], paymentConditionIds: [] }));
  const response = await f.workflow.prepare("offer", { details: {}, useSourceImages: false }, "moderator");
  assert.equal(response.details?.title, "Saved correction");
  assert.equal(response.details?.price, 0);
  assert.deepEqual(response.details?.claimRuleIds, []);
  assert.deepEqual(response.details?.images, [syntheticImageKey]);
  assert.equal(f.uploads(), 0);
});

test("standalone and onboarding upload folders are previewed, transferred and created using their stored scope", async () => {
  for (const source of ["deals", "merchant_deals"] as const) {
    const f = fixture(source);
    const folder = source === "deals" ? "offer" : "merchant-merchant-deal";
    // Exact URL format emitted by uploadImageToAzure from the existing public
    // /api/deals and merchant-onboarding save flows.
    const url = `https://qlrstoragedev.blob.core.windows.net/deals-clients/${folder}/1793007211642-0.png`;
    f.setOffer({ images: [url] });
    const preview = await f.workflow.get("offer");
    assert.deepEqual(preview.sourceImages, [url]);
    assert.equal(f.uploads(), 0);
    const context = { id: "offer", merchantId: "merchant", source };
    assert.equal(isTrustedOfferSourceImage(url), false, "Scoped folders require stored context");
    assert.equal(isTrustedOfferSourceImage(url, context), true);
    for (const bad of [
      url.replace(folder + "/", folder + "-other/"),
      url.replace(folder + "/", "unrelated-deal/"),
      url.replace(folder + "/", "merchant-other-deal/"),
      url.replace(folder + "/", "merchant-crUpload/"),
      url + "?sig=private", url.replace("1793007211642-0.png", "../private.png"),
    ]) assert.equal(isTrustedOfferSourceImage(bad, context), false);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const read = createSourceImageReader(async () => new Response(png, { headers: { "content-type": "image/png" } }));
    assert.deepEqual((await read(url, context)).bytes, png);
    const prepared = await f.workflow.prepare("offer", { details: syntheticOfferDetails({ images: [] }), useSourceImages: true }, "moderator");
    assert.equal(prepared.details?.images.length, 1);
    assert.equal(f.uploads(), 1);
    await f.service.createOffer("offer", "moderator");
    assert.equal(f.creates(), 1);
  }
});

test("foreign scoped folders are reported rather than silently discarded and fail before transfer", async () => {
  const f = fixture();
  f.setOffer({ images: ["https://qlrstoragedev.blob.core.windows.net/deals-clients/merchant-other-deal/1793007211642-0.png"] });
  const response = await f.workflow.get("offer");
  assert.equal(response.sourceImages?.length, 0);
  assert.ok(response.preparationIssues?.some((issue) => issue.includes("outside supported storage folders")));
  await assert.rejects(f.workflow.prepare("offer", { details: syntheticOfferDetails({ images: [] }), useSourceImages: true }, "moderator"), /transferred safely/);
  assert.equal(f.uploads(), 0);
  assert.equal(f.creates(), 0);
});

test("missing fields, stale parent, foreign branches, unsupported validity and unsafe images fail before transfer", async () => {
  for (const patch of [
    { input: { details: {}, useSourceImages: true }, offer: { duration: "unsupported duration" } },
    { input: { details: syntheticOfferDetails({ parentMerchantProfileId: "1002" }), useSourceImages: true } },
    { input: { details: syntheticOfferDetails({ branchIds: [999] }), useSourceImages: true } },
    { input: { details: syntheticOfferDetails({ images: [] }), useSourceImages: true }, offer: { specificDays: true } },
    { input: { details: syntheticOfferDetails({ images: [] }), useSourceImages: true }, offer: { images: ["http://127.0.0.1/private"] } },
  ]) {
    const f = fixture();
    if (patch.offer) f.setOffer(patch.offer);
    await assert.rejects(f.workflow.prepare("offer", patch.input, "moderator"));
    assert.equal(f.uploads(), 0);
    assert.equal(f.creates(), 0);
    assert.equal(f.details(), null);
  }
});

test("partial image failure checkpoints completed transfers for retry without saving partial setup or creating a deal", async () => {
  const f = fixture();
  f.failUploadAt(2);
  const input = { details: syntheticOfferDetails({ images: [] }), useSourceImages: true };
  await assert.rejects(f.workflow.prepare("offer", input, "moderator"), /Completed images were retained/);
  assert.equal(Object.keys(f.transfers()).length, 1);
  assert.equal(f.details(), null);
  assert.equal(f.creates(), 0);
  const saved = await f.workflow.prepare("offer", input, "moderator");
  assert.equal(saved.details?.images.length, 2);
  assert.equal(f.uploads(), 3, "The first upload is reused, not replayed");
  assert.equal(f.events.filter((event) => event === "read:first").length, 1);
});

test("concurrent confirmed preparation and creation reuse checkpoints and create just once", async () => {
  const f = fixture();
  const input = { details: syntheticOfferDetails({ images: [] }), useSourceImages: true };
  const [first, second] = await Promise.all([
    f.workflow.prepare("offer", input, "moderator"), f.workflow.prepare("offer", input, "moderator"),
  ]);
  assert.deepEqual(first.details?.images, second.details?.images);
  assert.equal(f.uploads(), 2);
  await Promise.all([f.service.createOffer("offer", "moderator"), f.service.createOffer("offer", "moderator")]);
  assert.equal(f.creates(), 1);
});

test("preparation rejects uncertain/invalid-status records and parent changes invalidate transfer cache", async () => {
  for (const patch of [{ status: "archived" }, { lastBackofficeError: "[QA_RESULT_UNCERTAIN] fixture" }]) {
    const f = fixture();
    f.setOffer(patch);
    await assert.rejects(f.workflow.prepare("offer", { details: syntheticOfferDetails(), useSourceImages: true }, "moderator"));
    assert.equal(f.uploads(), 0);
  }
  const f = fixture();
  const input = { details: syntheticOfferDetails({ images: [] }), useSourceImages: true };
  await f.workflow.prepare("offer", input, "moderator");
  f.setMerchant({ backofficeMerchantId: "1002" });
  await assert.rejects(f.workflow.prepare("offer", input, "moderator"), /parent changed/);
  f.setDetails(null);
  await f.workflow.prepare("offer", { ...input, details: { ...input.details, parentMerchantProfileId: "1002" } }, "moderator");
  assert.equal(f.uploads(), 4, "Transfer references from another parent are not reused");
});

test("source image reads pin origin/container/path, reject credentials, redirects and invalid formats, and bound streamed content", async () => {
  const trusted = portalImage("first");
  for (const url of [
    trusted.replace("https:", "http:"), trusted.replace("qlrstoragedev.", "qlrstoragedev.evil."),
    trusted + "?sig=private", trusted + "#fragment", trusted.replace("deals-clients", "other"),
    trusted.replace("merchant-deal-images", "merchant-documents"), trusted.replace("https://", "https://private:private@"),
    trusted.replace("first", "%2e%2e/first"), "http://127.0.0.1/private",
  ]) {
    assert.equal(isTrustedOfferSourceImage(url), false, url);
    await assert.rejects(createSourceImageReader(async () => { throw Error("must not fetch"); })(url));
  }
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const read = createSourceImageReader(async (url, init) => {
    assert.equal(String(url), trusted);
    assert.equal(init?.redirect, "error");
    assert.deepEqual(init?.headers, { Accept: "image/png,image/jpeg,image/webp" });
    return new Response(png, { headers: { "content-type": "image/png" } });
  });
  assert.deepEqual((await read(trusted)).bytes, png);
  for (const response of [
    new Response("PRIVATE", { status: 302, headers: { Location: "http://127.0.0.1" } }),
    new Response("<script>PRIVATE</script>", { headers: { "content-type": "image/png" } }),
    new Response(png, { headers: { "content-type": "image/jpeg" } }),
    new Response(png, { headers: { "content-type": "image/png", "content-length": String(6 * 1024 * 1024) } }),
    new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }),
  ]) {
    await assert.rejects(createSourceImageReader(async () => response)(trusted), (error: Error) => {
      assert.match(error.message, /could not be read safely/);
      assert.doesNotMatch(error.message, /PRIVATE|127.0.0.1/);
      return true;
    });
  }
});
