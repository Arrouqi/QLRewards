import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDealSchema, insertAdminUserSchema, insertCategorySchema, insertSubCategorySchema, insertTermSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
    username: string;
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
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "qatar-living-deals-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  await createDefaultAdminUser();

  app.post("/api/deals", async (req, res) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal(validatedData);
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
      const deal = await storage.approveDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
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

      res.json({ success: true, username: user.username });
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
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        username: req.session.username 
      });
    } else {
      res.status(401).json({ authenticated: false });
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

  app.post("/api/seed-deals", requireAuth, async (req, res) => {
    try {
      const dealTemplates = [
        { title: "50% Off All Pasta Dishes", category: "Food & Dining", subCategory: "Italian", dealType: "discount", discountPercentage: "50" },
        { title: "Buy 1 Get 1 Free Pizza", category: "Food & Dining", subCategory: "Italian", dealType: "bogo", discountPercentage: "" },
        { title: "QAR 100 Spa Voucher", category: "Beauty & Wellness", subCategory: "Spa", dealType: "voucher", discountPercentage: "" },
        { title: "30% Off Gym Membership", category: "Health & Fitness", subCategory: "Gym", dealType: "discount", discountPercentage: "30" },
        { title: "Family Bundle Meal Deal", category: "Food & Dining", subCategory: "Fast Food", dealType: "bundle", discountPercentage: "" },
        { title: "20% Off Car Wash", category: "Automotive", subCategory: "Car Care", dealType: "discount", discountPercentage: "20" },
        { title: "Buy 1 Get 1 Coffee", category: "Food & Dining", subCategory: "Cafe", dealType: "bogo", discountPercentage: "" },
        { title: "QAR 200 Shopping Voucher", category: "Shopping", subCategory: "Mall", dealType: "voucher", discountPercentage: "" },
        { title: "40% Off Haircut", category: "Beauty & Wellness", subCategory: "Salon", dealType: "discount", discountPercentage: "40" },
        { title: "Kids Play Area Bundle", category: "Entertainment", subCategory: "Kids", dealType: "bundle", discountPercentage: "" },
        { title: "25% Off Hotel Stay", category: "Travel", subCategory: "Hotels", dealType: "discount", discountPercentage: "25" },
        { title: "Buy 1 Get 1 Movie Ticket", category: "Entertainment", subCategory: "Cinema", dealType: "bogo", discountPercentage: "" },
        { title: "QAR 50 Bookstore Voucher", category: "Shopping", subCategory: "Books", dealType: "voucher", discountPercentage: "" },
        { title: "35% Off Electronics", category: "Shopping", subCategory: "Electronics", dealType: "discount", discountPercentage: "35" },
        { title: "Dessert Combo Bundle", category: "Food & Dining", subCategory: "Desserts", dealType: "bundle", discountPercentage: "" },
        { title: "15% Off Dry Cleaning", category: "Services", subCategory: "Laundry", dealType: "discount", discountPercentage: "15" },
        { title: "Buy 1 Get 1 Juice", category: "Food & Dining", subCategory: "Cafe", dealType: "bogo", discountPercentage: "" },
        { title: "QAR 150 Furniture Voucher", category: "Shopping", subCategory: "Home", dealType: "voucher", discountPercentage: "" },
        { title: "45% Off Yoga Classes", category: "Health & Fitness", subCategory: "Yoga", dealType: "discount", discountPercentage: "45" },
        { title: "Weekend Brunch Bundle", category: "Food & Dining", subCategory: "Brunch", dealType: "bundle", discountPercentage: "" },
      ];

      const createdDeals = [];
      for (const template of dealTemplates) {
        const deal = await storage.createDeal({
          category: template.category,
          subCategory: template.subCategory,
          dealType: template.dealType,
          duration: "monthly",
          redemption: "unlimited",
          originalPrice: String(Math.floor(Math.random() * 500) + 50),
          isMultipleItems: false,
          discountPercentage: template.discountPercentage || undefined,
          isTwoTranches: false,
          specificDays: false,
          title: template.title,
          description: `Enjoy this amazing ${template.dealType} deal! Limited time offer.`,
          claimRules: ["Deal Valid for Dine-in, Delivery & Take away"],
          generalRules: ["Deal is not applicable on public holidays & all special events"],
          branches: ["Main Branch", "City Center Branch"],
        });
        createdDeals.push(deal);
      }

      res.json({ success: true, count: createdDeals.length });
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
      });
      console.log("Default admin user created: username=admin, password=admin123");
    }
  } catch (error) {
    console.error("Error creating default admin user:", error);
  }
}
