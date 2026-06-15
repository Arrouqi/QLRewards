import { 
  type Deal, type InsertDeal, type DealSummary,
  type AdminUser, type InsertAdminUser, 
  type Category, type InsertCategory,
  type SubCategory, type InsertSubCategory,
  type Term, type InsertTerm,
  type EmailRecipient, type InsertEmailRecipient,
  type EmailSettings, type InsertEmailSettings,
  type Merchant, type InsertMerchant,
  type MerchantBrand, type InsertMerchantBrand,
  type MerchantDeal, type InsertMerchantDeal,
  type MerchantNote, type InsertMerchantNote,
  type SubmissionLog, type InsertSubmissionLog,
  type SystemSetting,
  type ActivityLog, type InsertActivityLog,
  type RedirectLog, type InsertRedirectLog,
  type Feedback, type InsertFeedback,
  type FeedbackComment, type InsertFeedbackComment,
  type MerchantTraining, type InsertMerchantTraining,
  deals, adminUsers, categories, subCategories, terms, emailRecipients, emailSettings, merchants, merchantBrands, merchantDeals, merchantNotes,
  submissionLogs, systemSettings, activityLogs, redirectLogs, feedbacks, feedbackComments, merchantTrainings
} from "@shared/schema";
import { db } from "./db";
import { eq, inArray, and, or, desc, sql, gte, isNull } from "drizzle-orm";

