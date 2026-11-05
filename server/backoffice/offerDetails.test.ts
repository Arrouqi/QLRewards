import assert from "node:assert/strict";
import test from "node:test";
import { offerQaDetailsSchema, isQaOfferImageKey, qaDateOnly } from "@shared/offerQaDetails";
import { isQaStorageKey } from "@shared/qaFiles";
import { createOfferOptionsLoader } from "./offerOptions";
import { offerOptionIssues } from "./offerDetails";
import { prepareOfferPayload, mapOffer } from "./mapOffer";
import type { MerchantDeal } from "@shared/schema";
import { syntheticImageKey, syntheticOfferDetails, syntheticOfferOptions } from "./offerTestHelpers";

test("actual offer schema binds its parent and accepts optional Arabic without accepting guessed image references", () => {
  const actual = syntheticOfferDetails();
  assert.equal(offerQaDetailsSchema.safeParse(actual).success, true);
  assert.equal(offerQaDetailsSchema.safeParse({ ...actual, titleAr: "", descriptionAr: "" }).success, true);
  assert.equal(isQaOfferImageKey(syntheticImageKey), true);
  assert.equal(isQaStorageKey(syntheticImageKey), false);
  for (const bad of [
    { parentMerchantProfileId: "dry-run-merchant" }, { parentMerchantProfileId: "9007199254740992" },
    { merchantProfileId: 2002 }, { branchIds: [501, 501] }, { images: [] },
    { images: [syntheticImageKey, syntheticImageKey] }, { price: -1 }, { price: Infinity },
    { offerDuration: 0 }, { endDate: "2025-01-01" }, { startDate: "2026-02-30" },
  ]) assert.equal(offerQaDetailsSchema.safeParse({ ...actual, ...bad }).success, false, JSON.stringify(bad));
  for (const value of [
    "/portal.png", "https://qlrstorageqa.blob.core.windows.net/ad-images/file?sig=private",
    "qa/default/file.png", "qa/0/file.png", "qa/../../file.png",
    syntheticImageKey + "?sig=private", syntheticImageKey.replace("test-image", "../test"),
    syntheticImageKey.replace("test-image", "%2ftest"), "data:image/png;base64,AA",
  ]) assert.equal(isQaOfferImageKey(value), false, value);
});

test("date-only fields reject rollover dates and timestamps rather than changing time zones", () => {
  for (const date of ["2024-02-29", "2026-10-26", "2026-01-01"]) assert.equal(qaDateOnly.safeParse(date).success, true);
  for (const date of ["2026-02-29", "2026-04-31", "2026-01-00", "2026-13-01", "2026-01-01T00:00:00Z", "10/26/2026"]) {
    assert.equal(qaDateOnly.safeParse(date).success, false, date);
  }
});

test("confirmed offer payload preserves Arabic and date-only text, one-based image order and the stored primary parent ID", () => {
  const details = syntheticOfferDetails({ images: [syntheticImageKey, syntheticImageKey.replace("test-image", "second-image")] });
  const source = mapOffer({
    id: "local", merchantId: "parent", title: "Test Offer", titleAr: "عنوان",
    description: "Source text", descriptionAr: "وصف", images: details.images,
    claimRules: [], generalRules: [], startDate: "2026-10-21", endDate: "2026-12-31",
  } as unknown as MerchantDeal);
  const mapping = { ...details, merchantProfileId: 9999, images: details.images.map((uri, i) => ({ uri, sortOrder: i + 1 })) };
  const prepared = prepareOfferPayload(source, "1001", mapping);
  assert.deepEqual(prepared.issues, []);
  assert.equal(prepared.payload.merchantProfileId, 1001);
  assert.equal(prepared.payload.titleAr, details.titleAr);
  assert.equal(prepared.payload.descriptionAr, details.descriptionAr);
  assert.equal(prepared.payload.startDate, "2026-10-21");
  assert.equal(prepared.payload.parentMerchantProfileId, undefined);
  assert.deepEqual(prepared.payload.images, mapping.images);
  const original = prepareOfferPayload(source, "1001", { ...mapping, titleAr: undefined, descriptionAr: undefined });
  // Undefined optional mappings do not invent mandatory Arabic content.
  assert.deepEqual(original.issues, []);
  for (const changed of [
    { ...source, validity: { ...source.validity, specificDays: true } },
    { ...source, validity: { ...source.validity, isTwoTranches: true } },
    { ...source, limitPerUser: "2" },
  ]) assert.ok(prepareOfferPayload(changed, "1001", mapping).issues.length > 0);
});

function filterBody() {
  return {
    categories: [{ id: 201, name: "Synthetic category", private: "not-returned", subCategories: [{ id: 202, name: "Synthetic subcategory" }] }],
    offerTypes: [{ id: 401, name: "Synthetic type" }], claimRules: [{ id: 601, name: "Synthetic claim rule" }],
    paymentConditions: [{ id: 701, name: "Synthetic payment condition" }], secret: "not-returned",
  };
}

