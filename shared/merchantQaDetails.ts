import { z } from "zod";
import { isMerchantAssetReference } from "./qaFiles";

export const qaWeekdays = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hours = z.object({ closed: z.boolean(), open: z.string(), close: z.string() }).strict()
  .superRefine((value, ctx) => {
    if (!value.closed) for (const field of ["open", "close"] as const) {
      if (!time.safeParse(value[field]).success) ctx.addIssue({ code: "custom", path: [field], message: "Enter a valid opening or closing time." });
    }
  });
const positiveId = z.number().int().positive().safe();
const assetReference = z.string().trim().min(1).max(4096)
  .refine(isMerchantAssetReference, "Upload a QA file, enter its qa/... storage key, or use a permanent file URL. Signed upload URLs cannot be saved.");
export const merchantQaDetailsSchema = z.object({
  agencyName: z.string().trim().min(1).max(200),
  agencyEmail: z.string().trim().email().max(254),
  contactMobile: z.string().trim().min(1).max(50),
  contactWhatsapp: z.string().trim().min(1).max(50),
  agencyLogoUri: assetReference,
  coverPhoto: assetReference,
  aboutAgency: z.string().trim().min(1).max(10000),
  crNumber: z.string().trim().min(1).max(200),
  crUri: assetReference,
  agencyId: z.number().int().nonnegative().safe().default(0),
  userEmail: z.string().trim().email().max(254),
  isPriceList: z.boolean().default(false),
  categoryId: positiveId,
  workingHours: z.object({
    saturday: hours, sunday: hours, monday: hours, tuesday: hours,
    wednesday: hours, thursday: hours, friday: hours,
  }).strict().optional(),
  branches: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    locationId: positiveId,
    locationUri: z.string().trim().max(2048).url().refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS map link."),
    contactMobile: z.string().trim().min(1).max(50),
    pin: z.string().max(64).default(""),
    pinEnabled: z.boolean().default(false),
    qrEnabled: z.boolean().default(false),
  }).strict().superRefine((value, ctx) => {
    if (value.pinEnabled && !value.pin.trim()) ctx.addIssue({ code: "custom", path: ["pin"], message: "Enter a PIN when PIN redemption is enabled." });
  })).min(1).max(100),
}).strict();
export type MerchantQaDetails = z.infer<typeof merchantQaDetailsSchema>;
export interface MerchantQaOptions {
  categories: { id: number; name: string }[];
  locations: { id: number; name: string }[];
}
export interface MerchantQaDetailsResponse {
  details: MerchantQaDetails | null;
  merchantName: string;
  sourceBranches: { name: string; locationUri: string; contactMobile: string }[];
  editable: boolean;
  issues: string[];
  profileNames?: string[];
  prefill?: Partial<MerchantQaDetails>;
}
export const merchantQaSettingKey = (id: string) => `qa_merchant_details:${id}`;
