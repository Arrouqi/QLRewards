import type { Merchant } from "@shared/schema";
import { isCurrentStorageKey } from "./environment";
import type { BackofficeState } from "@shared/backoffice";
import { isQaOfferImageKey, offerQaDetailsSchema, offerQaFieldsSchema, qaOfferImageKeysSchema, type OfferQaDetails, type OfferQaDetailsResponse, type OfferQaOptions } from "@shared/offerQaDetails";
import { createHash } from "node:crypto";
import { z } from "zod";
import { UNCERTAIN_RESULT_PREFIX } from "./client";
import { BackofficeHttpError } from "./errors";
import { mapOffer, prepareOfferPayload } from "./mapOffer";
import { getOfferQaOptions, isRealQaId } from "./offerOptions";
import { uploadOfferImage } from "./offerUploads";
import type { BackofficeRepository, BackofficeUnit, OfferRequest } from "./types";
import { offerSourcePrefill } from "./offerPrefill";
import { isTrustedOfferSourceImage, readSourceOfferImage, sourceImageList } from "./offerSourceImages";

export interface OfferQaTools {
  loadOptions: typeof getOfferQaOptions;
  uploadImage: typeof uploadOfferImage;
  readSourceImage?: typeof readSourceOfferImage;
}
export async function offerContext(unit: BackofficeUnit, id: string, lock = false) {
  const offer = await unit.getOffer(id, lock);
  if (!offer) throw new BackofficeHttpError(404, "Deal not found.");
  const merchant = offer.merchantId ? await unit.getMerchant(offer.merchantId, lock) : undefined;
  if (offer.merchantId && !merchant && await unit.isMerchantDeleted(offer.merchantId)) {
    throw new BackofficeHttpError(404, "Merchant not found.");
  }
  return { offer, merchant };
}
function editableIssue(offer: OfferRequest, merchant: Merchant | undefined): string | null {
  if (offer.backofficeOfferId) return "Already created in the backoffice.";
  if (offer.lastBackofficeError?.startsWith(UNCERTAIN_RESULT_PREFIX)
    || merchant?.lastBackofficeError?.startsWith(UNCERTAIN_RESULT_PREFIX)) return "Check and reconcile the existing QA record before making changes.";
  if (!["pending", "approved", "moderation"].includes(offer.status)) return "Offer must be Pending, Approved or In Moderation.";
  if (!merchant?.backofficeMerchantId) return "Create the merchant first";
  if (!isRealQaId(merchant.backofficeMerchantId)) return "Link a real QA merchant before preparing an offer. Simulated IDs cannot verify branches.";
  return null;
}
export function offerOptionIssues(details: OfferQaDetails, options: OfferQaOptions): string[] {
  const issues: string[] = [];
  if (options.merchantProfileId !== details.parentMerchantProfileId) issues.push("parentMerchantProfileId (QA parent changed)");
  const selectedCategories = options.categories.filter((item) => details.categoryIds.includes(item.id));
  if (selectedCategories.length !== details.categoryIds.length) issues.push("categoryIds");
  const selectedSubcategories = new Set(selectedCategories.flatMap((item) => item.subCategories.map((sub) => sub.id)));
  if (details.subCategoryIds.some((id) => !selectedSubcategories.has(id))) issues.push("subCategoryIds (must belong to selected categories)");
  if (!options.offerTypes.some((item) => item.id === details.offerTypeId)) issues.push("offerTypeId");
  if (options.branchIssue || !options.branches.length) issues.push("branchIds (linked QA merchant branches could not be verified)");
  else if (details.branchIds.some((id) => !options.branches.some((branch) => branch.id === id))) issues.push("branchIds (must belong to linked QA merchant)");
  if (details.claimRuleIds.some((id) => !options.claimRules.some((item) => item.id === id))) issues.push("claimRuleIds");
  if (details.paymentConditionIds.some((id) => !options.paymentConditions.some((item) => item.id === id))) issues.push("paymentConditionIds");
  return issues;
}
function wireMapping(details: OfferQaDetails) {
  return { ...details, images: details.images.map((uri, index) => ({ uri, sortOrder: index + 1 })) };
}
const prepareSchema = z.object({ details: z.record(z.unknown()), useSourceImages: z.boolean().default(false) }).strict();
const fieldNames: Record<string, string> = {
  title: "Deal title", categoryIds: "QA category", subCategoryIds: "QA subcategory", offerTypeId: "QA deal type",
  branchIds: "Merchant branches", price: "Price",
  offerDuration: "offer duration", redemptionType: "QA redemption type",
  estimatedSavings: "Estimated savings", startDate: "Start date", endDate: "End date",
  redemptionLimit: "Redemption limit",
  parentMerchantProfileId: "Linked QA merchant", images: "Deal images",
};
function missingFields(input: unknown) {
  const result = offerQaFieldsSchema.safeParse(input);
  return result.success ? [] : Array.from(new Set(result.error.issues.map((issue) => fieldNames[String(issue.path[0])] ?? String(issue.path[0]))));
}