export interface IStorage {
  createDeal(deal: InsertDeal): Promise<Deal>;
  getAllDeals(): Promise<Deal[]>;
  getAllDealSummaries(): Promise<DealSummary[]>;
  getDealById(id: string): Promise<Deal | undefined>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  approveDeal(id: string): Promise<Deal | undefined>;
  bulkApproveDeals(ids: string[]): Promise<Deal[]>;
  archiveDeal(id: string): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<void>;
  updateDealCategories(oldName: string, newName: string): Promise<void>;
  getAdminUser(username: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  getAllAdminUsers(): Promise<AdminUser[]>;
  getAdminUserById(id: string): Promise<AdminUser | undefined>;
  updateAdminUser(id: string, data: { password?: string; role?: string }): Promise<AdminUser | undefined>;
  deleteAdminUser(id: string): Promise<void>;
  updateDealAdminFields(id: string, adminComment: string | null, username: string): Promise<Deal | undefined>;
  updateDealMerchantIds(id: string, merchantUserId: string | null, merchantBranchId: string | null): Promise<Deal | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  getAllCategories(): Promise<Category[]>;
  updateCategory(id: string, name: string): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  createSubCategory(subCategory: InsertSubCategory): Promise<SubCategory>;
  getSubCategoriesByCategoryId(categoryId: string): Promise<SubCategory[]>;
  getAllSubCategories(): Promise<SubCategory[]>;
  updateSubCategory(id: string, name: string): Promise<SubCategory | undefined>;
  deleteSubCategory(id: string): Promise<void>;
  createTerm(term: InsertTerm): Promise<Term>;
  getAllTerms(): Promise<Term[]>;
  getTermsByType(type: string): Promise<Term[]>;
  updateTerm(id: string, text: string): Promise<Term | undefined>;
  deleteTerm(id: string): Promise<void>;
  createEmailRecipient(recipient: InsertEmailRecipient): Promise<EmailRecipient>;
  getAllEmailRecipients(): Promise<EmailRecipient[]>;
  getEmailRecipientsByType(recipientType: string): Promise<EmailRecipient[]>;
  getActiveEmailRecipientsByType(recipientType: string): Promise<EmailRecipient[]>;
  updateEmailRecipient(id: string, data: { email?: string; isActive?: boolean }): Promise<EmailRecipient | undefined>;
  deleteEmailRecipient(id: string): Promise<void>;
  getEmailSettings(): Promise<EmailSettings | undefined>;
  upsertEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;
  getAllMerchants(): Promise<Array<Merchant & { trainingCount: number }>>;
  getMerchantById(id: string): Promise<Merchant | undefined>;
  softDeleteMerchant(id: string): Promise<Merchant | undefined>;
  updateMerchant(id: string, data: Partial<InsertMerchant>): Promise<Merchant | undefined>;
  updateMerchantStatus(id: string, status: string): Promise<Merchant | undefined>;
  createMerchantDeal(deal: InsertMerchantDeal): Promise<MerchantDeal>;
  getMerchantDealsByMerchantId(merchantId: string): Promise<MerchantDeal[]>;
  getMerchantDealById(id: string): Promise<MerchantDeal | undefined>;
  updateMerchantDeal(id: string, data: Partial<InsertMerchantDeal>): Promise<MerchantDeal | undefined>;
  deleteMerchantDeal(id: string): Promise<void>;
  updateMerchantSubmittedBy(id: string, submittedBy: string | null): Promise<Merchant | undefined>;
  getMerchantNotes(merchantId: string): Promise<MerchantNote[]>;
  createMerchantNote(note: InsertMerchantNote): Promise<MerchantNote>;
  updateMerchantOffersCreated(id: string, offersCreated: number): Promise<Merchant | undefined>;
  deleteMerchant(id: string): Promise<void>;
  getMerchantBrandsByMerchantId(merchantId: string): Promise<MerchantBrand[]>;
  createMerchantBrand(brand: InsertMerchantBrand): Promise<MerchantBrand>;
  replaceMerchantBrands(merchantId: string, brands: Omit<InsertMerchantBrand, "merchantId">[]): Promise<MerchantBrand[]>;
  deleteMerchantBrandsByMerchantId(merchantId: string): Promise<void>;
  createSubmissionLog(log: InsertSubmissionLog): Promise<SubmissionLog>;
  getSubmissionLogs(limit?: number, offset?: number): Promise<SubmissionLog[]>;
  getSubmissionLogCount(): Promise<number>;
  clearSubmissionLogs(): Promise<void>;
  getSystemSetting(key: string): Promise<string | null>;
  setSystemSetting(key: string, value: string): Promise<void>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(limit?: number, offset?: number): Promise<ActivityLog[]>;
  clearActivityLogs(): Promise<void>;
  createRedirectLog(log: InsertRedirectLog): Promise<RedirectLog>;
  getRedirectLogs(limit?: number, offset?: number, sinceDays?: number, linkType?: string): Promise<RedirectLog[]>;
  getRedirectLogCount(sinceDays?: number, linkType?: string): Promise<number>;
  getRedirectLogStats(sinceDays?: number, linkType?: string): Promise<{
    total: number;
    uniqueVisitors: number;
    byPlatform: { key: string; count: number }[];
    byOutcome: { key: string; count: number }[];
    byBrowser: { key: string; count: number }[];
    byOs: { key: string; count: number }[];
    byDevice: { key: string; count: number }[];
    byReferrer: { key: string; count: number }[];
    byDay: { day: string; count: number; uniqueVisitors: number }[];
  }>;
  clearRedirectLogs(): Promise<void>;
  createFeedback(feedback: InsertFeedback & { ipAddress?: string | null; userAgent?: string | null }): Promise<Feedback>;
  getAllFeedbacks(filter?: { feedbackType?: string; status?: string; search?: string }): Promise<Feedback[]>;
  getFeedbackById(id: string): Promise<Feedback | undefined>;
  updateFeedbackStatus(id: string, status: string): Promise<Feedback | undefined>;
  deleteFeedback(id: string): Promise<void>;
  getFeedbackComments(feedbackId: string): Promise<FeedbackComment[]>;
  createFeedbackComment(comment: InsertFeedbackComment): Promise<FeedbackComment>;
  getMerchantTrainings(merchantId: string): Promise<MerchantTraining[]>;
  createMerchantTraining(data: InsertMerchantTraining): Promise<MerchantTraining>;
}

export class DatabaseStorage implements IStorage {
  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async getAllDeals(): Promise<Deal[]> {
    return await db.select().from(deals);
  }

