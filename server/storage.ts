import { 
  type Deal, type InsertDeal, type DealSummary,
  type AdminUser, type InsertAdminUser, 
  type Category, type InsertCategory,
  type SubCategory, type InsertSubCategory,
  type Term, type InsertTerm,
  type EmailRecipient, type InsertEmailRecipient,
  type EmailSettings, type InsertEmailSettings,
  deals, adminUsers, categories, subCategories, terms, emailRecipients, emailSettings 
} from "@shared/schema";
import { db } from "./db";
import { eq, inArray, and } from "drizzle-orm";

export interface IStorage {
  createDeal(deal: InsertDeal): Promise<Deal>;
  getAllDeals(): Promise<Deal[]>;
  getAllDealSummaries(): Promise<DealSummary[]>;
  getDealById(id: string): Promise<Deal | undefined>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  approveDeal(id: string): Promise<Deal | undefined>;
  bulkApproveDeals(ids: string[]): Promise<Deal[]>;
  archiveDeal(id: string): Promise<Deal | undefined>;
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

  async getAdminUser(username: string): Promise<AdminUser | undefined> {
    const [user] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, username));
    return user;
  }

  async createAdminUser(user: InsertAdminUser): Promise<AdminUser> {
    const [newUser] = await db.insert(adminUsers).values(user).returning();
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
}

export const storage = new DatabaseStorage();
