import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import type { Merchant, MerchantBrand } from "@shared/schema";
import { insertDealSchema, insertMerchantSchema, insertMerchantDealSchema } from "@shared/schema";
import { BackofficeError, createBackofficeClient, QA_API_ORIGIN, UNCERTAIN_RESULT_PREFIX, type BackofficeConfig } from "./client";
import { BackofficeHttpError, BackofficeService } from "./service";
import { registerBackofficeRoutes } from "./routes";
import { mapMerchant } from "./mapMerchant";
import { mapOffer } from "./mapOffer";
import type { BackofficeRepository, BackofficeUnit, OfferRequest } from "./types";
import type { MerchantQaDetails } from "@shared/merchantQaDetails";
import type { OfferQaDetails } from "@shared/offerQaDetails";
import { syntheticImageKey, syntheticOfferDetails, syntheticOfferOptions } from "./offerTestHelpers";
import { createOfferOptionsLoader } from "./offerOptions";
import type { OfferQaTools } from "./offerDetails";
import { createMerchantFilePreparer, prepareMerchantQaFiles } from "./merchantSourceFiles";

function fixture(source: "deals" | "merchant_deals" = "merchant_deals",
  loadOptions: OfferQaTools["loadOptions"] = async (parent) => syntheticOfferOptions(parent),
  qaWrites = false, syncImages: (id: string, references: string[]) => Promise<void> = async () => {},
  prepareFiles?: typeof prepareMerchantQaFiles) {
  let merchant = {
    id: "merchant-1", status: "moderation", deletedAt: null, companyType: "individual",
    companyName: "Test Merchant", companyNameAr: "شركة تجريبية", brandName: "Test Brand",
    crNumber: "CR1234", contactPerson: "Test Contact", email: "test@example.invalid", phone: "00000000",
    products: ["Dining"], businessCategories: ["Food"], branches: ["Doha"],
    backofficeMerchantId: null, backofficeCreatedAt: null, lastBackofficeAttemptAt: null, lastBackofficeError: null,
  } as unknown as Merchant;
  let offer = {
    id: "offer-1", merchantId: "merchant-1", source, status: "pending",
    title: "Test Offer", titleAr: "عرض تجريبي", dealType: "discount", category: "Food", subCategory: "Dining",
    discountPercentage: "20", claimRules: ["Claim first"], generalRules: ["Show code"],
    branches: ["Doha"], images: ["/test-image.jpg"],
    ...(source === "deals" ? { offerStartDate: "2026-10-21", offerEndDate: "2026-12-31" } : { startDate: "2026-10-21", endDate: "2026-12-31" }),
    backofficeOfferId: null, backofficeCreatedAt: null, lastBackofficeAttemptAt: null, lastBackofficeError: null,
  } as unknown as OfferRequest;
  const audits: { username: string; action: string; details: string }[] = [];
  const locks: string[] = [];
  let fail = false;
  let failAudit = false;
  let simulateRealResult = false;
  let merchantCalls = 0;
  let sentMerchantDetails: Partial<MerchantQaDetails> | undefined;
  let offerCalls = 0;
  let uploadCalls = 0;
  let offerUploadCalls = 0;
  let offerDetails: OfferQaDetails | null = syntheticOfferDetails();
  let queue = Promise.resolve();
  let qaDetails: MerchantQaDetails | null = {
    agencyName: "Test Brand", agencyEmail: "business@example.invalid",
    contactMobile: "00000000", contactWhatsapp: "00000000",
    agencyLogoUri: "https://files.example.invalid/logo.webp", coverPhoto: "https://files.example.invalid/cover.webp",
    aboutAgency: "A synthetic business description.", crNumber: "CR1234", crUri: "https://files.example.invalid/cr.pdf",
    agencyId: 0, userEmail: "qa-owner@example.invalid", isPriceList: false, categoryId: 1,
    workingHours: Object.fromEntries(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]
      .map((day) => [day, { closed: true, open: "", close: "" }])) as MerchantQaDetails["workingHours"],
    branches: [{ name: "Doha", locationId: 1, locationUri: "https://maps.example.invalid/branch", contactMobile: "00000000", pin: "", pinEnabled: false, qrEnabled: true }],
  };
  const unit: BackofficeUnit = {
    async getMerchant(id, lock) {
      if (lock) locks.push(`merchant:${id}`);
      return id === merchant.id && !merchant.deletedAt ? merchant : undefined;
    },
    async isMerchantDeleted(id) { return id === merchant.id && !!merchant.deletedAt; },
    async getOffer(id, lock) {
      if (lock) locks.push(`offer:${id}`);
      return id === offer.id ? offer : undefined;
    },
    async getBrands() { return []; },
    async getMerchantQaDetails() { return qaDetails; },
    async saveMerchantQaDetails(_id, details) { qaDetails = details; },
    async getOfferQaDetails() { return offerDetails; },
    async saveOfferQaDetails(_offer, details) { offerDetails = details; },
    async saveMerchant(_id, patch) { merchant = { ...merchant, ...patch }; return merchant; },
    async saveOffer(_offer, patch) { offer = { ...offer, ...patch }; return offer; },
    async audit(username, action, _merchant, details) {
      if (failAudit) throw new Error("Audit unavailable");
      audits.push({ username, action, details });
    },
  };
  // Isolated transactional fake: no real database writes or external requests.
  const repository: BackofficeRepository = {
    transaction: (work) => {
      const result = queue.then(async () => {
        const snapshot = structuredClone({ merchant, offer, audits, qaDetails, offerDetails });
        try { return await work(unit); } catch (error) {
          merchant = snapshot.merchant; offer = snapshot.offer;
          qaDetails = snapshot.qaDetails;
          offerDetails = snapshot.offerDetails;
          audits.splice(0, audits.length, ...snapshot.audits);
          throw error;
        }
      });
      queue = result.then(() => {}, () => {});
      return result;
    },
  };
  const service = new BackofficeService(repository, {
    isBackofficeDryRun: () => !qaWrites,
    async createMerchantInBackoffice(_source, details) {
      merchantCalls++;
      sentMerchantDetails = details;
      if (fail) throw new BackofficeError("Simulated upstream outage");
      return { id: simulateRealResult ? "1001" : "dry-run-merchant-test", dryRun: !simulateRealResult };
    },
    async createOfferInBackoffice(parentId, payload: any) {
      offerCalls++;
      assert.equal(parentId, merchant.backofficeMerchantId);
      assert.equal(payload.title, "Test Offer");
      if (fail) throw new BackofficeError("Simulated upstream outage");
      return { id: simulateRealResult ? "2001" : "dry-run-offer-test", dryRun: !simulateRealResult };
    },
  }, async () => ({ categories: [{ id: 1, name: "QA category" }], locations: [{ id: 1, name: "QA location" }] }),
  async (kind) => {
    uploadCalls++;
    return { kind: kind as "logo" | "cover" | "cr", reference: `qa/default/test-${kind}.png` };
  }, {
    loadOptions,
    uploadImage: async () => { offerUploadCalls++; return { reference: syntheticImageKey }; },
  }, syncImages, prepareFiles);
  return {
    service, audits, locks,
    details: () => qaDetails,
    clearDetails: () => { qaDetails = null; },
    merchant: () => merchant, offer: () => offer,
    setMerchant: (patch: Partial<Merchant>) => { merchant = { ...merchant, ...patch }; },
    setOffer: (patch: Partial<OfferRequest>) => { offer = { ...offer, ...patch }; },
    setFailure: (value: boolean) => { fail = value; },
    setAuditFailure: () => { failAudit = true; },
    setRealResult: () => { simulateRealResult = true; },
    calls: () => ({ merchant: merchantCalls, offer: offerCalls }),
    sentMerchantDetails: () => sentMerchantDetails,
    uploads: () => uploadCalls,
    offerDetails: () => offerDetails,
    clearOfferDetails: () => { offerDetails = null; },
    offerUploads: () => offerUploadCalls,
  };
}