  async getAllDealSummaries(): Promise<DealSummary[]> {
    return await db.select({
      id: deals.id,
      title: deals.title,
      category: deals.category,
      subCategory: deals.subCategory,
      dealType: deals.dealType,
      status: deals.status,
      merchantName: deals.merchantName,
      merchantEmail: deals.merchantEmail,
      createdAt: deals.createdAt,
      isAlaCarte: deals.isAlaCarte,
      duration: deals.duration,
      originalPrice: deals.originalPrice,
      discountPercentage: deals.discountPercentage,
    }).from(deals);
  }

  async getDealById(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async updateDeal(id: string, dealData: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [updated] = await db
      .update(deals)
      .set(dealData)
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }

  async approveDeal(id: string): Promise<Deal | undefined> {
    const [approved] = await db
      .update(deals)
      .set({ status: "approved" })
      .where(eq(deals.id, id))
      .returning();
    return approved;
  }

  async bulkApproveDeals(ids: string[]): Promise<Deal[]> {
    if (ids.length === 0) return [];
    const result = await db
      .update(deals)
      .set({ status: "approved" })
      .where(and(inArray(deals.id, ids), eq(deals.status, "pending")))
      .returning();
    return result;
  }

  async archiveDeal(id: string): Promise<Deal | undefined> {
    const [archived] = await db
      .update(deals)
      .set({ status: "archived" })
      .where(eq(deals.id, id))
      .returning();
    return archived;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getAdminUser(username: string): Promise<AdminUser | undefined> {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username));
    return user;
  }

  async createAdminUser(user: InsertAdminUser): Promise<AdminUser> {
    const id = crypto.randomUUID();
    const [newUser] = await db.insert(adminUsers).values({ ...user, id }).returning();
    return newUser;
  }

  async getAllAdminUsers(): Promise<AdminUser[]> {
    return await db.select().from(adminUsers);
  }

  async getAdminUserById(id: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user;
  }

  async updateAdminUser(id: string, data: { password?: string; role?: string }): Promise<AdminUser | undefined> {
    const [updated] = await db.update(adminUsers).set(data).where(eq(adminUsers.id, id)).returning();
    return updated;
  }

