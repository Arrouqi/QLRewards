import { z } from "zod";
import { isQaOfferImageKey, qaDateOnly } from "@shared/offerQaDetails";

// Observed successful QA requests, not a claim about the complete API schema.
const id = z.number().int().positive().safe();
const text = z.string();
const day = z.object({ closed: z.boolean(), open: text, close: text });
export const merchantPayloadSchema = z.object({
  agencyId: z.number().int().nonnegative().safe(),
  agencyName: text.min(1),
  agencyEmail: z.string().email(),
  userEmail: z.string().email(),
  contactMobile: text.min(1),
  contactWhatsapp: text.min(1),
  agencyLogoUri: text.min(1),
  crNumber: text.min(1),
  crUri: text.min(1),
  establishmentCardCode: text,
  tradeLicenseNumber: text,
  taxCardUri: text,
  isPriceList: z.boolean(),
  website: text,
  coverPhoto: text.min(1),
  aboutAgency: text.min(1),
  categoryId: id,
  workingHours: z.object({
    saturday: day, sunday: day, monday: day, tuesday: day,
    wednesday: day, thursday: day, friday: day,
  }).optional(),
  tagIds: z.array(id),
  config: z.object({}).strict(), // Only an empty object was observed.
  descriptionLength: z.number().int().nonnegative(),
  branches: z.array(z.object({
    name: text.min(1), locationId: id, locationUri: text, contactMobile: text,
    pin: text, pinEnabled: z.boolean(), qrEnabled: z.boolean(),
  })).min(1),
});

export const offerPayloadSchema = z.object({
  images: z.array(z.object({ uri: text.refine(isQaOfferImageKey), sortOrder: id })).min(1),
  categoryIds: z.array(id).min(1),
  subCategoryIds: z.array(id).min(1),
  offerTypeId: id,
  price: z.number().finite().nonnegative(),
  redemptionType: z.number().int().nonnegative(),
  redemptionLimit: z.number().int().nonnegative().nullable(),
  // Non-null periods, weekdays and tranche settings were not captured. Fail
  // closed instead of inventing their codes or meaning.
  redemptionLimitPeriod: z.null(),
  title: text.min(1),
  titleAr: text.default(""),
  description: text,
  descriptionAr: text.default(""),
  branchIds: z.array(id).min(1),
  termsAndConditions: text,
  offerDuration: z.number().int().positive(),
  validDays: z.array(z.never()),
  claimRuleIds: z.array(id),
  paymentConditionIds: z.array(id),
  tagIds: z.array(id),
  trancheValidity: z.null(),
  estimatedSavings: z.number().finite().nonnegative(),
  merchantProfileId: id,
  startDate: qaDateOnly,
  endDate: qaDateOnly,
}).refine((p) => Date.parse(p.endDate) >= Date.parse(p.startDate), { path: ["endDate"], message: "End date precedes start date" });

export type MerchantPayload = z.infer<typeof merchantPayloadSchema>;
export type OfferPayload = z.infer<typeof offerPayloadSchema>;
export interface BackofficeMappings {
  merchants?: Record<string, Partial<MerchantPayload>>;
  offers?: Record<string, Partial<OfferPayload>>;
}
export interface PreparedPayload {
  payload: Record<string, unknown>;
  issues: string[];
}

export function checkPayload(schema: z.ZodTypeAny, payload: Record<string, unknown>, extraIssues: string[] = []): PreparedPayload {
  const result = schema.safeParse(payload);
  // Paths only: Zod/raw API messages may contain submitted contact information.
  const issues = result.success ? [] : result.error.issues.map((issue) => issue.path.join(".") || "payload");
  return { payload: result.success ? result.data : payload, issues: Array.from(new Set([...extraIssues, ...issues])) };
}