test("real QA merchant creation rejects portal file URLs before a remote create", async () => {
  const f = fixture("merchant_deals", async (parent) => syntheticOfferOptions(parent), true);
  const state = await f.service.getMerchantState("merchant-1");
  assert.equal(state.canCreate, false);
  assert.equal(state.mappingIssues?.filter((item) => /upload this submitted file to QA/.test(item)).length, 3);
  await assert.rejects(f.service.createMerchant("merchant-1", "moderator"), /upload this submitted file to QA/);
  assert.equal(f.calls().merchant, 0);
  await f.service.saveMerchantQaDetails("merchant-1", {
    ...f.details(), agencyLogoUri: "qa/default/logo.png", coverPhoto: "qa/0/cover.png", crUri: "qa/0/cr.pdf",
  }, "moderator");
  assert.equal((await f.service.getMerchantState("merchant-1")).canCreate, true);
});

test("actual submitted merchant files transfer only on explicit create and are saved before remote creation", async () => {
  const root = "https://qlrstoragedev.blob.core.windows.net/deals-clients/merchant-documents/123";
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const f = fixture("merchant_deals", undefined, true, undefined,
    createMerchantFilePreparer(async (input) => new Response(String(input).endsWith(".pdf") ? Buffer.from("%PDF-1.7") : png,
      { headers: { "content-type": String(input).endsWith(".pdf") ? "application/pdf" : "image/png" } })));
  f.setMerchant({ logo: `${root}/logo.png`, coverImage: `${root}/cover.png`, crDocument: `${root}/cr.pdf` });
  Object.assign(f.details()!, { agencyLogoUri: `${root}/logo.png`, coverPhoto: `${root}/cover.png`, crUri: `${root}/cr.pdf` });
  assert.equal((await f.service.getMerchantState("merchant-1")).canCreate, true);
  assert.equal(f.uploads(), 0);
  const result = await f.service.createMerchant("merchant-1", "moderator");
  assert.equal(result.statusCode, 200);
  assert.equal(f.uploads(), 3);
  assert.match(f.details()!.agencyLogoUri, /^qa\//);
  assert.match(f.details()!.coverPhoto, /^qa\//);
  assert.match(f.details()!.crUri, /^qa\//);
  assert.deepEqual(f.sentMerchantDetails(), f.details(), "Only the transferred QA references reach the create adapter");
  assert.equal(f.calls().merchant, 1);
});

test("merchant preparation failure commits completed file checkpoints but never creates remotely", async () => {
  const root = "https://qlrstoragedev.blob.core.windows.net/deals-clients/merchant-documents/123";
  const f = fixture("merchant_deals", undefined, true, undefined, async (_source, details, _upload, checkpoint) => {
    await checkpoint({ ...details, agencyLogoUri: "qa/default/prepared.png" });
    throw new Error("private upstream failure");
  });
  f.setMerchant({ logo: `${root}/logo.png`, coverImage: `${root}/cover.png`, crDocument: `${root}/cr.pdf` });
  Object.assign(f.details()!, { agencyLogoUri: `${root}/logo.png`, coverPhoto: `${root}/cover.png`, crUri: `${root}/cr.pdf` });
  const outcome = await f.service.createMerchant("merchant-1", "moderator");
  assert.equal(outcome.statusCode, 502);
  assert.equal(f.details()!.agencyLogoUri, "qa/default/prepared.png");
  assert.equal(f.merchant().backofficeMerchantId, null);
  assert.equal(f.merchant().status, "moderation");
  assert.equal(f.calls().merchant, 0);
  assert.equal(outcome.body.canCreate, true);
});

test("both offer sources save verified agency branches while keeping the primary merchant profile binding", async () => {
  for (const source of ["deals", "merchant_deals"] as const) {
    let agency: number | null = 3001;
    const paths: string[] = [];
    const load = createOfferOptionsLoader({ getToken: async () => "synthetic", invalidate() {} }, async (url, init) => {
      assert.equal(init?.method, "GET");
      const path = new URL(String(url)).pathname;
      paths.push(path);
      if (path === "/filters") return Response.json(syntheticOfferOptions());
      if (path === "/admin/merchant-profiles/1001") return Response.json({ merchantProfileId: 1001, agencyId: agency });
      assert.equal(path, "/admin/3001/branches");
      return Response.json([{ id: 501, name: "Existing branch" }]);
    });
    const f = fixture(source, load);
    f.setMerchant({ backofficeMerchantId: "1001", status: "created" });
    f.clearOfferDetails();
    const options = await f.service.getOfferQaOptions("offer-1", true);
    assert.equal(options.merchantProfileId, "1001");
    assert.deepEqual(options.branches, [{ id: 501, name: "Existing branch" }]);
    const saved = await f.service.saveOfferQaDetails("offer-1", syntheticOfferDetails(), "moderator");
    assert.equal(saved.details?.parentMerchantProfileId, "1001");
    assert.deepEqual(saved.issues, []);
    assert.equal((await f.service.getOfferState("offer-1")).canCreate, true);
    assert.deepEqual(f.calls(), { merchant: 0, offer: 0 }, "Saving and readiness never create records");
    agency = null;
    await f.service.getOfferQaOptions("offer-1", true);
    assert.equal((await f.service.getOfferState("offer-1")).canCreate, false);
    await assert.rejects(f.service.saveOfferQaDetails("offer-1", syntheticOfferDetails(), "moderator"), /branchIds/);
    await assert.rejects(f.service.createOffer("offer-1", "moderator"), /actual QA details/);
    assert.deepEqual(f.calls(), { merchant: 0, offer: 0 }, "Invalid association blocks before the adapter");
    assert.ok(!paths.includes("/admin/1001/branches"));
  }
});

test("merchant creation keeps moderation status, saves ID/dates, audits actor and is idempotent", async () => {
  const f = fixture();
  const result = await f.service.createMerchant("merchant-1", "test-moderator");
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.status, "moderation");
  assert.equal(f.merchant().status, "moderation");
  assert.equal(result.body.dryRun, true);
  assert.equal(result.body.id, "dry-run-merchant-test");
  assert.ok(result.body.backofficeCreatedAt);
  assert.ok(result.body.lastBackofficeAttemptAt);
  assert.equal(f.audits[0].username, "test-moderator");
  assert.equal(JSON.parse(f.audits[0].details).requestId, "merchant-1");
  assert.equal((await f.service.createMerchant("merchant-1", "other")).body.id, result.body.id);
  assert.equal(f.merchant().status, "moderation", "A repeated click must not move the profile either");
  assert.equal(f.calls().merchant, 1);
  assert.equal(f.audits.length, 1);
  assert.ok(f.locks.includes("merchant:merchant-1"));
});

test("confirmed remote merchant creation also preserves moderation and prevents duplicate writes", async () => {
  const f = fixture();
  f.setRealResult();
  const result = await f.service.createMerchant("merchant-1", "moderator");
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.dryRun, false);
  assert.equal(result.body.id, "1001");
  assert.equal(result.body.status, "moderation");
  assert.equal(f.merchant().status, "moderation");
  assert.ok(f.merchant().backofficeCreatedAt);
  const repeated = await f.service.createMerchant("merchant-1", "moderator");
  assert.equal(repeated.body.status, "moderation");
  assert.equal(repeated.body.canCreate, false);
  assert.equal(f.calls().merchant, 1);
  assert.equal(f.audits.length, 1);
});

test("missing actual details disable creation, saving them enables it without a remote write", async () => {
  const f = fixture();
  const actual = structuredClone(f.details()!);
  f.clearDetails();
  const state = await f.service.getMerchantState("merchant-1");
  assert.equal(state.canCreate, false);
  assert.ok(state.mappingIssues?.includes("userEmail"));
  await assert.rejects(f.service.createMerchant("merchant-1", "moderator"), /actual QA details/);
  assert.equal(f.calls().merchant, 0);
  const saved = await f.service.saveMerchantQaDetails("merchant-1", actual, "moderator");
  assert.deepEqual(saved.details, actual);
  assert.equal(saved.editable, true);
  assert.equal((await f.service.getMerchantState("merchant-1")).canCreate, true);
  assert.equal(f.calls().merchant, 0);
  assert.equal(f.audits[0].action, "backoffice_update_merchant_details");
  assert.doesNotMatch(f.audits[0].details, /qa-owner@|maps.example|00000000/);
});

test("Pending merchants can prepare QA details and files without creating or advancing the merchant", async () => {
  const f = fixture();
  f.setMerchant({ status: "pending" });
  assert.equal((await f.service.getMerchantQaDetails("merchant-1")).editable, true);
  const saved = await f.service.saveMerchantQaDetails("merchant-1", {
    ...f.details()!, userEmail: "changed-qa-owner@example.test",
  }, "moderator");
  assert.equal(saved.editable, true);
  assert.equal(f.details()!.userEmail, "changed-qa-owner@example.test");
  await f.service.uploadMerchantQaFile("merchant-1", "logo", Buffer.from("synthetic"), "image/png", "moderator");
  assert.equal(f.uploads(), 1);
  assert.equal(f.merchant().status, "pending");
  assert.equal((await f.service.getMerchantState("merchant-1")).canCreate, false);
  await assert.rejects(f.service.createMerchant("merchant-1", "moderator"), /In Moderation/);
  assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
});

test("QA setup remains locked for linked, uncertain and later-stage merchants", async () => {
  for (const patch of [
    { status: "pending", backofficeMerchantId: "1001" },
    { status: "pending", lastBackofficeError: `${UNCERTAIN_RESULT_PREFIX} reconcile` },
    ...["created", "licensing", "licensed", "trained", "archived", "rejected"].map((status) => ({ status })),
  ]) {
    const f = fixture();
    f.setMerchant(patch);
    assert.equal((await f.service.getMerchantQaDetails("merchant-1")).editable, false);
    await assert.rejects(f.service.saveMerchantQaDetails("merchant-1", f.details(), "moderator"));
    await assert.rejects(f.service.uploadMerchantQaFile("merchant-1", "logo", Buffer.from("synthetic"), "image/png", "moderator"));
    assert.equal(f.uploads(), 0);
    assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
  }
});

test("file uploads are guarded, audited without private references, and do not persist or create merchants", async () => {
  const f = fixture();
  const original = structuredClone(f.details());
  const result = await f.service.uploadMerchantQaFile("merchant-1", "logo", Buffer.from("synthetic"), "image/png", "moderator");
  assert.equal(result.reference, "qa/default/test-logo.png");
  assert.equal(f.uploads(), 1);
  assert.deepEqual(f.details(), original);
  assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
  assert.equal(f.merchant().status, "moderation");
  assert.equal(f.audits[0].action, "backoffice_upload_merchant_file");
  assert.doesNotMatch(f.audits[0].details, /qa[/]|sig=|qa-owner|image[/]png/);
  for (const patch of [
    { status: "created" }, { status: "moderation", backofficeMerchantId: "1001" },
    { backofficeMerchantId: null, lastBackofficeError: `${UNCERTAIN_RESULT_PREFIX} reconcile` },
    { lastBackofficeError: null, deletedAt: new Date() },
  ]) {
    f.setMerchant(patch);
    await assert.rejects(f.service.uploadMerchantQaFile("merchant-1", "logo", Buffer.from("synthetic"), "image/png", "moderator"));
  }
  assert.equal(f.uploads(), 1);
});

test("invalid details, unknown taxonomy, linked and uncertain records cannot be changed", async () => {
  const f = fixture();
  const actual = structuredClone(f.details()!);
  for (const input of [
    {}, { ...actual, categoryId: 999 }, { ...actual, userEmail: "bad" },
    { ...actual, branches: [{ ...actual.branches[0], locationId: 999 }] },
    { ...actual, companyName: "unrecognized-field" },
  ]) await assert.rejects(f.service.saveMerchantQaDetails("merchant-1", input, "moderator"));
  f.setMerchant({ backofficeMerchantId: "1001" });
  await assert.rejects(f.service.saveMerchantQaDetails("merchant-1", actual, "moderator"), /locked/);
  assert.equal((await f.service.getMerchantQaDetails("merchant-1")).editable, false);
  f.setMerchant({ backofficeMerchantId: null, lastBackofficeError: `${UNCERTAIN_RESULT_PREFIX} reconcile` });
  await assert.rejects(f.service.saveMerchantQaDetails("merchant-1", actual, "moderator"), /locked/);
  f.setMerchant({ deletedAt: new Date() });
  await assert.rejects(f.service.getMerchantQaDetails("merchant-1"), /not found/);
  await assert.rejects(f.service.saveMerchantQaDetails("merchant-1", actual, "moderator"), /not found/);
  assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
});

test("concurrent creates reuse the ID after serialized row locks", async () => {
  const f = fixture();
  const results = await Promise.all([
    f.service.createMerchant("merchant-1", "moderator"),
    f.service.createMerchant("merchant-1", "moderator"),
  ]);
  assert.equal(results[0].body.id, results[1].body.id);
  assert.equal(f.calls().merchant, 1);
});

test("merchant status guards reject every other unlinked status before the adapter", async () => {
  for (const status of ["pending", "created", "licensing", "licensed", "trained", "archived"]) {
    const f = fixture();
    f.setMerchant({ status });
    await assert.rejects(f.service.createMerchant("merchant-1", "moderator"), (error: unknown) => error instanceof BackofficeHttpError && error.status === 409);
    assert.equal(f.calls().merchant, 0);
    assert.equal((await f.service.getMerchantState("merchant-1")).canCreate, false);
  }
});

test("merchant BackofficeError commits attempt/error only; retry clears error and succeeds", async () => {
  const f = fixture();
  f.setFailure(true);
  const failure = await f.service.createMerchant("merchant-1", "moderator");
  assert.equal(failure.statusCode, 502);
  assert.equal(f.merchant().status, "moderation");
  assert.equal(f.merchant().backofficeMerchantId, null);
  assert.equal(failure.body.lastBackofficeError, "Simulated upstream outage");
  assert.ok(failure.body.lastBackofficeAttemptAt);
  assert.equal(failure.body.canCreate, true);
  assert.equal(f.audits.length, 0);
  f.setFailure(false);
  assert.equal((await f.service.createMerchant("merchant-1", "moderator")).statusCode, 200);
  assert.equal(f.merchant().lastBackofficeError, null);
});

test("offers require a linked merchant; standalone and nested offers advance and deduplicate", async () => {
  for (const source of ["deals", "merchant_deals"] as const) {
    const f = fixture(source);
    assert.equal((await f.service.getOfferState("offer-1")).blockedReason, "Create the merchant first");
    await assert.rejects(f.service.createOffer("offer-1", "moderator"), (error: unknown) => error instanceof BackofficeHttpError && error.status === 409);
    assert.equal(f.calls().offer, 0);
    f.setRealResult();
    await f.service.createMerchant("merchant-1", "moderator");
    assert.equal((await f.service.getOfferState("offer-1")).canCreate, true);
    const results = await Promise.all([f.service.createOffer("offer-1", "moderator"), f.service.createOffer("offer-1", "moderator")]);
    assert.equal(results[0].body.id, results[1].body.id);
    assert.equal(results[0].body.status, "licensing");
    assert.ok(results[0].body.backofficeCreatedAt);
    assert.equal(f.calls().offer, 1);
    assert.equal(f.audits.length, 2);
    assert.equal(JSON.parse(f.audits[1].details).requestSource, source);
    assert.ok(f.locks.includes("offer:offer-1"));
  }
});

test("offer failure preserves status, persists error and allows retry", async () => {
  const f = fixture();
  f.setRealResult();
  await f.service.createMerchant("merchant-1", "moderator");
  f.setFailure(true);
  const failure = await f.service.createOffer("offer-1", "moderator");
  assert.equal(failure.statusCode, 502);
  assert.equal(f.offer().status, "pending");
  assert.equal(f.offer().backofficeOfferId, null);
  assert.ok(failure.body.lastBackofficeAttemptAt);
  assert.equal(failure.body.canCreate, true);
  f.setFailure(false);
  assert.equal((await f.service.createOffer("offer-1", "moderator")).statusCode, 200);
  assert.equal(f.offer().lastBackofficeError, null);
});

test("failed post-create image verification retains QA ID and prevents duplicate creation", async () => {
  const f = fixture("merchant_deals", async (parent) => syntheticOfferOptions(parent), false,
    async () => { throw new Error("private image failure"); });
  f.setMerchant({ backofficeMerchantId: "1001", status: "created" });
  f.setRealResult();
  const outcome = await f.service.createOffer("offer-1", "moderator");
  assert.equal(outcome.statusCode, 502);
  assert.equal(outcome.body.id, "2001");
  assert.match(outcome.body.error ?? "", /images could not be verified/);
  assert.equal(f.offer().backofficeOfferId, "2001");
  assert.equal(f.offer().status, "licensing");
  assert.equal((await f.service.getOfferState("offer-1")).canCreate, false);
  await f.service.createOffer("offer-1", "moderator");
  assert.equal(f.calls().offer, 1);
});

test("legacy/unlinked standalone merchants show the prerequisite instead of guessing by name", async () => {
  const f = fixture("deals");
  for (const merchantId of [null, "external-merchant-not-a-portal-request"]) {
    f.setOffer({ merchantId });
    const state = await f.service.getOfferState("offer-1");
    assert.equal(state.canCreate, false);
    assert.equal(state.blockedReason, "Create the merchant first");
    await assert.rejects(f.service.createOffer("offer-1", "moderator"),
      (e: unknown) => e instanceof BackofficeHttpError && e.status === 409);
  }
  assert.equal(f.calls().offer, 0);
});

test("actual offer details save without remote creation, bind the parent and reject foreign taxonomy/branches", async () => {
  for (const source of ["deals", "merchant_deals"] as const) {
    const f = fixture(source);
    f.setMerchant({ backofficeMerchantId: "1001", status: "created" });
    const actual = structuredClone(f.offerDetails()!);
    f.clearOfferDetails();
    assert.equal((await f.service.getOfferState("offer-1")).canCreate, false);
    await assert.rejects(f.service.createOffer("offer-1", "moderator"), /actual QA details/);
    const initial = await f.service.getOfferQaDetails("offer-1");
    assert.equal(initial.prefill.titleAr, "عرض تجريبي");
    assert.equal(initial.prefill.startDate, "2026-10-21");
    assert.deepEqual(initial.prefill.images, []);
    assert.equal(initial.prefill.price, undefined);
    for (const input of [
      { ...actual, parentMerchantProfileId: "1002" },
      { ...actual, branchIds: [999] }, { ...actual, categoryIds: [999] },
      { ...actual, subCategoryIds: [999] }, { ...actual, offerTypeId: 999 },
      { ...actual, claimRuleIds: [999] }, { ...actual, paymentConditionIds: [999] },
      { ...actual, images: ["/portal-file.png"] }, { ...actual, merchantProfileId: 999 },
    ]) await assert.rejects(f.service.saveOfferQaDetails("offer-1", input, "moderator"));
    const saved = await f.service.saveOfferQaDetails("offer-1", actual, "moderator");
    assert.deepEqual(saved.details, actual);
    assert.equal((await f.service.getOfferState("offer-1")).canCreate, true);
    assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
    assert.equal(f.offer().status, "pending");
    assert.equal(f.audits[0].action, "backoffice_update_offer_details");
    assert.doesNotMatch(f.audits[0].details, /عرض|Synthetic terms|qa[/]/);
    f.setMerchant({ backofficeMerchantId: "1002" });
    assert.equal((await f.service.getOfferState("offer-1")).canCreate, false);
    await assert.rejects(f.service.createOffer("offer-1", "moderator"), /parentMerchantProfileId/);
    assert.equal(f.calls().offer, 0);
  }
});

test("offer uploads and detail edits reject archived/linked/uncertain/deleted and simulated-parent records", async () => {
  const f = fixture();
  f.setMerchant({ backofficeMerchantId: "1001" });
  assert.equal((await f.service.uploadOfferQaImage("offer-1", Buffer.from("synthetic"), "image/png", "moderator")).reference, syntheticImageKey);
  assert.equal(f.offerUploads(), 1);
  assert.equal(f.audits[0].action, "backoffice_upload_offer_image");
  assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
  for (const patch of [
    { status: "archived" }, { status: "licensing" }, { status: "published" },
    { status: "pending", backofficeOfferId: "2001" },
    { backofficeOfferId: null, lastBackofficeError: `${UNCERTAIN_RESULT_PREFIX} test` },
  ]) {
    f.setOffer(patch);
    await assert.rejects(f.service.uploadOfferQaImage("offer-1", Buffer.from("synthetic"), "image/png", "moderator"));
    await assert.rejects(f.service.saveOfferQaDetails("offer-1", syntheticOfferDetails(), "moderator"));
    assert.equal((await f.service.getOfferQaDetails("offer-1")).editable, false);
  }
  f.setOffer({ lastBackofficeError: null });
  f.setMerchant({ backofficeMerchantId: "dry-run-merchant-test" });
  assert.equal((await f.service.getOfferState("offer-1")).canCreate, false);
  await assert.rejects(f.service.createOffer("offer-1", "moderator"), /real QA merchant/);
  f.setMerchant({ backofficeMerchantId: "1001", deletedAt: new Date() });
  for (const action of [
    () => f.service.getOfferQaDetails("offer-1"), () => f.service.getOfferQaOptions("offer-1"),
    () => f.service.uploadOfferQaImage("offer-1", Buffer.from("synthetic"), "image/png", "moderator"),
    () => f.service.saveOfferQaDetails("offer-1", syntheticOfferDetails(), "moderator"),
  ]) await assert.rejects(action(), (e: unknown) => e instanceof BackofficeHttpError && e.status === 404);
  assert.equal(f.offerUploads(), 1);
});

test("missing requests and soft-deleted merchants are never exposed or created", async () => {
  const f = fixture();
  await assert.rejects(f.service.getOfferState("absent"), (e: unknown) => e instanceof BackofficeHttpError && e.status === 404);
  f.setMerchant({ deletedAt: new Date() });
  for (const action of [
    () => f.service.getMerchantState("merchant-1"), () => f.service.getOfferState("offer-1"),
    () => f.service.createMerchant("merchant-1", "moderator"), () => f.service.createOffer("offer-1", "moderator"),
  ]) await assert.rejects(action(), (e: unknown) => e instanceof BackofficeHttpError && e.status === 404);
  assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
});

test("success and audit are atomic; failed audit rolls back local linkage/status", async () => {
  const f = fixture();
  f.setAuditFailure();
  await assert.rejects(f.service.createMerchant("merchant-1", "moderator"), /Audit unavailable/);
  assert.equal(f.merchant().status, "moderation");
  assert.equal(f.merchant().backofficeMerchantId, null);
  assert.equal(f.audits.length, 0);
});

test("a simulated real-QA success followed by local audit failure blocks duplicate creation", async () => {
  for (const kind of ["merchant", "offer"] as const) {
    const f = fixture();
    f.setRealResult();
    if (kind === "offer") f.setMerchant({ backofficeMerchantId: "1001", status: "created" });
    f.setAuditFailure();
    const result = kind === "merchant"
      ? await f.service.createMerchant("merchant-1", "moderator")
      : await f.service.createOffer("offer-1", "moderator");
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.canCreate, false);
    assert.match(result.body.lastBackofficeError ?? "", /QA_RESULT_UNCERTAIN/);
    const retry = kind === "merchant"
      ? f.service.createMerchant("merchant-1", "moderator")
      : f.service.createOffer("offer-1", "moderator");
    await assert.rejects(retry, (e: unknown) => e instanceof BackofficeHttpError && e.status === 409);
    assert.equal(f.calls()[kind], 1);
  }
});