  async deleteAdminUser(id: string): Promise<void> {
    await db.delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async updateDealAdminFields(id: string, adminComment: string | null, username: string): Promise<Deal | undefined> {
    const existingDeal = await this.getDealById(id);
    if (!existingDeal) return undefined;
    
    let adminCommentHistory = existingDeal.adminCommentHistory || [];
    
    if (adminComment && adminComment.trim()) {
      const timestamp = new Date().toISOString();
      const commentEntry = JSON.stringify({
        text: adminComment,
        author: username,
        timestamp: timestamp
      });
      adminCommentHistory = [...adminCommentHistory, commentEntry];
    }
    
    const [updated] = await db
      .update(deals)
      .set({ adminComment: "", adminCommentHistory })
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }

  async updateDealMerchantIds(id: string, merchantUserId: string | null, merchantBranchId: string | null): Promise<Deal | undefined> {
    const [updated] = await db
      .update(deals)
      .set({ merchantUserId, merchantBranchId })
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async updateCategory(id: string, name: string): Promise<Category | undefined> {
    const [updated] = await db
      .update(categories)
      .set({ name })
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(subCategories).where(eq(subCategories.categoryId, id));
    await db.delete(categories).where(eq(categories.id, id));
  }

  async updateDealCategories(oldName: string, newName: string): Promise<void> {
    await db
      .update(deals)
      .set({ category: newName })
      .where(eq(deals.category, oldName));
  }

  async createSubCategory(subCategory: InsertSubCategory): Promise<SubCategory> {
    const [newSubCategory] = await db.insert(subCategories).values(subCategory).returning();
    return newSubCategory;
  }

  async getSubCategoriesByCategoryId(categoryId: string): Promise<SubCategory[]> {
    return await db.select().from(subCategories).where(eq(subCategories.categoryId, categoryId));
  }

  async getAllSubCategories(): Promise<SubCategory[]> {
    return await db.select().from(subCategories);
  }

  async updateSubCategory(id: string, name: string): Promise<SubCategory | undefined> {
    const [updated] = await db
      .update(subCategories)
      .set({ name })
      .where(eq(subCategories.id, id))
      .returning();
    return updated;
  }

  async deleteSubCategory(id: string): Promise<void> {
    await db.delete(subCategories).where(eq(subCategories.id, id));
  }

  async createTerm(term: InsertTerm): Promise<Term> {
    const [newTerm] = await db.insert(terms).values(term).returning();
    return newTerm;
  }

  async getAllTerms(): Promise<Term[]> {
    return await db.select().from(terms);
  }

  async getTermsByType(type: string): Promise<Term[]> {
    return await db.select().from(terms).where(eq(terms.type, type));
  }

  async updateTerm(id: string, text: string): Promise<Term | undefined> {
    const [updated] = await db
      .update(terms)
      .set({ text })
      .where(eq(terms.id, id))
      .returning();
    return updated;
  }

  async deleteTerm(id: string): Promise<void> {
    await db.delete(terms).where(eq(terms.id, id));
  }

  async createEmailRecipient(recipient: InsertEmailRecipient): Promise<EmailRecipient> {
    const [newRecipient] = await db.insert(emailRecipients).values({
      ...recipient,
      email: recipient.email.toLowerCase().trim()
    }).returning();
    return newRecipient;
  }

  async getAllEmailRecipients(): Promise<EmailRecipient[]> {
    return await db.select().from(emailRecipients);
  }

  async getEmailRecipientsByType(recipientType: string): Promise<EmailRecipient[]> {
    return await db.select().from(emailRecipients).where(eq(emailRecipients.recipientType, recipientType));
  }

  async getActiveEmailRecipientsByType(recipientType: string): Promise<EmailRecipient[]> {
    return await db.select().from(emailRecipients).where(
      and(eq(emailRecipients.recipientType, recipientType), eq(emailRecipients.isActive, true))
    );
  }

  async updateEmailRecipient(id: string, data: { email?: string; isActive?: boolean }): Promise<EmailRecipient | undefined> {
    const updateData: Partial<InsertEmailRecipient> = {};
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const [updated] = await db.update(emailRecipients).set(updateData).where(eq(emailRecipients.id, id)).returning();
    return updated;
  }

  async deleteEmailRecipient(id: string): Promise<void> {
    await db.delete(emailRecipients).where(eq(emailRecipients.id, id));
  }

  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings);
    return settings;
  }