export class OfferQaWorkflow {
  constructor(private repository: BackofficeRepository, private tools: OfferQaTools = { loadOptions: getOfferQaOptions, uploadImage: uploadOfferImage }) {}

  private async issues(offer: OfferRequest, merchant: Merchant | undefined, details: OfferQaDetails | null, refresh = false) {
    if (!details) return ["qaDetails (save this offer’s actual QA details)"];
    const result = offerQaDetailsSchema.safeParse(details);
    if (!result.success) return Array.from(new Set(result.error.issues.map((issue) => issue.path.join(".") || "qaDetails")));
    const parent = merchant?.backofficeMerchantId ?? "";
    const issues = prepareOfferPayload(mapOffer(offer), parent, wireMapping(details)).issues;
    if (details.parentMerchantProfileId !== parent) issues.push("parentMerchantProfileId (QA parent changed; review and save again)");
    try { issues.push(...offerOptionIssues(details, await this.tools.loadOptions(isRealQaId(parent) ? parent : null, refresh))); }
    catch { issues.push("QA options could not be verified; reload options before creation"); }
    return Array.from(new Set(issues));
  }

  async state(unit: BackofficeUnit, offer: OfferRequest, merchant: Merchant | undefined, base: BackofficeState): Promise<BackofficeState> {
    const details = await unit.getOfferQaDetails(offer);
    const mappingIssues = await this.issues(offer, merchant, details);
    const blockedReason = base.blockedReason ?? editableIssue(offer, merchant)
      ?? (mappingIssues.length ? "Complete and verify this offer’s actual QA details before creation." : null);
    return { ...base, mappingIssues, canCreate: !blockedReason && mappingIssues.length === 0, blockedReason };
  }

  private async response(unit: BackofficeUnit, offer: OfferRequest, merchant: Merchant | undefined): Promise<OfferQaDetailsResponse> {
    const details = await unit.getOfferQaDetails(offer);
    const source = mapOffer(offer);
    const parent = merchant?.backofficeMerchantId ?? null;
    let options: OfferQaOptions | undefined;
    let optionsIssue: string | null = null;
    if (isRealQaId(parent)) {
      try { options = await this.tools.loadOptions(parent); }
      catch { optionsIssue = "QA options could not be loaded. Your submitted details are retained; reload QA options to retry."; }
    }
    const prefill = offerSourcePrefill(source, isRealQaId(parent) ? parent : null, options);
    const { images: _images, ...fields } = { ...prefill, ...details };
    const sourceImages = sourceImageList(source.images, offer);
    return {
      details, offerTitle: source.title,
      merchantProfileId: parent, editable: !editableIssue(offer, merchant),
      editBlockedReason: editableIssue(offer, merchant),
      issues: await this.issues(offer, merchant, details),
      prefill, sourceImages, optionsIssue,
      sourceValues: { price: source.pricing.originalPrice ?? undefined, duration: source.validity.duration ?? undefined, redemption: source.redemption ?? undefined, branches: source.branches ?? [] },
      preparationIssues: [
        ...missingFields(fields).map((field) => `Confirm ${field}; it could not be mapped reliably from the submitted deal.`),
        ...(sourceImages.length < source.images.length ? ["Some submitted images are outside supported storage folders or exceed the 30-image limit. Replace those images or turn off submitted-image reuse."] : []),
      ],
    };
  }