test("field mapping covers bilingual content, group brands, prices, terms, dates and images", () => {
  const f = fixture("deals");
  const merchant = mapMerchant({ ...f.merchant(), companyType: "group" }, [{ id: "brand-1", merchantId: "merchant-1", brandName: "Brand One", crNumber: "CR9999" } as MerchantBrand]);
  assert.equal(merchant.companyName, "Test Merchant");
  assert.equal(merchant.commercialRegistrationNumber, "CR1234");
  assert.equal(merchant.contact.email, "test@example.invalid");
  assert.equal(merchant.brands[0].crNumber, "CR9999");
  assert.equal(merchant.brands[0].sourceBrandId, "brand-1");
  for (const source of ["deals", "merchant_deals"] as const) {
    const offer = mapOffer(fixture(source).offer());
    assert.equal(offer.titleAr, "عرض تجريبي");
    assert.equal(offer.pricing.discountPercentage, "20");
    assert.equal(offer.validity.startDate, "2026-10-21");
    assert.equal(offer.validity.endDate, "2026-12-31");
    assert.deepEqual(offer.terms.claimRules, ["Claim first"]);
    assert.deepEqual(offer.images, ["/test-image.jpg"]);
  }
  for (const dealType of ["bogo", "discount", "bundle", "voucher"]) {
    assert.equal(mapOffer({ ...f.offer(), dealType }).dealType, dealType);
  }
});

