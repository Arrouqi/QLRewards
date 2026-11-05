import assert from "node:assert/strict";
import test from "node:test";
import { merchantQaDetailsSchema, type MerchantQaDetails } from "@shared/merchantQaDetails";
import { prepareMerchantPayload, mapMerchant } from "./mapMerchant";
import { createMerchantOptionsLoader } from "./options";
import type { Merchant, MerchantBrand } from "@shared/schema";

const details: MerchantQaDetails = {
  agencyName: "Actual Brand", agencyEmail: "business@example.invalid",
  contactMobile: "00000000", contactWhatsapp: "00000000",
  agencyLogoUri: "https://files.example.invalid/logo.webp", coverPhoto: "https://files.example.invalid/cover.webp",
  aboutAgency: "A synthetic business description.", crNumber: "CR1234", crUri: "https://files.example.invalid/cr.pdf",
  agencyId: 0, userEmail: "actual-owner@example.invalid", categoryId: 1, isPriceList: false,
  workingHours: Object.fromEntries(["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]
    .map((day) => [day, { closed: false, open: "09:00", close: "17:00" }])) as MerchantQaDetails["workingHours"],
  branches: [{ name: "Actual branch", locationId: 1, locationUri: "https://maps.example.invalid/a", contactMobile: "00000000", pin: "", pinEnabled: false, qrEnabled: true }],
};

test("same mapping rules use each merchant's actual brand and business details, not company name", () => {
  for (const id of ["first", "second"]) {
    const source = mapMerchant({
      id, companyName: `Legal Company ${id}`, brandName: `Brand ${id}`, companyType: "individual",
      email: `${id}@example.invalid`, phone: `phone-${id}`, crNumber: `CR-${id}`,
    } as Merchant);
    const result = prepareMerchantPayload(source, {
      ...details, agencyName: `Brand ${id}`, agencyEmail: `${id}@example.invalid`, contactMobile: `phone-${id}`, crNumber: `CR-${id}`,
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.payload.agencyName, `Brand ${id}`);
    assert.equal(result.payload.agencyEmail, `${id}@example.invalid`);
    assert.equal(result.payload.contactMobile, `phone-${id}`);
    assert.equal(result.payload.crNumber, `CR-${id}`);
    assert.equal(result.payload.userEmail, details.userEmail);
  }
});

test("group profile must be explicitly chosen from the group's real submitted identities", () => {
  const source = mapMerchant({
    id: "group", companyType: "group", companyName: "Group", email: "group@example.invalid", phone: "00000000",
  } as Merchant, [{ brandName: "Submitted brand", email: "brand@example.invalid", phone: "11111111", crNumber: "BRAND" } as MerchantBrand]);
  assert.match(prepareMerchantPayload(source, { ...details, agencyName: "" }).issues.join(), /agencyName/);
  assert.match(prepareMerchantPayload(source, { ...details, agencyName: "Unknown" }).issues.join(), /agencyName/);
  const brand = prepareMerchantPayload(source, { ...details, agencyName: "Submitted brand" });
  assert.deepEqual(brand.issues, []);
  assert.equal(brand.payload.agencyEmail, details.agencyEmail);
  assert.equal(brand.payload.crNumber, details.crNumber);
});

test("actual details reject missing choices, invalid hours/maps, disabled PIN ambiguity and unknown fields", () => {
  assert.equal(merchantQaDetailsSchema.safeParse(details).success, true);
  for (const input of [
    { ...details, userEmail: "" }, { ...details, isPriceList: null },
    { ...details, categoryId: 0 }, { ...details, agencyId: -1 },
    { ...details, branches: [] }, { ...details, workingHours: {} },
    { ...details, companyName: "unknown-field" },
    { ...details, branches: [{ ...details.branches[0], locationUri: "javascript:alert(1)" }] },
    { ...details, branches: [{ ...details.branches[0], pinEnabled: true, pin: "" }] },
    { ...details, workingHours: { ...details.workingHours, saturday: { closed: false, open: "25:00", close: "" } } },
  ]) assert.equal(merchantQaDetailsSchema.safeParse(input).success, false);
});

test("hours and non-CR documents are optional; every listed mandatory profile field is enforced", () => {
  const { workingHours: _hours, ...withoutHours } = details;
  assert.equal(merchantQaDetailsSchema.safeParse(withoutHours).success, true);
  const source = mapMerchant({ id: "a", companyType: "individual", companyName: "Legal", brandName: "Actual Brand" } as Merchant);
  const prepared = prepareMerchantPayload(source, withoutHours);
  assert.deepEqual(prepared.issues, []);
  assert.equal(Object.hasOwn(prepared.payload, "workingHours"), false);
  assert.equal(prepared.payload.establishmentCardCode, "");
  assert.equal(prepared.payload.taxCardUri, "");
  for (const field of [
    "userEmail", "agencyName", "agencyEmail", "contactMobile", "contactWhatsapp",
    "agencyLogoUri", "coverPhoto", "aboutAgency", "crNumber", "crUri",
  ]) {
    assert.equal(merchantQaDetailsSchema.safeParse({ ...withoutHours, [field]: "" }).success, false, field);
  }
});

test("read-only taxonomy uses fixed QA URL, minimizes returned fields, caches and deduplicates", async () => {
  let calls = 0;
  let time = 0;
  const load = createMerchantOptionsLoader({ getToken: async () => "synthetic", invalidate: () => {} }, async (url, init) => {
    calls++;
    assert.equal(String(url), "https://qlr-bo-qa.qatarliving.com/filters");
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    return Response.json({ categories: [{ id: 1, name: "Food", private: "not-returned" }], locations: [{ id: 2, name: "Doha" }], other: "not-returned" });
  }, () => time);
  assert.deepEqual(await load(), { categories: [{ id: 1, name: "Food" }], locations: [{ id: 2, name: "Doha" }] });
  await Promise.all([load(), load()]);
  assert.equal(calls, 1);
  time += 300_001;
  await load();
  assert.equal(calls, 2);
});

test("taxonomy auth/errors are sanitized and never replay requests", async () => {
  let invalidations = 0;
  let calls = 0;
  const load = createMerchantOptionsLoader({
    getToken: async () => "synthetic", invalidate: () => { invalidations++; },
  }, async () => {
    calls++;
    return new Response("PRIVATE-RESPONSE", { status: 401 });
  });
  await assert.rejects(load(), (error: Error) => {
    assert.match(error.message, /Unable to load QA/);
    assert.doesNotMatch(error.message, /PRIVATE/);
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(invalidations, 1);
});