test("offer option loader uses confirmed read-only endpoints and keeps branches strictly scoped to the linked parent", async () => {
  const calls: string[] = [];
  let time = 0;
  const load = createOfferOptionsLoader({ getToken: async () => "synthetic", invalidate: () => {} }, async (url, init) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    assert.equal(new URL(String(url)).origin, "https://qlr-bo-qa.qatarliving.com");
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string, string>).platform, "0");
    if (path === "/filters") return Response.json(filterBody());
    if (path.startsWith("/admin/merchant-profiles/")) {
      const id = Number(path.split("/").at(-1));
      return Response.json({ merchantProfileId: id, agencyId: id + 2000, private: "not-returned" });
    }
    assert.ok(["/admin/3001/branches", "/admin/3002/branches"].includes(path));
    return Response.json([{ id: path === "/admin/3001/branches" ? 501 : 502, name: "Synthetic branch", private: "not-returned" }]);
  }, () => time);
  const [first, concurrent] = await Promise.all([load("1001"), load("1001")]);
  assert.deepEqual(first, concurrent);
  assert.deepEqual(first, syntheticOfferOptions());
   assert.deepEqual(calls, ["/filters", "/admin/merchant-profiles/1001", "/admin/3001/branches"]);
  const second = await load("1002");
  assert.equal(second.branches[0].id, 502);
  assert.deepEqual(offerOptionIssues(syntheticOfferDetails({ parentMerchantProfileId: "1002" }), second), ["branchIds (must belong to linked QA merchant)"]);
  assert.doesNotMatch(JSON.stringify(first), /secret|private|not-returned/);
  assert.equal((await load("1001")).branches[0].id, 501);
   assert.equal(calls.length, 5);
  time = 61_000;
  await load("1001");
   assert.equal(calls.at(-1), "/admin/3001/branches");
   assert.equal(calls.at(-2), "/admin/merchant-profiles/1001", "Association expires with branches");
  assert.equal(calls.filter((p) => p === "/filters").length, 1);
  for (const id of [null, "dry-run-test", "../1001", "1001?bad", "0", "9007199254740992"]) {
    assert.equal((await load(id)).merchantProfileId, null);
     assert.equal(calls.length, 7);
  }
});

test("unavailable branches never permit arbitrary IDs, and failed option requests do not leak bodies or tokens", async () => {
  let invalidations = 0;
  const load = createOfferOptionsLoader({ getToken: async () => "synthetic", invalidate: () => { invalidations++; } }, async (url) => {
    if (new URL(String(url)).pathname === "/filters") return Response.json(filterBody());
    return new Response("PRIVATE-CONTACT-synthetic-token", { status: 401 });
  });
  const result = await load("1001");
  assert.equal(invalidations, 1);
  assert.deepEqual(result.branches, []);
  assert.match(result.branchIssue!, /Unable to verify/);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|synthetic-token/);
  assert.ok(offerOptionIssues(syntheticOfferDetails(), result).some((v) => v.startsWith("branchIds")));
  const broken = createOfferOptionsLoader({ getToken: async () => "synthetic", invalidate: () => {} }, async () => new Response("PRIVATE", { status: 500 }));
  await assert.rejects(broken("1001"), (e: Error) => {
    assert.match(e.message, /Unable to verify QA offer options/);
    assert.doesNotMatch(e.message, /PRIVATE/);
    return true;
  });
});

test("taxonomy relationships reject a subcategory from an unselected category", () => {
  const options = syntheticOfferOptions();
  options.categories.push({ id: 203, name: "Other", subCategories: [{ id: 204, name: "Other sub" }] });
  assert.ok(offerOptionIssues(syntheticOfferDetails({ subCategoryIds: [204] }), options).some((i) => i.startsWith("subCategoryIds")));
});

test("explicit options refresh bypasses taxonomy and current-parent caches without mixing branches", async () => {
  let version = 1;
  const calls: string[] = [];
  const load = createOfferOptionsLoader({ getToken: async () => "synthetic", invalidate: () => {} }, async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path === "/filters") return Response.json({ ...filterBody(), offerTypes: [{ id: version, name: `Type ${version}` }] });
    if (path.startsWith("/admin/merchant-profiles/")) {
      const id = Number(path.split("/").at(-1));
      return Response.json({ merchantProfileId: id, agencyId: id + 2000 + version });
    }
    return Response.json(path === "/admin/3002/branches" && version === 1 ? [] : [{ id: version, name: `Branch ${version}` }]);
  });
  assert.match((await load("1001")).branchIssue!, /no selectable branches/);
  await load("1002");
  version = 2;
  assert.equal((await load("1001")).branches.length, 0, "Normal reads use bounded caches");
  const refreshed = await load("1001", true);
  assert.equal(refreshed.branchIssue, null);
  assert.equal(refreshed.offerTypes[0].id, 2);
  assert.equal(refreshed.branches[0].id, 2);
  assert.equal(refreshed.merchantProfileId, "1001", "Offer parent remains a profile ID");
  assert.ok(calls.includes("/admin/3003/branches"), "Refresh resolves the changed agency");
  assert.equal(calls.filter((path) => path === "/filters").length, 2);
  assert.equal((await load("1002")).branches[0].id, 1, "Refreshing one parent must not reuse its branches for another");
});