test("public/edit input schemas exclude server-managed backoffice fields", () => {
  const injection = { backofficeMerchantId: "forged", backofficeOfferId: "forged", backofficeCreatedAt: new Date(), lastBackofficeError: "forged", lastBackofficeAttemptAt: new Date() };
  assert.deepEqual(insertDealSchema.partial().parse(injection), {});
  assert.deepEqual(insertMerchantDealSchema.partial().parse(injection), {});
  const parsed = insertMerchantSchema.safeParse({ ...fixture().merchant(), ...injection, address: "Doha" });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal("backofficeMerchantId" in parsed.data, false);
});

test("dry run sends nothing; real QA requires its separate guard and a non-simulated parent", async () => {
  const config: BackofficeConfig = { dryRun: true };
  const adapter = createBackofficeClient(() => config);
  const source = mapMerchant(fixture().merchant());
  const offerSource = mapOffer(fixture().offer());
  assert.equal(adapter.isBackofficeDryRun(), true);
  const merchant = await adapter.createMerchantInBackoffice(source);
  assert.match(merchant.id, /^dry-run-merchant-/);
  assert.equal((await adapter.createOfferInBackoffice(merchant.id, offerSource)).dryRun, true);
  config.dryRun = false;
  await assert.rejects(adapter.createMerchantInBackoffice(source), BackofficeError);
  await assert.rejects(adapter.createOfferInBackoffice(merchant.id, offerSource), /simulated ID/);
  config.baseUrl = QA_API_ORIGIN;
  config.apiToken = "unit-test-placeholder-not-a-credential";
  await assert.rejects(adapter.createMerchantInBackoffice(source), /disabled/);
});

