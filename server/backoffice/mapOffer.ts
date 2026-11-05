import type { Deal, MerchantDeal } from "@shared/schema";
import { checkPayload, offerPayloadSchema, type OfferPayload } from "./contracts";

// id -> sourceRequestId; merchantId/brandId -> source merchant/brand references;
// title/Ar, description/Ar -> bilingual content; dealType -> bogo/discount/bundle/voucher;
// category/subCategory -> taxonomy; originalPrice/discountPercentage/discountedPrice
// -> pricing; claimRules/generalRules/otherRules -> terms; dates -> validity;
// duration/redemption/limitPerUser/tranches/specificDays/days/branches -> redemption;
// images -> images; estimatedSavings/notes -> savings. No unsupported type guessing.
export function mapOffer(offer: Deal | MerchantDeal) {
  return {
    sourceRequestId: offer.id,
    sourceMerchantId: offer.merchantId,
    sourceBrandId: "brandId" in offer ? offer.brandId : null,
    title: offer.title, titleAr: offer.titleAr,
    description: offer.description, descriptionAr: offer.descriptionAr,
    dealType: offer.dealType, category: offer.category, subCategory: offer.subCategory,
    pricing: { originalPrice: offer.originalPrice, discountPercentage: offer.discountPercentage, discountedPrice: offer.discountedPrice, isMultipleItems: offer.isMultipleItems },
    terms: { claimRules: offer.claimRules, generalRules: offer.generalRules, otherRules: offer.otherRules },
    validity: {
      startDate: "offerStartDate" in offer ? offer.offerStartDate : offer.startDate,
      endDate: "offerEndDate" in offer ? offer.offerEndDate : offer.endDate,
      duration: offer.duration, specificDays: offer.specificDays, days: offer.days ?? [],
      isTwoTranches: offer.isTwoTranches, trancheValidity: offer.trancheValidity,
    },
    redemption: offer.redemption, limitPerUser: offer.limitPerUser,
    branches: offer.branches, images: offer.images ?? [],
    savings: { estimatedSavings: offer.estimatedSavings, note: offer.estimatedSavingsNote, noteAr: offer.estimatedSavingsNoteAr },
  };
}

export type OfferSource = ReturnType<typeof mapOffer>;

// Confirmed QA POST /admin/offers mapping:
// title/description -> same fields; terms arrays -> termsAndConditions;
// validity dates -> startDate/endDate; images -> [{uri, sortOrder}];
// stored backoffice merchant ID -> merchantProfileId (NOT agencyId/moderation ID).
// Numeric category/type/branch/rule/payment IDs and unmapped price/duration/
// redemption variants require explicit mappings, not guessed codes.
export function prepareOfferPayload(source: OfferSource, merchantId: string, mapping: Partial<OfferPayload> = {}) {
  const payload: Record<string, unknown> = {
    images: source.images.map((uri, index) => ({ uri, sortOrder: index + 1 })),
    title: source.title,
    titleAr: source.titleAr ?? "",
    description: source.description ?? "",
    descriptionAr: source.descriptionAr ?? "",
    termsAndConditions: [...source.terms.claimRules, ...source.terms.generalRules, source.terms.otherRules].filter(Boolean).join("\n"),
    startDate: source.validity.startDate,
    endDate: source.validity.endDate,
    redemptionLimit: null, redemptionLimitPeriod: null,
    validDays: [], tagIds: [], trancheValidity: null,
    ...mapping,
    // Do not let an offer mapping override the merchant actually linked in DB.
    merchantProfileId: /^[1-9]\d*$/.test(merchantId) ? Number(merchantId) : undefined,
  };
  const issues: string[] = [];
  if (source.validity.specificDays) issues.push("validDays (non-empty weekday encoding is not confirmed)");
  if (source.validity.isTwoTranches) issues.push("trancheValidity (non-null encoding is not confirmed)");
  if (source.limitPerUser && mapping.redemptionLimit == null) issues.push("redemptionLimit");
  if (!mapping.claimRuleIds) issues.push("claimRuleIds");
  if (!mapping.paymentConditionIds) issues.push("paymentConditionIds");
  return checkPayload(offerPayloadSchema, payload, issues);
}
