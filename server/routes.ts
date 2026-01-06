import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDealSchema, insertAdminUserSchema, insertCategorySchema, insertSubCategorySchema, insertTermSchema, insertEmailRecipientSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { sendNewDealNotification, sendModerationNotification } from "./email";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
    role: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
  const sessionDbUrl = isProduction 
    ? (process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL)
    : process.env.DATABASE_URL;

  // Trust proxy for Azure App Service (behind load balancer)
  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(
    session({
      store: new PgSession({
        conString: sessionDbUrl,
        createTableIfMissing: true,
        schemaName: isProduction && process.env.EXTERNAL_DATABASE_URL ? "rewards_external" : "public",
      }),
      secret: process.env.SESSION_SECRET || "qatar-living-deals-secret-key",
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
      },
    })
  );

  createDefaultAdminUser().catch(err => console.log("Admin user setup:", err.message));

  app.post("/api/deals", async (req, res) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal(validatedData);
      
      const activeRecipients = await storage.getActiveEmailRecipientsByType("sales");
      if (activeRecipients.length > 0) {
        const emails = activeRecipients.map(r => r.email);
        sendNewDealNotification(deal, emails).catch(err => {
          console.error("[Email] Error sending notification:", err);
        });
      }
      
      res.status(201).json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/deals", requireAuth, async (req, res) => {
    try {
      const deals = await storage.getAllDeals();
      res.json(deals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk approve route must be defined BEFORE parameterized routes like /api/deals/:id
  app.patch("/api/deals/bulk-approve", requireAuth, async (req, res) => {
    try {
      const { dealIds } = req.body;
      if (!Array.isArray(dealIds) || dealIds.length === 0) {
        return res.status(400).json({ error: "dealIds array is required" });
      }
      const approvedDeals = await storage.bulkApproveDeals(dealIds);
      
      if (approvedDeals.length > 0) {
        const moderationRecipients = await storage.getActiveEmailRecipientsByType("moderation");
        if (moderationRecipients.length > 0) {
          const emails = moderationRecipients.map(r => r.email);
          const forwardedBy = req.session.username || "Unknown";
          for (const deal of approvedDeals) {
            sendModerationNotification(deal, emails, forwardedBy).catch(err => {
              console.error("[Email] Error sending moderation notification:", err);
            });
          }
        }
      }
      
      res.json({ success: true, count: approvedDeals.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertDealSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const deal = await storage.updateDeal(req.params.id, validatedData);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/approve", requireAuth, async (req, res) => {
    try {
      const existingDeal = await storage.getDealById(req.params.id);
      if (!existingDeal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      const wasAlreadyApproved = existingDeal.status === "approved";
      
      const deal = await storage.approveDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      if (!wasAlreadyApproved) {
        const moderationRecipients = await storage.getActiveEmailRecipientsByType("moderation");
        if (moderationRecipients.length > 0) {
          const emails = moderationRecipients.map(r => r.email);
          const forwardedBy = req.session.username || "Unknown";
          sendModerationNotification(deal, emails, forwardedBy).catch(err => {
            console.error("[Email] Error sending moderation notification:", err);
          });
        }
      }
      
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/archive", requireAuth, async (req, res) => {
    try {
      const deal = await storage.archiveDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }

      const user = await storage.getAdminUser(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        console.log("Session saved - ID:", req.sessionID, "userId:", req.session.userId);
        res.json({ success: true, username: user.username, role: user.role });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    console.log("Session check - ID:", req.sessionID, "userId:", req.session.userId);
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        username: req.session.username,
        role: req.session.role 
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  app.get("/api/admin-users", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const users = await storage.getAllAdminUsers();
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin-users", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { username, password, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password required" });
      }
      const existing = await storage.getAdminUser(username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createAdminUser({ 
        username, 
        password: hashedPassword, 
        role: role || "user" 
      });
      const { password: _, ...sanitizedUser } = user;
      res.status(201).json(sanitizedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin-users/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { password, role } = req.body;
      const updateData: { password?: string; role?: string } = {};
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      if (role) {
        updateData.role = role;
      }
      const user = await storage.updateAdminUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin-users/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const user = await storage.getAdminUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.username === "admin") {
        return res.status(400).json({ error: "Cannot delete the default admin user" });
      }
      await storage.deleteAdminUser(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/admin-fields", requireAuth, async (req, res) => {
    try {
      const { adminComment } = req.body;
      const username = req.session.username || "Unknown";
      const deal = await storage.updateDealAdminFields(req.params.id, adminComment || null, username);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/merchant-ids", requireAuth, async (req, res) => {
    try {
      const { merchantUserId, merchantBranchId } = req.body;
      const deal = await storage.updateDealMerchantIds(req.params.id, merchantUserId || null, merchantBranchId || null);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const allCategories = await storage.getAllCategories();
      const allSubCategories = await storage.getAllSubCategories();
      const categoriesWithSubs = allCategories.map(cat => ({
        ...cat,
        subCategories: allSubCategories.filter(sub => sub.categoryId === cat.id)
      }));
      res.json(categoriesWithSubs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const { name, oldName } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const category = await storage.updateCategory(req.params.id, name);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      if (oldName && oldName !== name) {
        await storage.updateDealCategories(oldName, name);
      }
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subcategories", requireAuth, async (req, res) => {
    try {
      const validatedData = insertSubCategorySchema.parse(req.body);
      const subCategory = await storage.createSubCategory(validatedData);
      res.status(201).json(subCategory);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/subcategories/:id", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      const subCategory = await storage.updateSubCategory(req.params.id, name);
      if (!subCategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.json(subCategory);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/subcategories/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteSubCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Terms management routes
  app.get("/api/terms", async (req, res) => {
    try {
      const allTerms = await storage.getAllTerms();
      res.json(allTerms);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/terms/:type", async (req, res) => {
    try {
      const typeTerms = await storage.getTermsByType(req.params.type);
      res.json(typeTerms);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/terms", requireAuth, async (req, res) => {
    try {
      const validatedData = insertTermSchema.parse(req.body);
      const term = await storage.createTerm(validatedData);
      res.status(201).json(term);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/terms/:id", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      const term = await storage.updateTerm(req.params.id, text);
      if (!term) {
        return res.status(404).json({ error: "Term not found" });
      }
      res.json(term);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/terms/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTerm(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings/email-recipients", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const recipientType = (req.query.type as string) || "sales";
      const recipients = await storage.getEmailRecipientsByType(recipientType);
      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings/email-recipients", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertEmailRecipientSchema.parse(req.body);
      const recipient = await storage.createEmailRecipient(validatedData);
      res.status(201).json(recipient);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "This email address already exists for this recipient type" });
      }
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/settings/email-recipients/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { email, isActive } = req.body;
      const recipient = await storage.updateEmailRecipient(req.params.id, { email, isActive });
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }
      res.json(recipient);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "This email address already exists" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/settings/email-recipients/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      await storage.deleteEmailRecipient(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings/email-config", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const settings = await storage.getEmailSettings();
      if (settings) {
        res.json({
          ...settings,
          apiKey: settings.apiKey ? "••••••••" + settings.apiKey.slice(-4) : null,
        });
      } else {
        res.json(null);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings/email-config", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { provider, apiKey, fromEmail, fromName, isEnabled } = req.body;
      
      const updateData: any = { provider, fromEmail, fromName, isEnabled };
      if (apiKey && !apiKey.startsWith("••••")) {
        updateData.apiKey = apiKey;
      }
      
      const settings = await storage.upsertEmailSettings(updateData);
      res.json({
        ...settings,
        apiKey: settings.apiKey ? "••••••••" + settings.apiKey.slice(-4) : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/settings/email-config/test", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const { testEmail } = req.body;
      if (!testEmail) {
        return res.status(400).json({ error: "Test email address is required" });
      }

      const { sendTestEmail } = await import("./email");
      const result = await sendTestEmail(testEmail);
      
      if (result.success) {
        res.json({ success: true, message: "Test email sent successfully" });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}

async function createDefaultAdminUser() {
  try {
    const existingAdmin = await storage.getAdminUser("admin");
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createAdminUser({
        username: "admin",
        password: hashedPassword,
        role: "admin",
      });
      console.log("Default admin user created: username=admin, password=admin123");
    } else if (existingAdmin.role !== "admin") {
      await storage.updateAdminUser(existingAdmin.id, { role: "admin" });
      console.log("Updated existing admin user to have admin role");
    }
  } catch (error) {
    console.error("Error creating default admin user:", error);
  }
}
