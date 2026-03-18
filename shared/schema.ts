import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
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
  companyName: text("company_name").notNull(),
  crNumber: text("cr_number").notNull(),
  brandName: text("brand_name").notNull(),
  address: text("address").notNull(),
  contactPerson: text("contact_person").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  products: text("products").array().notNull(),
  businessCategories: text("business_categories").array().notNull(),
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
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertMerchant = z.infer<typeof insertMerchantSchema>;
export type Merchant = typeof merchants.$inferSelect;

export const merchantDeals = pgTable("merchant_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").notNull().references(() => merchants.id),
  category: text("category").notNull(),
  subCategory: text("sub_category").notNull(),
  dealType: text("deal_type").notNull(),
  duration: text("duration").notNull(),
  redemption: text("redemption").notNull(),
  limitPerUser: text("limit_per_user"),
  originalPrice: text("original_price"),
  isMultipleItems: boolean("is_multiple_items").notNull().default(false),
  discountPercentage: text("discount_percentage"),
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
