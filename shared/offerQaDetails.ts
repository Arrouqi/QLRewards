import { z } from "zod";

const id = z.number().int().positive().safe();
const ids = z.array(id).max(100).refine((items) => new Set(items).size === items.length, "Select each option once.");
export const qaOfferImageMaxBytes = 5 * 1024 * 1024;
export function isQaOfferImageKey(value: string): boolean {
  // The offer capture uses UUID-shaped folders, unlike merchant-file keys.
  return /^(?:qa|prod)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9][a-z0-9._-]{0,239}$/i.test(value)
    && !value.split("/")[2].includes("..");
}
export const qaOfferImageKeysSchema = z.array(z.string().max(512).refine(isQaOfferImageKey, "Upload an offer image to QA or enter its stable QA offer-image key.")).max(30)
  .refine((items) => new Set(items).size === items.length, "Each image may be used once.");
export const qaDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, "Enter a real calendar date.");
export const offerQaDetailsObjectSchema = z.object({
  parentMerchantProfileId: z.string().regex(/^[1-9]\d*$/).refine((v) => Number.isSafeInteger(Number(v))),
  title: z.string().trim().min(1).max(500),
  titleAr: z.string().trim().max(500).default(""),
  description: z.string().trim().max(20000),
  descriptionAr: z.string().trim().max(20000).default(""),
  termsAndConditions: z.string().trim().max(20000),
  categoryIds: ids.refine((v) => v.length > 0, "Select a category."),
  subCategoryIds: ids.refine((v) => v.length > 0, "Select a subcategory."),
  offerTypeId: id,
  branchIds: ids.refine((v) => v.length > 0, "Select a branch."),
  claimRuleIds: ids,
  paymentConditionIds: ids,
  price: z.number().finite().nonnegative(),
  offerDuration: id,
  estimatedSavings: z.number().finite().nonnegative(),
  redemptionType: z.number().int().nonnegative().safe(),
  redemptionLimit: z.number().int().nonnegative().safe().nullable(),
  startDate: qaDateOnly,
  endDate: qaDateOnly,
  images: qaOfferImageKeysSchema.refine((items) => items.length > 0, "Choose at least one offer image."),
}).strict();
export const offerQaDetailsSchema = offerQaDetailsObjectSchema.refine((data) => data.endDate >= data.startDate, { path: ["endDate"], message: "End date must not precede start date." });
export const offerQaFieldsSchema = offerQaDetailsObjectSchema.omit({ images: true }).refine((data) => data.endDate >= data.startDate, { path: ["endDate"], message: "End date must not precede start date." });
export const offerQaPreparationDetailsSchema = offerQaDetailsObjectSchema.extend({ images: qaOfferImageKeysSchema })
  .refine((data) => data.endDate >= data.startDate, { path: ["endDate"], message: "End date must not precede start date." });
export type OfferQaDetails = z.infer<typeof offerQaDetailsSchema>;
// Confirmed from the QA backoffice duration select's rendered label and input value.
export const qaOfferDurations = { monthly: 1, yearly: 2 } as const;
// QA offer responses distinguish uncapped redemptions from capped redemptions.
export const qaRedemptionTypes = { unlimited: 1, limited: 2 } as const;
export type QaOption = { id: number; name: string };
export interface OfferQaOptions {
  merchantProfileId: string | null;
  categories: (QaOption & { subCategories: QaOption[] })[];
  offerTypes: QaOption[];
  claimRules: QaOption[];
  paymentConditions: QaOption[];
  branches: QaOption[];
  branchIssue: string | null;
}
export interface OfferQaDetailsResponse {
  details: OfferQaDetails | null;
  prefill: Partial<OfferQaDetails>;
  offerTitle: string;
  merchantProfileId: string | null;
  editable: boolean;
  editBlockedReason?: string | null;
  sourceImages?: string[];
  preparationIssues?: string[];
  optionsIssue?: string | null;
  sourceValues?: { price?: string; duration?: string; redemption?: string; branches?: string[] };
  issues: string[];
}
export interface OfferQaImageUploadResult { reference: string }
export const offerQaSettingKey = (source: string, id: string) => `qa_offer_details:${source}:${id}`;