test("ambiguous QA results block merchant and offer retries until reconciliation", async () => {
  const marker = `${UNCERTAIN_RESULT_PREFIX} Check existing QA ID before retrying.`;
  const f = fixture();
  f.setMerchant({ lastBackofficeError: marker });
  assert.equal((await f.service.getMerchantState("merchant-1")).canCreate, false);
  await assert.rejects(f.service.createMerchant("merchant-1", "moderator"),
    (e: unknown) => e instanceof BackofficeHttpError && e.status === 409);
  f.setMerchant({ lastBackofficeError: null, backofficeMerchantId: "1001" });
  f.setOffer({ lastBackofficeError: marker });
  assert.equal((await f.service.getOfferState("offer-1")).canCreate, false);
  await assert.rejects(f.service.createOffer("offer-1", "moderator"),
    (e: unknown) => e instanceof BackofficeHttpError && e.status === 409);
  assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
});

test("HTTP routes enforce auth/roles and return state, 409, 502 and idempotent IDs", async () => {
  const f = fixture();
  const app = express();
  app.use(express.json());
  // Test-only session middleware on an isolated server; real app auth is unchanged.
  app.use((req, _res, next) => {
    req.session = { role: req.header("X-Test-Role"), username: "test-actor", userId: req.header("X-Test-Role") ? "test-user" : undefined } as any;
    next();
  });
  registerBackofficeRoutes(app, (req, res, next) => {
    if (!req.session.userId) res.status(401).json({ error: "Unauthorized" }); else next();
  }, f.service);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const request = (path: string, role = "moderation", method = "POST", body?: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/${path}`, {
      method, headers: { ...(role ? { "X-Test-Role": role } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    for (const path of ["merchant-requests/merchant-1/create-merchant", "deal-requests/offer-1/create-offer"]) {
      assert.equal((await request(path, "")).status, 401);
      for (const role of ["sales", "user", "unknown"]) assert.equal((await request(path, role)).status, 403);
    }
    assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
    for (const [path, method] of [
      ["merchant-requests/merchant-1/qa-details", "GET"],
      ["merchant-requests/merchant-1/qa-details", "PUT"],
      ["backoffice/merchant-options", "GET"],
      ["merchant-requests/merchant-1/qa-files/logo", "POST"],
      ["deal-requests/offer-1/qa-details", "GET"],
      ["deal-requests/offer-1/qa-details", "PUT"],
      ["deal-requests/offer-1/qa-options", "GET"],
      ["deal-requests/offer-1/qa-images", "POST"],
      ["deal-requests/offer-1/qa-prepare", "POST"],
    ]) {
      assert.equal((await request(path, "", method)).status, 401);
      assert.equal((await request(path, "sales", method)).status, 403);
    }
    const blockedPreparation = await request("deal-requests/offer-1/qa-prepare", "moderation", "POST", { details: {}, useSourceImages: false });
    assert.equal(blockedPreparation.status, 409);
    assert.equal(blockedPreparation.headers.get("cache-control"), "no-store");
    assert.equal((await blockedPreparation.json()).error, "Create the merchant first");
    const actual = structuredClone(f.details()!);
    const uploaded = await fetch(`http://127.0.0.1:${address.port}/api/merchant-requests/merchant-1/qa-files/logo`, {
      method: "POST", headers: { "X-Test-Role": "moderation", "Content-Type": "image/png" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.headers.get("cache-control"), "no-store");
    assert.equal((await uploaded.json()).reference, "qa/default/test-logo.png");
    assert.equal(f.uploads(), 1);
    assert.deepEqual(f.details(), actual);
    f.clearDetails();
    assert.equal((await request("merchant-requests/merchant-1/create-merchant")).status, 409);
    const detailsResponse = await request("merchant-requests/merchant-1/qa-details", "moderation", "GET");
    assert.equal(detailsResponse.status, 200);
    assert.equal(detailsResponse.headers.get("cache-control"), "no-store");
    const detailBody = await detailsResponse.json();
    assert.equal(detailBody.prefill.agencyName, "Test Brand");
    assert.notEqual(detailBody.prefill.agencyName, "Test Merchant");
    assert.equal((await request("merchant-requests/merchant-1/qa-details", "moderation", "PUT", {})).status, 400);
    const saved = await request("merchant-requests/merchant-1/qa-details", "moderation", "PUT", actual);
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).details, actual);
    assert.deepEqual(f.calls(), { merchant: 0, offer: 0 });
    assert.equal((await request("merchant-requests/merchant-1/backoffice", "sales", "GET")).status, 403);
    assert.equal((await request("deal-requests/offer-1/backoffice", "moderation", "GET")).status, 200);
    assert.equal((await request("deal-requests/offer-1/create-offer")).status, 409);
    f.setFailure(true);
    const failed = await request("merchant-requests/merchant-1/create-merchant");
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).error, "Simulated upstream outage");
    f.setFailure(false);
    const created = await request("merchant-requests/merchant-1/create-merchant", "admin");
    assert.equal(created.status, 200);
    const repeat = await request("merchant-requests/merchant-1/create-merchant");
    assert.equal((await repeat.json()).id, (await created.json()).id);
    f.setMerchant({ backofficeMerchantId: "1001" });
    const offerDetailsResponse = await request("deal-requests/offer-1/qa-details", "moderation", "GET");
    assert.equal(offerDetailsResponse.status, 200);
    assert.equal(offerDetailsResponse.headers.get("cache-control"), "no-store");
    assert.equal((await request("deal-requests/offer-1/qa-options", "moderation", "GET")).status, 200);
    assert.equal((await request("deal-requests/offer-1/qa-details", "moderation", "PUT", {})).status, 400);
    assert.equal((await request("deal-requests/offer-1/qa-details", "moderation", "PUT", syntheticOfferDetails())).status, 200);
    const imageResponse = await fetch(`http://127.0.0.1:${address.port}/api/deal-requests/offer-1/qa-images`, {
      method: "POST", headers: { "X-Test-Role": "moderation", "Content-Type": "image/png" }, body: Buffer.from("synthetic"),
    });
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("cache-control"), "no-store");
    assert.equal((await request("deal-requests/offer-1/create-offer")).status, 200);
    assert.equal((await request("merchant-requests/merchant-1/qa-details", "admin", "PUT", actual)).status, 409);
    f.setMerchant({ deletedAt: new Date() });
    assert.equal((await request("merchant-requests/merchant-1/qa-details", "admin", "GET")).status, 404);
    assert.equal(f.audits[0].username, "test-actor");
    assert.equal((await request("merchant-requests/absent/create-merchant")).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