  async upsertEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings> {
    const existing = await this.getEmailSettings();
    
    if (existing) {
      const [updated] = await db
        .update(emailSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(emailSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(emailSettings)
        .values({ ...settings, updatedAt: new Date() })
        .returning();
      return created;
    }
  }

  async createMerchant(merchant: InsertMerchant): Promise<Merchant> {
    const [newMerchant] = await db.insert(merchants).values(merchant).returning();
    return newMerchant;
  }

  async getAllMerchants(): Promise<Array<Merchant & { trainingCount: number }>> {
    const rows = await db
      .select({
        merchant: merchants,
        trainingCount: sql<number>`(SELECT COUNT(*) FROM merchant_trainings WHERE merchant_id = ${merchants.id})`.mapWith(Number),
      })
      .from(merchants)
      .where(isNull(merchants.deletedAt));
    return rows.map((r) => ({ ...r.merchant, trainingCount: r.trainingCount }));
  }

  async getMerchantById(id: string): Promise<Merchant | undefined> {
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(and(eq(merchants.id, id), isNull(merchants.deletedAt)));
    return merchant;
  }

  async softDeleteMerchant(id: string): Promise<Merchant | undefined> {
    const [updated] = await db
      .update(merchants)
      .set({ deletedAt: new Date() })
      .where(and(eq(merchants.id, id), isNull(merchants.deletedAt)))
      .returning();
    return updated;
  }

  async updateMerchant(id: string, data: Partial<InsertMerchant>): Promise<Merchant | undefined> {
    const [updated] = await db.update(merchants).set(data).where(eq(merchants.id, id)).returning();
    return updated;
  }

  async updateMerchantStatus(id: string, status: string): Promise<Merchant | undefined> {
    const [updated] = await db.update(merchants).set({ status }).where(eq(merchants.id, id)).returning();
    return updated;
  }

  async createMerchantDeal(deal: InsertMerchantDeal): Promise<MerchantDeal> {
    const [newDeal] = await db.insert(merchantDeals).values(deal).returning();
    return newDeal;
  }

  async getMerchantDealsByMerchantId(merchantId: string): Promise<MerchantDeal[]> {
    return await db.select().from(merchantDeals).where(eq(merchantDeals.merchantId, merchantId));
  }

  async getMerchantDealById(id: string): Promise<MerchantDeal | undefined> {
    const [deal] = await db.select().from(merchantDeals).where(eq(merchantDeals.id, id));
    return deal;
  }

  async updateMerchantDeal(id: string, data: Partial<InsertMerchantDeal>): Promise<MerchantDeal | undefined> {
    const [updated] = await db.update(merchantDeals).set(data).where(eq(merchantDeals.id, id)).returning();
    return updated;
  }

  async deleteMerchantDeal(id: string): Promise<void> {
    await db.delete(merchantDeals).where(eq(merchantDeals.id, id));
  }

  async updateMerchantSubmittedBy(id: string, submittedBy: string | null): Promise<Merchant | undefined> {
    const [updated] = await db.update(merchants).set({ submittedBy }).where(eq(merchants.id, id)).returning();
    return updated;
  }

  async getMerchantNotes(merchantId: string): Promise<MerchantNote[]> {
    return await db.select().from(merchantNotes).where(eq(merchantNotes.merchantId, merchantId)).orderBy(merchantNotes.createdAt);
  }

  async getMerchantBrandsByMerchantId(merchantId: string): Promise<MerchantBrand[]> {
    return await db.select().from(merchantBrands).where(eq(merchantBrands.merchantId, merchantId)).orderBy(merchantBrands.displayOrder);
  }

  async createMerchantBrand(brand: InsertMerchantBrand): Promise<MerchantBrand> {
    const [newBrand] = await db.insert(merchantBrands).values(brand).returning();
    return newBrand;
  }

  async replaceMerchantBrands(merchantId: string, brands: Omit<InsertMerchantBrand, "merchantId">[]): Promise<MerchantBrand[]> {
    return await db.transaction(async (tx) => {
      await tx.delete(merchantBrands).where(eq(merchantBrands.merchantId, merchantId));
      if (brands.length === 0) return [];
      const rows = brands.map((b, i) => ({ ...b, merchantId, displayOrder: b.displayOrder ?? i }));
      return await tx.insert(merchantBrands).values(rows).returning();
    });
  }

  async deleteMerchantBrandsByMerchantId(merchantId: string): Promise<void> {
    await db.delete(merchantBrands).where(eq(merchantBrands.merchantId, merchantId));
  }

  async createMerchantNote(note: InsertMerchantNote): Promise<MerchantNote> {
    const [newNote] = await db.insert(merchantNotes).values(note).returning();
    return newNote;
  }

  async updateMerchantOffersCreated(id: string, offersCreated: number): Promise<Merchant | undefined> {
    const [updated] = await db.update(merchants).set({ offersCreated }).where(eq(merchants.id, id)).returning();
    return updated;
  }

  async deleteMerchant(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(merchantNotes).where(eq(merchantNotes.merchantId, id));
      await tx.delete(merchantDeals).where(eq(merchantDeals.merchantId, id));
      await tx.delete(merchantBrands).where(eq(merchantBrands.merchantId, id));
      await tx.delete(merchants).where(eq(merchants.id, id));
    });
  }

