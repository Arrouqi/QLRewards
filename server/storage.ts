import { type Deal, type InsertDeal, type AdminUser, type InsertAdminUser, deals, adminUsers } from "@shared/schema";
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
}

export const storage = new DatabaseStorage();
