import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isAlaCarte: boolean("is_ala_carte").notNull().default(true),
  category: text("category").notNull(),
  subCategory: text("sub_category").notNull(),
  dealType: text("deal_type").notNull(),
  duration: text("duration").notNull(),
  redemption: text("redemption").notNull(),
  limitPerUser: text("limit_per_user"),
  originalPrice: text("original_price").notNull(),
  isMultipleItems: boolean("is_multiple_items").notNull().default(false),
  discountPercentage: text("discount_percentage"),
  discountedPrice: text("discounted_price"),
  isTwoTranches: boolean("is_two_tranches").notNull().default(false),
  trancheValidity: text("tranche_validity"),
  specificDays: boolean("specific_days").notNull().default(false),
  days: text("days").array(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  claimRules: text("claim_rules").array().notNull(),
  generalRules: text("general_rules").array().notNull(),
  otherRules: text("other_rules"),
  branches: text("branches").array().notNull(),
  merchantId: text("merchant_id"),
  merchantName: text("merchant_name"),
  merchantEmail: text("merchant_email"),
  merchantPhone: text("merchant_phone"),
  images: text("images").array(),
  offerStartDate: text("offer_start_date"),
  offerEndDate: text("offer_end_date"),
  merchantUserId: text("merchant_user_id"),
  merchantBranchId: text("merchant_branch_id"),
  adminComment: text("admin_comment"),
  adminCommentHistory: text("admin_comment_history").array(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  status: true,
  createdAt: true,
  adminComment: true,
  adminCommentHistory: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

export type DealSummary = Pick<Deal, 
  'id' | 'title' | 'category' | 'subCategory' | 'dealType' | 'status' | 
  'merchantName' | 'merchantEmail' | 'createdAt' | 'isAlaCarte' | 'duration' | 
  'originalPrice' | 'discountPercentage'
>;

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const subCategories = pgTable("sub_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubCategorySchema = createInsertSchema(subCategories).omit({
  id: true,
  createdAt: true,
});

export type InsertSubCategory = z.infer<typeof insertSubCategorySchema>;
export type SubCategory = typeof subCategories.$inferSelect;

export const terms = pgTable("terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTermSchema = createInsertSchema(terms).omit({
  id: true,
  createdAt: true,
});

export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Term = typeof terms.$inferSelect;

export const emailRecipients = pgTable("email_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  recipientType: text("recipient_type").notNull().default("sales"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailRecipientSchema = createInsertSchema(emailRecipients).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailRecipient = z.infer<typeof insertEmailRecipientSchema>;
export type EmailRecipient = typeof emailRecipients.$inferSelect;

export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().default("mandrill"),
  apiKey: text("api_key"),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

export const merchants = pgTable("merchants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyType: text("company_type").notNull().default("individual"),
  companyName: text("company_name").notNull(),
  crNumber: text("cr_number"),
  brandName: text("brand_name"),
  address: text("address").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  products: text("products").array(),
  businessCategories: text("business_categories").array(),
  branches: text("branches").array(),
  subscriptionFee: text("subscription_fee"),
  transactionFee: text("transaction_fee"),
  redemptionFee: text("redemption_fee"),
  crDocument: text("cr_document"),
  establishmentCard: text("establishment_card"),
  tradeLicense: text("trade_license"),
  menuPriceList: text("menu_price_list"),
  merchantSignature: text("merchant_signature"),
  merchantSignatoryName: text("merchant_signatory_name"),
  companyStamp: text("company_stamp"),
  merchantSignDate: text("merchant_sign_date"),
  commencementDate: text("commencement_date"),
  qlSignature: text("ql_signature"),
  qlName: text("ql_name"),
  qlTitle: text("ql_title"),
  qlSignDate: text("ql_sign_date"),
  signedContractUpload: text("signed_contract_upload"),
  salesOrder: text("sales_order"),
  taxCardDocument: text("tax_card_document"),
  logo: text("logo"),
  coverImage: text("cover_image"),
  whatsapp: text("whatsapp"),
  submittedBy: text("submitted_by"),
  offersCreated: integer("offers_created").notNull().default(0),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMerchantSchema = createInsertSchema(merchants, {
  crNumber: z.string().regex(/^[a-zA-Z0-9]{4,14}$/, "CR number must be 4-14 alphanumeric characters").nullable().optional(),
  brandName: z.string().nullable().optional(),
  products: z.array(z.string()).nullable().optional(),
  businessCategories: z.array(z.string()).nullable().optional(),
  companyType: z.enum(["individual", "group"]).default("individual"),
}).omit({
  id: true,
  status: true,
  submittedBy: true,
  createdAt: true,
}).superRefine((data, ctx) => {
  if (data.companyType === "group") return;
  if (!data.crNumber || !/^[a-zA-Z0-9]{4,14}$/.test(data.crNumber)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["crNumber"], message: "CR number must be 4-14 alphanumeric characters" });
  }
  if (!data.brandName || data.brandName.trim() === "") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["brandName"], message: "Brand name is required" });
  }
  if (!data.products || data.products.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["products"], message: "Products are required" });
  }
  if (!data.businessCategories || data.businessCategories.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["businessCategories"], message: "Business categories are required" });
  }
});