  async createSubmissionLog(log: InsertSubmissionLog): Promise<SubmissionLog> {
    const [newLog] = await db.insert(submissionLogs).values(log).returning();
    return newLog;
  }

  async getSubmissionLogs(limit = 100, offset = 0): Promise<SubmissionLog[]> {
    return await db.select().from(submissionLogs).orderBy(desc(submissionLogs.createdAt)).limit(limit).offset(offset);
  }

  async getSubmissionLogCount(): Promise<number> {
    const result = await db.select().from(submissionLogs);
    return result.length;
  }

  async clearSubmissionLogs(): Promise<void> {
    await db.delete(submissionLogs);
  }

  async getSystemSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting?.value || null;
  }

  async setSystemSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (existing.length > 0) {
      await db.update(systemSettings).set({ value, updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log).returning();
    return newLog;
  }

  async getActivityLogs(limit = 200, offset = 0): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit).offset(offset);
  }

  async clearActivityLogs(): Promise<void> {
    await db.delete(activityLogs);
  }

  async createRedirectLog(log: InsertRedirectLog): Promise<RedirectLog> {
    const [newLog] = await db.insert(redirectLogs).values(log).returning();
    return newLog;
  }

  // Builds a combined WHERE for the redirect-log queries from a time cutoff and a link type.
  // linkType 'deals' also matches legacy NULL rows (all historical hits were the deals link).
  private redirectLogWhere(sinceDays?: number, linkType?: string) {
    const conds: any[] = [];
    if (sinceDays && sinceDays > 0) {
      conds.push(gte(redirectLogs.createdAt, new Date(Date.now() - sinceDays * 86400000)));
    }
    if (linkType === "home") {
      conds.push(eq(redirectLogs.linkType, "home"));
    } else if (linkType === "deals") {
      conds.push(or(eq(redirectLogs.linkType, "deals"), isNull(redirectLogs.linkType)));
    }
    if (conds.length === 0) return undefined;
    return conds.length === 1 ? conds[0] : and(...conds);
  }

  async getRedirectLogs(limit = 200, offset = 0, sinceDays?: number, linkType?: string): Promise<RedirectLog[]> {
    let query = db.select().from(redirectLogs).$dynamic();
    const where = this.redirectLogWhere(sinceDays, linkType);
    if (where) query = query.where(where);
    return await query.orderBy(desc(redirectLogs.createdAt)).limit(limit).offset(offset);
  }

  async getRedirectLogCount(sinceDays?: number, linkType?: string): Promise<number> {
    const where = this.redirectLogWhere(sinceDays, linkType);
    const q = db.select({ c: sql<number>`count(*)::int` }).from(redirectLogs).$dynamic();
    const filtered = where ? q.where(where) : q;
    const [row] = await filtered;
    return Number(row?.c ?? 0);
  }

  async getRedirectLogStats(sinceDays?: number, linkType?: string) {
    const whereClause = this.redirectLogWhere(sinceDays, linkType);

    const groupBy = async (col: any) => {
      const base = db
        .select({ key: col, count: sql<number>`count(*)::int` })
        .from(redirectLogs)
        .$dynamic();
      const filtered = whereClause ? base.where(whereClause) : base;
      const rows = await filtered.groupBy(col).orderBy(desc(sql`count(*)`));
      return rows.map((r: any) => ({ key: r.key ?? "(unknown)", count: Number(r.count) }));
    };

    const totalQ = db.select({ c: sql<number>`count(*)::int` }).from(redirectLogs).$dynamic();
    const totalRow = await (whereClause ? totalQ.where(whereClause) : totalQ);
    const total = Number(totalRow[0]?.c ?? 0);

    // Unique visitors: prefer visitorId, fall back to ipAddress so null visitorIds are not all lost
    const uniqQ = db
      .select({ c: sql<number>`count(distinct coalesce(${redirectLogs.visitorId}, ${redirectLogs.ipAddress}))::int` })
      .from(redirectLogs)
      .$dynamic();
    const uniqRow = await (whereClause ? uniqQ.where(whereClause) : uniqQ);
    const uniqueVisitors = Number(uniqRow[0]?.c ?? 0);

    const dayQ = db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${redirectLogs.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        uniqueVisitors: sql<number>`count(distinct coalesce(${redirectLogs.visitorId}, ${redirectLogs.ipAddress}))::int`,
      })
      .from(redirectLogs)
      .$dynamic();
    const dayFiltered = whereClause ? dayQ.where(whereClause) : dayQ;
    const byDayRows = await dayFiltered
      .groupBy(sql`date_trunc('day', ${redirectLogs.createdAt})`)
      .orderBy(sql`date_trunc('day', ${redirectLogs.createdAt})`);

    return {
      total,
      uniqueVisitors,
      byPlatform: await groupBy(redirectLogs.platform),
      byOutcome: await groupBy(redirectLogs.outcome),
      byBrowser: await groupBy(redirectLogs.browser),
      byOs: await groupBy(redirectLogs.os),
      byDevice: await groupBy(redirectLogs.device),
      byReferrer: await groupBy(redirectLogs.referrer),
      byDay: byDayRows.map((r: any) => ({
        day: r.day,
        count: Number(r.count),
        uniqueVisitors: Number(r.uniqueVisitors),
      })),
    };
  }

  async clearRedirectLogs(): Promise<void> {
    await db.delete(redirectLogs);
  }

  async createFeedback(feedback: InsertFeedback & { ipAddress?: string | null; userAgent?: string | null }): Promise<Feedback> {
    const [row] = await db.insert(feedbacks).values(feedback).returning();
    return row;
  }

  async getAllFeedbacks(filter?: { feedbackType?: string; status?: string; search?: string }): Promise<Feedback[]> {
    let q = db.select().from(feedbacks).$dynamic();
    const conds: any[] = [];
    if (filter?.feedbackType) conds.push(eq(feedbacks.feedbackType, filter.feedbackType));
    if (filter?.status) conds.push(eq(feedbacks.status, filter.status));
    if (filter?.search && filter.search.trim()) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conds.push(sql`(
        lower(coalesce(${feedbacks.shopperName}, '')) like ${term}
        or lower(coalesce(${feedbacks.merchantName}, '')) like ${term}
        or lower(coalesce(${feedbacks.merchantLocation}, '')) like ${term}
      )`);
    }
    if (conds.length > 0) q = q.where(and(...conds));
    return await q.orderBy(desc(feedbacks.createdAt));
  }

  async getFeedbackById(id: string): Promise<Feedback | undefined> {
    const [row] = await db.select().from(feedbacks).where(eq(feedbacks.id, id));
    return row;
  }

  async updateFeedbackStatus(id: string, status: string): Promise<Feedback | undefined> {
    const [row] = await db.update(feedbacks).set({ status }).where(eq(feedbacks.id, id)).returning();
    return row;
  }

  async deleteFeedback(id: string): Promise<void> {
    await db.delete(feedbacks).where(eq(feedbacks.id, id));
  }

  async getFeedbackComments(feedbackId: string): Promise<FeedbackComment[]> {
    return await db.select().from(feedbackComments).where(eq(feedbackComments.feedbackId, feedbackId)).orderBy(feedbackComments.createdAt);
  }

  async createFeedbackComment(comment: InsertFeedbackComment): Promise<FeedbackComment> {
    const [row] = await db.insert(feedbackComments).values(comment).returning();
    return row;
  }

  async getMerchantTrainings(merchantId: string): Promise<MerchantTraining[]> {
    return await db.select().from(merchantTrainings)
      .where(eq(merchantTrainings.merchantId, merchantId))
      .orderBy(desc(merchantTrainings.createdAt));
  }

  async createMerchantTraining(data: InsertMerchantTraining): Promise<MerchantTraining> {
    const [row] = await db.insert(merchantTrainings).values(data).returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
