import type { OfferQaDetails, OfferQaOptions } from "@shared/offerQaDetails";

// Synthetic examples only; never imported by runtime server routes.
export const syntheticImageKey = "qa/00000000-0000-4000-8000-000000000001/test-image.webp";
export function syntheticOfferDetails(overrides: Partial<OfferQaDetails> = {}): OfferQaDetails {
  return {
    parentMerchantProfileId: "1001",
    title: "Test Offer", titleAr: "عرض تجريبي", description: "Synthetic fixture", descriptionAr: "وصف تجريبي",
    termsAndConditions: "Synthetic terms", categoryIds: [201], subCategoryIds: [202], offerTypeId: 401,
    branchIds: [501], claimRuleIds: [601], paymentConditionIds: [701],
    price: 10, offerDuration: 30, estimatedSavings: 5, redemptionType: 1, redemptionLimit: null,
    startDate: "2026-10-21", endDate: "2026-12-31", images: [syntheticImageKey], ...overrides,
  };
}
export function syntheticOfferOptions(parent: string | null = "1001"): OfferQaOptions {
  return {
    merchantProfileId: parent, branchIssue: parent ? null : "Link a real QA merchant.",
    categories: [{ id: 201, name: "Synthetic category", subCategories: [{ id: 202, name: "Synthetic subcategory" }] }],
    offerTypes: [{ id: 401, name: "Synthetic type" }], branches: parent ? [{ id: 501, name: "Synthetic branch" }] : [],
    claimRules: [{ id: 601, name: "Synthetic claim rule" }], paymentConditions: [{ id: 701, name: "Synthetic payment condition" }],
  };
}
