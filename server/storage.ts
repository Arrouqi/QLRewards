import { 
  type Deal, type InsertDeal, 
  type AdminUser, type InsertAdminUser, 
  type Category, type InsertCategory,
  type SubCategory, type InsertSubCategory,
  deals, adminUsers, categories, subCategories 
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  createDeal(deal: InsertDeal): Promise<Deal>;
  getAllDeals(): Promise<Deal[]>;
  getDealById(id: string): Promise<Deal | undefined>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  approveDeal(id: string): Promise<Deal | undefined>;
  getAdminUser(username: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  createCategory(category: InsertCategory): Promise<Category>;
  getAllCategories(): Promise<Category[]>;
  deleteCategory(id: string): Promise<void>;
  createSubCategory(subCategory: InsertSubCategory): Promise<SubCategory>;
  getSubCategoriesByCategoryId(categoryId: string): Promise<SubCategory[]>;
  getAllSubCategories(): Promise<SubCategory[]>;
  deleteSubCategory(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async getAllDeals(): Promise<Deal[]> {
    return await db.select().from(deals);
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

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(subCategories).where(eq(subCategories.categoryId, id));
    await db.delete(categories).where(eq(categories.id, id));
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

  async deleteSubCategory(id: string): Promise<void> {
    await db.delete(subCategories).where(eq(subCategories.id, id));
  }
}

export const storage = new DatabaseStorage();
