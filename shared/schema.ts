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
  branch: text("branch").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
});

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