export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchants.$inferSelect;

export const merchantBrands = pgTable("merchant_brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  brandName: text("brand_name"),
  address: text("address"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  crNumber: text("cr_number"),
  crDocument: text("cr_document"),
  tradeLicense: text("trade_license"),
  taxCardDocument: text("tax_card_document"),
  establishmentCard: text("establishment_card"),
  menuPriceList: text("menu_price_list"),
  logo: text("logo"),
  coverImage: text("cover_image"),
  businessCategories: text("business_categories").array(),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const brandPayloadSchema = z.object({
  brandName: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contactPerson: z.string().max(200).nullable().optional(),
  email: z.union([z.string().email().max(200), z.literal(""), z.null()]).optional(),
  phone: z.string().max(50).nullable().optional(),
  whatsapp: z.string().max(50).nullable().optional(),
  crNumber: z.union([z.string().regex(/^[a-zA-Z0-9]{4,14}$/), z.literal(""), z.null()]).optional(),
  crDocument: z.string().nullable().optional(),
  tradeLicense: z.string().nullable().optional(),
  taxCardDocument: z.string().nullable().optional(),
  establishmentCard: z.string().nullable().optional(),
  menuPriceList: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  businessCategories: z.array(z.string().max(100)).max(50).nullable().optional(),
});

export const insertMerchantBrandSchema = createInsertSchema(merchantBrands).omit({
  id: true,
  createdAt: true,
});

export type InsertMerchantBrand = z.infer<typeof insertMerchantBrandSchema>;
export type MerchantBrand = typeof merchantBrands.$inferSelect;

export const merchantDeals = pgTable("merchant_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull().references(() => merchants.id),
  brandId: text("brand_id"),
  category: text("category").notNull(),
  subCategory: text("sub_category").notNull(),
  dealType: text("deal_type").notNull(),
  duration: text("duration").notNull(),
  redemption: text("redemption").notNull(),
  limitPerUser: text("limit_per_user"),
  originalPrice: text("original_price"),
  isMultipleItems: boolean("is_multiple_items").notNull().default(false),
  discountPercentage: text("discount_percentage"),
  discountedPrice: text("discounted_price"),
  isTwoTranches: boolean("is_two_tranches").notNull().default(false),
  trancheValidity: text("tranche_validity"),
  specificDays: boolean("specific_days").notNull().default(false),
  days: text("days").array(),
  title: text("title").notNull(),
  description: text("description"),
  claimRules: text("claim_rules").array().notNull(),
  generalRules: text("general_rules").array().notNull(),
  otherRules: text("other_rules"),
  branches: text("branches").array().notNull(),
  images: text("images").array(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMerchantDealSchema = createInsertSchema(merchantDeals).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertMerchantDeal = z.infer<typeof insertMerchantDealSchema>;
export type MerchantDeal = typeof merchantDeals.$inferSelect;

export const merchantNotes = pgTable("merchant_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull().references(() => merchants.id),
  author: text("author").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMerchantNoteSchema = createInsertSchema(merchantNotes).omit({
  id: true,
  createdAt: true,
});

export type InsertMerchantNote = z.infer<typeof insertMerchantNoteSchema>;
export type MerchantNote = typeof merchantNotes.$inferSelect;

export const submissionLogs = pgTable("submission_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formType: text("form_type").notNull(),
  status: text("status").notNull(),
  requestBody: text("request_body"),
  fieldsReceived: text("fields_received"),
  fileFields: text("file_fields"),
  errorMessage: text("error_message"),
  errorDetails: text("error_details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubmissionLogSchema = createInsertSchema(submissionLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertSubmissionLog = z.infer<typeof insertSubmissionLogSchema>;
export type SubmissionLog = typeof submissionLogs.$inferSelect;

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  action: text("action").notNull(),
  merchantId: text("merchant_id"),
  merchantName: text("merchant_name"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export const feedbacks = pgTable("feedbacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedbackType: text("feedback_type").notNull(), // 'mystery_shopper' | 'merchant_referral'
  status: text("status").notNull().default("new"), // 'new' | 'reviewed' | 'archived'

  // Shopper Information (Mystery Shopper) / Your Name (Merchant Referral)
  shopperName: text("shopper_name"),
  totalBudgetQar: text("total_budget_qar"),

  // Merchant Experience Summary (single merchant per submission)
  // Shared with Merchant Referral: merchantName=Merchant Name, merchantLocation=Branch Name,
  // visitDate=Date, visitTime=Time
  merchantId: text("merchant_id"), // optional ES merchant id if picked from dropdown
  merchantName: text("merchant_name"),
  merchantLocation: text("merchant_location"),
  visitDate: text("visit_date"),
  visitTime: text("visit_time"),
  staffKnowsRedeem: text("staff_knows_redeem"), // 'yes' | 'no'
  staffScansQr: text("staff_scans_qr"),
  rewardApprovedImmediately: text("reward_approved_immediately"),
  redemptionSmooth: text("redemption_smooth"),
  staffAwareOfOffer: text("staff_aware_of_offer"),
  productServiceQuality: text("product_service_quality"), // 'poor'|'fair'|'good'|'very_good'|'excellent'
  merchantComments: text("merchant_comments"),

  // QL Rewards Platform Feedback (Mystery Shopper)
  browseSelectEase: text("browse_select_ease"),
  allOffersRedeemedAsDescribed: text("all_offers_redeemed_as_described"),
  offersIssueExplanation: text("offers_issue_explanation"),
  improvementSuggestions: text("improvement_suggestions"),

  // Final Comments (Mystery Shopper)
  enjoyedMost: text("enjoyed_most"),

  // Merchant Referral - Living Deals Staff Interaction
  referralIntroducedDeals: text("referral_introduced_deals"), // 'yes' | 'no'
  referralEncouragedAppDownload: text("referral_encouraged_app_download"), // 'yes' | 'no'
  referralExplainedOffer: text("referral_explained_offer"), // 'yes' | 'no'
  referralProvidedPromoCode: text("referral_provided_promo_code"), // 'yes' | 'no'
  referralSubscriptionSmoothness: text("referral_subscription_smoothness"), // 'very_easy'|'easy'|'difficult'|'very_difficult'
  referralStaffKnowledge: text("referral_staff_knowledge"), // 'poor'|'fair'|'good'|'excellent'
  referralOverallSatisfaction: text("referral_overall_satisfaction"), // 'very_unsatisfied'|'unsatisfied'|'neutral'|'satisfied'|'very_satisfied'
  referralLikedMost: text("referral_liked_most"),
  referralCouldImprove: text("referral_could_improve"),

  // metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbacks).omit({
  id: true,
  createdAt: true,
  ipAddress: true,
  userAgent: true,
  status: true,
});

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbacks.$inferSelect;

export const feedbackComments = pgTable("feedback_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  feedbackId: varchar("feedback_id").notNull().references(() => feedbacks.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedbackCommentSchema = createInsertSchema(feedbackComments).omit({
  id: true,
  createdAt: true,
});

export type InsertFeedbackComment = z.infer<typeof insertFeedbackCommentSchema>;
export type FeedbackComment = typeof feedbackComments.$inferSelect;

export const redirectLogs = pgTable("redirect_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: text("visitor_id"),
  platform: text("platform"),
  outcome: text("outcome"),
  browser: text("browser"),
  os: text("os"),
  device: text("device"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  referrer: text("referrer"),
  pagePath: text("page_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRedirectLogSchema = createInsertSchema(redirectLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertRedirectLog = z.infer<typeof insertRedirectLogSchema>;
export type RedirectLog = typeof redirectLogs.$inferSelect;

export const merchantTrainings = pgTable("merchant_trainings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull().references(() => merchants.id, { onDelete: "cascade" }),
  trainingDate: text("training_date").notNull(),
  trainingTime: text("training_time").notNull(),
  trainerName: text("trainer_name").notNull(),
  comment: text("comment"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMerchantTrainingSchema = createInsertSchema(merchantTrainings).omit({
  id: true,
  createdAt: true,
});

export type InsertMerchantTraining = z.infer<typeof insertMerchantTrainingSchema>;
export type MerchantTraining = typeof merchantTrainings.$inferSelect;
