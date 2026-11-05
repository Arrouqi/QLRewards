import assert from "node:assert/strict";
import test from "node:test";
import { backofficeTarget, backofficeTargets, backofficeWritesEnabled, scopedSettingKey } from "./environment";
import { createQaTokenProvider } from "./auth";
import { createQaFileUploader } from "./uploads";
import { createOfferImageUploader } from "./offerUploads";
import { createBackofficeClient } from "./client";
import { mapMerchant } from "./mapMerchant";
import { mapOffer } from "./mapOffer";
import { syntheticOfferDetails } from "./offerTestHelpers";
import type { Merchant, MerchantDeal } from "@shared/schema";
import type { MerchantQaDetails } from "@shared/merchantQaDetails";

// Run separately with BACKOFFICE_TARGET=production. All HTTP is injected.
const production = { skip: backofficeTarget.environment !== "production" };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const token = { getToken: async () => "synthetic-token", invalidate() {} };
const folder = "00000000-0000-4000-8000-000000000001";

test("production writes require production runtime and a distinct opt-in", production, () => {
  assert.equal(backofficeWritesEnabled({ BACKOFFICE_DRY_RUN: "false", BACKOFFICE_QA_WRITES_ENABLED: "true", NODE_ENV: "production" }), false);
  assert.equal(backofficeWritesEnabled({ BACKOFFICE_DRY_RUN: "false", BACKOFFICE_PRODUCTION_WRITES_ENABLED: "true", NODE_ENV: "development" }), false);
  assert.equal(backofficeWritesEnabled({ BACKOFFICE_DRY_RUN: "true", BACKOFFICE_PRODUCTION_WRITES_ENABLED: "true", NODE_ENV: "production" }), false);
  assert.equal(backofficeWritesEnabled({ BACKOFFICE_DRY_RUN: "false", BACKOFFICE_PRODUCTION_WRITES_ENABLED: "true", NODE_ENV: "production" }), true);
  assert.equal(scopedSettingKey("qa_offer_details:test"), "production:qa_offer_details:test");
});
test("production login uses only the observed production host and Origin", production, async () => {
  const provider = createQaTokenProvider(() => ({ username: "synthetic", password: "synthetic" }), async (url, init) => {
    assert.equal(String(url), backofficeTargets.production.loginUrl);
    assert.equal(new Headers(init?.headers).get("Origin"), "https://backoffice.qatarliving.com");
    assert.equal(init?.redirect, "error");
    return Response.json({ token: "synthetic-token" });
  }, Date.now, backofficeTargets.production);
  assert.equal(await provider.getToken(), "synthetic-token");
});
test("production merchant files sign and upload only to shared production storage", production, async () => {
  for (const kind of ["logo", "cover", "cr"]) {
    let puts = 0;
    const upload = createQaFileUploader(token, async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "GET") {
        assert.equal(url.origin, "https://ql-shared-prod.qatarliving.com");
        const path = url.searchParams.get("path");
        const container = kind === "cr" ? "license-files" : "logos";
        return Response.json([{ path, signedUrl: `${backofficeTarget.merchantStorage}/${container}/prod/${path}?sig=synthetic` }]);
      }
      puts++;
      assert.equal(url.origin, "https://qlsharedstorageprod.blob.core.windows.net");
      assert.equal(new Headers(init?.headers).has("Authorization"), false);
      return new Response(null, { status: 201 });
    }, { writesEnabled: () => true, fileId: () => "synthetic" });
    const result = await upload(kind, png, "image/png");
    assert.match(result.reference, /^prod\//);
    assert.equal(puts, 1);
  }
});
test("production deals sign and upload each image to separate production offer storage", production, async () => {
  let files = 0;
  const upload = createOfferImageUploader(token, async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "GET") {
      assert.equal(url.origin, "https://qlr-bo-prod.qatarliving.com");
      assert.equal(url.pathname, "/images/generateSignedURL");
      const path = url.searchParams.get("path");
      return Response.json([{ path, signedUrl: `${backofficeTarget.offerStorage}/ad-images/prod/${path}?sig=synthetic` }]);
    }
    assert.equal(url.origin, "https://qlrstorageprod.blob.core.windows.net");
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    files++;
    return new Response(null, { status: 201 });
  }, { writesEnabled: () => true, folderId: () => folder, fileId: () => `synthetic-${files}` });
  for (let i = 0; i < 4; i++) assert.match((await upload(png, "image/png", folder)).reference, /^prod\//);
  assert.equal(files, 4);
});
test("production upload rejects a signer returning QA storage before PUT", production, async () => {
  let puts = 0;
  const upload = createQaFileUploader(token, async (input, init) => {
    if (init?.method === "PUT") { puts++; return new Response(null, { status: 201 }); }
    const path = new URL(String(input)).searchParams.get("path");
    return Response.json([{ path, signedUrl: `${backofficeTargets.qa.merchantStorage}/logos/prod/${path}?sig=synthetic` }]);
  }, { writesEnabled: () => true, fileId: () => "synthetic" });
  await assert.rejects(upload("logo", png, "image/png"));
  assert.equal(puts, 0);
});
test("production creates primary merchant/offer IDs, sends every image and rejects QA file keys", production, async () => {
  const merchant = mapMerchant({ id: "synthetic", companyName: "Synthetic", companyType: "individual" } as Merchant);
  const day = { closed: true, open: "", close: "" };
  const details: MerchantQaDetails = {
    agencyId: 0, agencyName: "Synthetic", agencyEmail: "synthetic@example.invalid", userEmail: "synthetic@example.invalid",
    contactMobile: "00000000", contactWhatsapp: "00000000", isPriceList: false,
    agencyLogoUri: "prod/default/logo.png", coverPhoto: "prod/0/cover.png", crUri: "prod/0/cr.pdf",
    crNumber: "SYNTHETIC", aboutAgency: "Synthetic description", categoryId: 1,
    workingHours: { saturday: day, sunday: day, monday: day, tuesday: day, wednesday: day, thursday: day, friday: day },
    branches: [{ name: "Synthetic", locationId: 1, locationUri: "", contactMobile: "00000000", pin: "", pinEnabled: false, qrEnabled: false }],
  };
  const calls: string[] = [];
  const config = { environment: "production" as const, dryRun: false, qaWritesEnabled: true,
    apiToken: "synthetic", authHeader: "Authorization", authScheme: "Bearer" };
  const client = createBackofficeClient(() => config, async (url, init) => {
    calls.push(String(url));
    assert.equal(new URL(String(url)).origin, backofficeTarget.apiOrigin);
    if (String(url).endsWith("/admin/offers")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.images.length, 4);
      assert.deepEqual(body.images.map((image: { sortOrder: number }) => image.sortOrder), [1, 2, 3, 4]);
    }
    return Response.json({ merchantProfileId: 1001, merchantModerationProfileId: 9999, offerId: 2001, offerModerationId: 9998 }, { status: 201 });
  });
  assert.equal((await client.createMerchantInBackoffice(merchant, details)).id, "1001");
  const offer = mapOffer({ id: folder, title: "Synthetic", dealType: "discount", category: "Synthetic", subCategory: "Synthetic", claimRules: [], generalRules: [], images: [], branches: [] } as unknown as MerchantDeal);
  const offerDetails = syntheticOfferDetails("1001");
  offerDetails.images = Array.from({ length: 4 }, (_, i) => `prod/${folder}/synthetic-${i}.png`);
  assert.equal((await client.createOfferInBackoffice("1001", offer, offerDetails)).id, "2001");
  assert.equal(calls.length, 2);
  await assert.rejects(client.createMerchantInBackoffice(merchant, { ...details, agencyLogoUri: "qa/default/logo.png" }), /different backoffice environment/);
  await assert.rejects(createBackofficeClient(() => ({ ...config, baseUrl: backofficeTargets.qa.apiOrigin }), async () => { throw new Error("must not fetch"); })
    .createMerchantInBackoffice(merchant, details), /Only the confirmed Production/);
  assert.equal(calls.length, 2);
});
