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
  images: text("images").array().notNull().default(sql`'{}'::text[]`),
  adminComment: text("admin_comment"),
  assignedTo: text("assigned_to"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  status: true,
  createdAt: true,
  adminComment: true,
  assignedTo: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

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