  async get(id: string) {
    return this.repository.transaction(async (unit) => {
      const { offer, merchant } = await offerContext(unit, id);
      return this.response(unit, offer, merchant);
    });
  }
  async options(id: string, refresh = false) {
    return this.repository.transaction(async (unit) => {
      const { merchant } = await offerContext(unit, id);
      const parent = merchant?.backofficeMerchantId;
      return this.tools.loadOptions(isRealQaId(parent) ? parent : null, refresh);
    });
  }
  async save(id: string, input: unknown, username: string) {
    const parsed = offerQaDetailsSchema.safeParse(input);
    if (!parsed.success) {
      const fields = Array.from(new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "qaDetails")));
      throw new BackofficeHttpError(400, `Complete valid offer QA details: ${fields.join(", ")}`);
    }
    return this.repository.transaction(async (unit) => {
      const { offer, merchant } = await offerContext(unit, id, true);
      const reason = editableIssue(offer, merchant);
      if (reason || !merchant) throw new BackofficeHttpError(409, reason ?? "Create the merchant first");
      if (parsed.data.parentMerchantProfileId !== merchant.backofficeMerchantId) throw new BackofficeHttpError(409, "QA parent changed. Reload and review the actual offer details.");
      const issues = await this.issues(offer, merchant, parsed.data);
      if (issues.length) throw new BackofficeHttpError(400, `Review offer QA fields: ${issues.join(", ")}`);
      await unit.saveOfferQaDetails(offer, parsed.data);
      await unit.audit(username, "backoffice_update_offer_details", merchant, JSON.stringify({
        requestId: offer.id, requestSource: offer.source, fields: Object.keys(parsed.data),
      }));
      return this.response(unit, offer, merchant);
    });
  }
  async prepare(id: string, input: unknown, username: string): Promise<OfferQaDetailsResponse> {
    const parsed = prepareSchema.safeParse(input);
    if (!parsed.success) throw new BackofficeHttpError(400, "Review the deal preparation request.");
    // Keep successful transfer checkpoints even if a subsequent image fails.
    // No create call occurs here. The separately guarded create action uses the
    // saved, verified details and checks status/ownership again under its lock.
    const outcome = await this.repository.transaction(async (unit) => {
      const { offer, merchant } = await offerContext(unit, id, true);
      const reason = editableIssue(offer, merchant);
      if (reason || !merchant) throw new BackofficeHttpError(409, reason ?? "Create the merchant first");
      const parent = merchant.backofficeMerchantId!;
      const options = await this.tools.loadOptions(parent, true);
      const saved = await unit.getOfferQaDetails(offer);
      const source = mapOffer(offer);
      const candidate = { ...offerSourcePrefill(source, parent, options), ...saved, ...parsed.data.details };
      if (candidate.parentMerchantProfileId !== parent) throw new BackofficeHttpError(409, "QA parent changed. Reload and review this deal before creating.");
      const { images: rawImages, ...rawFields } = candidate;
      const fields = offerQaFieldsSchema.safeParse(rawFields);
      if (!fields.success) throw new BackofficeHttpError(400, `Complete or confirm: ${missingFields(rawFields).join(", ")}.`);
      const imageKeys = qaOfferImageKeysSchema.safeParse(rawImages ?? []);
      if (!imageKeys.success || imageKeys.data.some((ref) => !isCurrentStorageKey(ref))) throw new BackofficeHttpError(400, "Review existing image references for the selected backoffice environment. Submitted images are reused separately.");
      const sourceImages = parsed.data.useSourceImages ? Array.from(new Set(source.images)) : [];
      if (sourceImages.length > 30 || sourceImages.some((ref) => !(isQaOfferImageKey(ref) && isCurrentStorageKey(ref)) && !isTrustedOfferSourceImage(ref, offer))) {
        throw new BackofficeHttpError(400, "Some submitted images cannot be transferred safely. Replace those images or turn off submitted-image reuse.");
      }
      if (!imageKeys.data.length && !sourceImages.length) throw new BackofficeHttpError(400, "Add a deal image or choose the submitted images.");
      if (imageKeys.data.length + sourceImages.filter((ref) => !imageKeys.data.includes(ref)).length > 30) {
        throw new BackofficeHttpError(400, "Select no more than 30 deal images.");
      }
      const preliminary = { ...fields.data, images: imageKeys.data };
      const issues = [
        ...offerOptionIssues(preliminary, options),
        ...prepareOfferPayload(source, parent, wireMapping(preliminary)).issues.filter((issue) => !issue.startsWith("images")),
      ];
      if (issues.length) throw new BackofficeHttpError(400, `Review deal setup: ${Array.from(new Set(issues)).join(", ")}`);
      const images = [...imageKeys.data];
      const transfers = await unit.getOfferQaTransfers?.(offer) ?? {};
      for (const ref of sourceImages) {
        if (isQaOfferImageKey(ref) && isCurrentStorageKey(ref)) { if (!images.includes(ref)) images.push(ref); continue; }
        const hash = createHash("sha256").update(`${parent}\0${ref}`).digest("hex");
        if (!transfers[hash] || !isQaOfferImageKey(transfers[hash]) || !isCurrentStorageKey(transfers[hash])) {
          if (!unit.saveOfferQaTransfers) throw new BackofficeHttpError(500, "Submitted-image preparation is not available.");
          try {
            const file = await (this.tools.readSourceImage ?? readSourceOfferImage)(ref, offer);
            const uploaded = await this.tools.uploadImage(file.bytes, file.contentType, offer.id);
            if (!isQaOfferImageKey(uploaded.reference) || !isCurrentStorageKey(uploaded.reference)) throw new Error();
            transfers[hash] = uploaded.reference;
          } catch {
            await unit.saveOfferQaTransfers(offer, transfers);
            return { error: new BackofficeHttpError(502, "Submitted images could not all be prepared. Completed images were retained for retry; no deal was created.") };
          }
          await unit.saveOfferQaTransfers(offer, transfers);
        }
        if (!images.includes(transfers[hash])) images.push(transfers[hash]);
      }
      const details = offerQaDetailsSchema.parse({ ...fields.data, images });
      await unit.saveOfferQaDetails(offer, details);
      await unit.audit(username, "backoffice_prepare_deal", merchant, JSON.stringify({ requestId: offer.id, requestSource: offer.source, imageCount: images.length }));
      return { response: await this.response(unit, offer, merchant) };
    });
    if (outcome.error) throw outcome.error;
    return outcome.response!;
  }
  async upload(id: string, bytes: Buffer, contentType: string | undefined, username: string) {
    return this.repository.transaction(async (unit) => {
      const { offer, merchant } = await offerContext(unit, id, true);
      const reason = editableIssue(offer, merchant);
      if (reason || !merchant) throw new BackofficeHttpError(409, reason ?? "Create the merchant first");
      const result = await this.tools.uploadImage(bytes, contentType, offer.id);
      await unit.audit(username, "backoffice_upload_offer_image", merchant, JSON.stringify({
        requestId: offer.id, requestSource: offer.source, bytes: bytes.length,
      }));
      return result;
    });
  }
  async requireReady(unit: BackofficeUnit, offer: OfferRequest, merchant: Merchant) {
    const reason = editableIssue(offer, merchant);
    if (reason) throw new BackofficeHttpError(409, reason);
    const details = await unit.getOfferQaDetails(offer);
    const issues = await this.issues(offer, merchant, details, true);
    if (!details || issues.length) throw new BackofficeHttpError(409, `Complete this offer’s actual QA details before creation: ${issues.join(", ")}`);
    return details;
  }
}
