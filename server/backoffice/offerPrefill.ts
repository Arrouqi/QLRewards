import { isQaOfferImageKey, qaDateOnly, qaOfferDurations, qaRedemptionTypes, type OfferQaDetails, type OfferQaOptions, type QaOption } from "@shared/offerQaDetails";
import type { OfferSource } from "./mapOffer";

// Names are compared only against the current, verified QA options. Normalizing
// presentation does not allow fuzzy matches, first-item fallbacks or fixed IDs.
export function optionName(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
function uniqueMatch(name: string | null | undefined, options: QaOption[], normalize = optionName) {
  if (!name) return undefined;
  const matches = options.filter((entry) => normalize(entry.name) === normalize(name));
  return matches.length === 1 ? matches[0].id : undefined;
}
const ruleName = (value: string) => optionName(value).replace(/[.。]+$/g, "").trim();
function submittedNumber(value: unknown) {
  if (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return undefined;
  const number = Number(value.trim());
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
export function sourceDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return undefined;
  const date = value.slice(0, 10);
  return qaDateOnly.safeParse(date).success ? date : undefined;
}
export function offerSourcePrefill(source: OfferSource, parent: string | null, options?: OfferQaOptions): Partial<OfferQaDetails> {
  const savings = source.savings.estimatedSavings;
  const numericSavings = typeof savings === "string" && savings.trim() ? Number(savings) : undefined;
  const price = submittedNumber(source.pricing.originalPrice);
  const result: Partial<OfferQaDetails> = {
    ...(parent ? { parentMerchantProfileId: parent } : {}),
    title: source.title, titleAr: source.titleAr ?? "", description: source.description ?? "", descriptionAr: source.descriptionAr ?? "",
    termsAndConditions: [...(source.terms.claimRules ?? []), ...(source.terms.generalRules ?? []), source.terms.otherRules].filter(Boolean).join("\n"),
    startDate: sourceDate(source.validity.startDate), endDate: sourceDate(source.validity.endDate),
    ...(numericSavings !== undefined && Number.isFinite(numericSavings) && numericSavings >= 0 ? { estimatedSavings: numericSavings } : {}),
    images: source.images.filter(isQaOfferImageKey),
    ...(price !== undefined ? { price } : {}),
    paymentConditionIds: [], claimRuleIds: [],
  };
  if (source.limitPerUser && /^[1-9]\d*$/.test(source.limitPerUser) && Number.isSafeInteger(Number(source.limitPerUser))) {
    result.redemptionLimit = Number(source.limitPerUser);
  }
  const redemption = optionName(source.redemption ?? "");
  if (redemption === "unlimited") {
    result.redemptionType = qaRedemptionTypes.unlimited;
    result.redemptionLimit = null;
  } else if (redemption === "limited") {
    result.redemptionType = qaRedemptionTypes.limited;
  }
  // QA's duration selector defines category codes, not a count derived from
  // start/end dates. Only explicit, unambiguous submitted labels are converted.
  const duration = optionName(source.validity.duration ?? "");
  if (["1 year", "one year", "yearly", "yearly offer"].includes(duration)) result.offerDuration = qaOfferDurations.yearly;
  else if (["1 month", "one month", "monthly", "monthly offer"].includes(duration)) result.offerDuration = qaOfferDurations.monthly;
  if (!options || options.merchantProfileId !== parent) return result;
  const categoryId = uniqueMatch(source.category, options.categories);
  if (categoryId !== undefined) {
    result.categoryIds = [categoryId];
    const category = options.categories.find((entry) => entry.id === categoryId)!;
    const subcategoryId = uniqueMatch(source.subCategory, category.subCategories);
    if (subcategoryId !== undefined) result.subCategoryIds = [subcategoryId];
  }
  const typeNames: Record<string, string> = { bogo: "Buy 1 Get 1", discount: "Discount", bundle: "Bundle", voucher: "Voucher" };
  const typeId = uniqueMatch(typeNames[source.dealType] ?? source.dealType, options.offerTypes);
  if (typeId !== undefined) result.offerTypeId = typeId;
  if (!options.branchIssue && source.branches?.length) {
    const ids = source.branches.map((name) => uniqueMatch(name, options.branches));
    if (ids.every((id): id is number => id !== undefined)) result.branchIds = Array.from(new Set(ids));
  }
  result.claimRuleIds = Array.from(new Set((source.terms.claimRules ?? [])
    .map((name) => uniqueMatch(name, options.claimRules, ruleName)).filter((id): id is number => id !== undefined)));
  result.paymentConditionIds = Array.from(new Set((source.terms.generalRules ?? [])
    .map((name) => uniqueMatch(name, options.paymentConditions, ruleName)).filter((id): id is number => id !== undefined)));
  return result;
}
