import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDealSchema, insertAdminUserSchema, insertCategorySchema, insertSubCategorySchema, insertTermSchema, insertEmailRecipientSchema, insertMerchantSchema, insertMerchantDealSchema, insertMerchantNoteSchema, brandPayloadSchema, insertFeedbackSchema, insertFeedbackCommentSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { sendNewDealNotification, sendModerationNotification, sendMerchantConfirmation, sendMerchantOnboardingNotification, sendMerchantModerationNotification, sendMerchantOnboardingConfirmation, sendMerchantSignedContractConfirmation, sendFeedbackNotification } from "./email";
import { uploadMultipleImages, migrateExistingImages } from "./azureStorage";
import { parseUserAgent } from "./uaParser";
import path from "path";

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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: admin access required" });
  }
}

async function checkMerchantRoleAccess(req: Request, res: Response, merchantId: string): Promise<boolean> {
  const userRole = req.session.role || "user";
  if (userRole === "admin") return true;
  const merchant = await storage.getMerchantById(merchantId);
  if (!merchant) { res.status(404).json({ error: "Merchant not found" }); return false; }
  if (userRole === "sales" && merchant.status !== "pending") {
    res.status(403).json({ error: "Sales team can only modify merchants in With Sales status" });
    return false;
  }
  if (userRole === "moderation" && merchant.status === "pending") {
    res.status(403).json({ error: "Moderation team cannot modify merchants in With Sales status" });
    return false;
  }
  return true;
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

  async function logFormSubmission(
    formType: string,
    status: "success" | "failed" | "validation_error",
    req: Request,
    startTime: number,
    options?: { errorMessage?: string; errorDetails?: string; merchantId?: string }
  ) {
    try {
      const isEnabled = await storage.getSystemSetting("submission_logging_enabled");
      if (isEnabled !== "true") return;

      const body = req.body || {};
      const fieldsMap: Record<string, string> = {};
      const fileFieldsList: string[] = [];

      for (const [key, value] of Object.entries(body)) {
        if (key === "images" || key === "deals") {
          if (key === "images" && Array.isArray(value)) {
            fileFieldsList.push(`images: ${value.length} file(s), sizes: [${value.map((v: any) => typeof v === "string" ? `${Math.round(v.length / 1024)}KB` : "?").join(", ")}]`);
            fieldsMap[key] = `[${value.length} images]`;
          } else if (key === "deals" && Array.isArray(value)) {
            fieldsMap[key] = `[${value.length} deal(s)]`;
            value.forEach((deal: any, i: number) => {
              if (deal.images && Array.isArray(deal.images)) {
                fileFieldsList.push(`deal[${i}].images: ${deal.images.length} file(s), sizes: [${deal.images.map((v: any) => typeof v === "string" ? `${Math.round(v.length / 1024)}KB` : "?").join(", ")}]`);
              }
              for (const [dk, dv] of Object.entries(deal)) {
                if (dk !== "images") {
                  fieldsMap[`deals[${i}].${dk}`] = typeof dv === "string" && dv.startsWith("data:") ? `[file: ${Math.round(dv.length / 1024)}KB]` : String(dv ?? "");
                }
              }
            });
          }
        } else if (typeof value === "string" && value.startsWith("data:")) {
          fileFieldsList.push(`${key}: ${Math.round(value.length / 1024)}KB`);
          fieldsMap[key] = `[file uploaded: ${Math.round(value.length / 1024)}KB]`;
        } else if (Array.isArray(value)) {
          fieldsMap[key] = JSON.stringify(value);
        } else {
          fieldsMap[key] = String(value ?? "");
        }
      }

      const sanitizedBody: Record<string, any> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string" && value.startsWith("data:")) {
          sanitizedBody[key] = `[BASE64_FILE: ${Math.round(value.length / 1024)}KB]`;
        } else if (key === "images" && Array.isArray(value)) {
          sanitizedBody[key] = value.map((v: any) => typeof v === "string" && v.startsWith("data:") ? `[BASE64_IMAGE: ${Math.round(v.length / 1024)}KB]` : v);
        } else if (key === "deals" && Array.isArray(value)) {
          sanitizedBody[key] = value.map((deal: any) => {
            const d = { ...deal };
            if (d.images && Array.isArray(d.images)) {
              d.images = d.images.map((img: any) => typeof img === "string" && img.startsWith("data:") ? `[BASE64_IMAGE: ${Math.round(img.length / 1024)}KB]` : img);
            }
            for (const [dk, dv] of Object.entries(d)) {
              if (typeof dv === "string" && (dv as string).startsWith("data:")) {
                d[dk] = `[BASE64_FILE: ${Math.round((dv as string).length / 1024)}KB]`;
              }
            }
            return d;
          });
        } else {
          sanitizedBody[key] = value;
        }
      }

      await storage.createSubmissionLog({
        formType,
        status,
        requestBody: JSON.stringify(sanitizedBody, null, 2),
        fieldsReceived: JSON.stringify(fieldsMap, null, 2),
        fileFields: fileFieldsList.length > 0 ? JSON.stringify(fileFieldsList) : null,
        errorMessage: options?.errorMessage || null,
        errorDetails: options?.errorDetails || null,
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
        processingTimeMs: Date.now() - startTime,
      });
    } catch (logError) {
      console.error("[SubmissionLog] Failed to write log:", logError);
    }
  }

  // Pretty-URL alias for the QL deals deep-link landing page (the actual file lives in client/public/ql-deals.html)
  app.get(["/ql-deals", "/ql-deal", "/deals-app"], (_req, res) => {
    res.sendFile(path.resolve(import.meta.dirname, "..", "client", "public", "ql-deals.html"));
  });

  // Per-IP rate limiter factory for public endpoints (in-memory; resets on restart)
  function makeRateLimiter(opts: { windowMs: number; max: number; onLimit?: (res: Response) => void }) {
    const buckets = new Map<string, { count: number; windowStart: number }>();
    return function rateLimit(req: Request, res: Response, next: NextFunction) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      const b = buckets.get(ip);
      if (!b || now - b.windowStart > opts.windowMs) {
        buckets.set(ip, { count: 1, windowStart: now });
      } else {
        b.count++;
        if (b.count > opts.max) {
          if (opts.onLimit) {
            opts.onLimit(res);
          } else {
            res.status(429).json({ error: "Too many requests. Please try again later." });
          }
          return;
        }
      }
      if (buckets.size > 5000) {
        for (const [k, v] of buckets) {
          if (now - v.windowStart > opts.windowMs) buckets.delete(k);
        }
      }
      next();
    };
  }

  // Existing tracking endpoint: silent 204 drop on overflow
  const trackRateLimit = makeRateLimiter({
    windowMs: 60_000,
    max: 30,
    onLimit: (res) => res.status(204).end(),
  });

  // Public Feedback submit: 5 per minute per IP — generous for legit shoppers, blocks abuse
  const feedbackSubmitRateLimit = makeRateLimiter({ windowMs: 60_000, max: 5 });

  // Public merchant search (Feedback form picker): 60 per minute per IP — supports type-as-you-search
  const publicMerchantsRateLimit = makeRateLimiter({ windowMs: 60_000, max: 60 });

  // Public tracking endpoint for the ql-deals redirect page (called via sendBeacon)
  app.post("/api/track/ql-deals", trackRateLimit, express.json({ limit: "10kb" }), async (req, res) => {
    try {
      const body = (req.body || {}) as { visitorId?: string; platform?: string; outcome?: string; pagePath?: string };
      const ua = req.headers["user-agent"] || "";
      const parsed = parseUserAgent(ua);
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
      const referrer = (req.headers["referer"] as string) || null;

      const allowedPlatforms = new Set(["ios", "android", "desktop"]);
      const allowedOutcomes = new Set(["app_attempt", "store", "web"]);

      await storage.createRedirectLog({
        visitorId: typeof body.visitorId === "string" ? body.visitorId.slice(0, 64) : null,
        platform: body.platform && allowedPlatforms.has(body.platform) ? body.platform : null,
        outcome: body.outcome && allowedOutcomes.has(body.outcome) ? body.outcome : null,
        browser: parsed.browser,
        os: parsed.os,
        device: parsed.device,
        userAgent: typeof ua === "string" ? ua.slice(0, 1000) : null,
        ipAddress: ip,
        referrer: referrer ? referrer.slice(0, 500) : null,
        pagePath: typeof body.pagePath === "string" ? body.pagePath.slice(0, 200) : null,
      });
      res.status(204).end();
    } catch (e) {
      console.error("[redirect-track] failed", e);
      res.status(204).end();
    }
  });

  // Admin analytics endpoints for redirect logs
  app.get("/api/admin/redirect-logs/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const sinceDays = req.query.sinceDays ? parseInt(req.query.sinceDays as string, 10) : undefined;
      const stats = await storage.getRedirectLogStats(sinceDays && sinceDays > 0 ? sinceDays : undefined);
      res.json(stats);
    } catch (e: any) {
      console.error("[redirect-stats] failed", e);
      res.status(500).json({ error: "Failed to load stats" });
    }
  });

  app.get("/api/admin/redirect-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const PAGE_SIZE = 50;
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const sinceDays = req.query.sinceDays ? parseInt(req.query.sinceDays as string, 10) : undefined;
      const since = sinceDays && sinceDays > 0 ? sinceDays : undefined;
      const offset = (page - 1) * PAGE_SIZE;
      const [rows, total] = await Promise.all([
        storage.getRedirectLogs(PAGE_SIZE, offset, since),
        storage.getRedirectLogCount(since),
      ]);
      res.json({ rows, total, page, pageSize: PAGE_SIZE });
    } catch (e: any) {
      console.error("[redirect-logs] failed", e);
      res.status(500).json({ error: "Failed to load logs" });
    }
  });

  app.get("/api/admin/redirect-logs/export", requireAuth, requireAdmin, async (req, res) => {
    try {
      const sinceDays = req.query.sinceDays ? parseInt(req.query.sinceDays as string, 10) : undefined;
      const since = sinceDays && sinceDays > 0 ? sinceDays : undefined;
      const rows = await storage.getRedirectLogs(10000, 0, since);
      res.json(rows);
    } catch (e: any) {
      console.error("[redirect-logs-export] failed", e);
      res.status(500).json({ error: "Failed to export logs" });
    }
  });

  app.delete("/api/admin/redirect-logs", requireAuth, requireAdmin, async (_req, res) => {
    try {
      await storage.clearRedirectLogs();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  // ===== Feedbacks =====
  // Public: upload evidence files for feedback forms (rate-limited, max 6)
  app.post("/api/feedbacks/upload", feedbackSubmitRateLimit, async (req, res) => {
    try {
      const { files } = req.body as { files: string[] };
      if (!Array.isArray(files) || files.length === 0 || files.length > 6) {
        return res.status(400).json({ error: "Provide 1–6 files as base64 data URLs" });
      }
      const urls = await uploadMultipleImages(files, `feedback-evidence/${Date.now()}`);
      res.json({ urls });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Upload failed" });
    }
  });

  // Public: submit a feedback (rate-limited)
  app.post("/api/feedbacks", feedbackSubmitRateLimit, async (req, res) => {
    try {
      const data = insertFeedbackSchema.parse(req.body);
      if (!data.feedbackType || !["mystery_shopper", "merchant_referral"].includes(data.feedbackType)) {
        return res.status(400).json({ error: "Invalid feedbackType" });
      }
      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        null;
      const userAgent = (req.headers["user-agent"] as string) || null;
      const feedback = await storage.createFeedback({ ...data, ipAddress, userAgent });

      // Notify (same recipients as merchant onboarding alerts)
      try {
        const recipients = await storage.getActiveEmailRecipientsByType("sales");
        const emails = recipients.map((r) => r.email);
        if (emails.length > 0) {
          sendFeedbackNotification(feedback, emails).catch((err) => {
            console.error("[Email] Failed feedback notification:", err);
          });
        }
      } catch (err) {
        console.error("[Feedback] notify error:", err);
      }

      res.json({ success: true, id: feedback.id });
    } catch (err: any) {
      console.error("[Feedback] create error:", err);
      res.status(400).json({ error: err?.message || "Failed to submit feedback" });
    }
  });

  // Admin: list feedbacks (any auth role)
  app.get("/api/feedbacks", requireAuth, async (req, res) => {
    try {
      const { type, status, search } = req.query as Record<string, string | undefined>;
      const list = await storage.getAllFeedbacks({
        feedbackType: type || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch feedbacks" });
    }
  });

  // Admin: get one with comments
  app.get("/api/feedbacks/:id", requireAuth, async (req, res) => {
    try {
      const feedback = await storage.getFeedbackById(req.params.id);
      if (!feedback) return res.status(404).json({ error: "Feedback not found" });
      const comments = await storage.getFeedbackComments(feedback.id);
      res.json({ ...feedback, comments });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch feedback" });
    }
  });

  // Admin: update status
  app.patch("/api/feedbacks/:id", requireAuth, async (req, res) => {
    try {
      const { status } = req.body as { status?: string };
      if (!status || !["new", "reviewed", "archived"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updateFeedbackStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: "Feedback not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update feedback" });
    }
  });

  // Admin only: delete
  app.delete("/api/feedbacks/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteFeedback(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete feedback" });
    }
  });

  // Admin: comments
  app.post("/api/feedbacks/:id/comments", requireAuth, async (req, res) => {
    try {
      const data = insertFeedbackCommentSchema.parse({
        feedbackId: req.params.id,
        author: (req.session as any)?.username || "admin",
        content: req.body?.content,
      });
      if (!data.content || !data.content.trim()) {
        return res.status(400).json({ error: "Comment content is required" });
      }
      const comment = await storage.createFeedbackComment(data);
      res.json(comment);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to add comment" });
    }
  });

  app.post("/api/deals", async (req, res) => {
    const startTime = Date.now();
    try {
      const validatedData = insertDealSchema.parse(req.body);
      
      const tempDeal = await storage.createDeal({ ...validatedData, images: [] });
      
      if (validatedData.images && validatedData.images.length > 0) {
        try {
          const imageUrls = await uploadMultipleImages(validatedData.images, tempDeal.id);
          await storage.updateDeal(tempDeal.id, { images: imageUrls });
          tempDeal.images = imageUrls;
        } catch (uploadError) {
          console.error("[Azure] Image upload failed:", uploadError);
        }
      }
      
      const deal = await storage.getDealById(tempDeal.id);
      
      sendMerchantConfirmation(deal!).catch(err => {
        console.error("[Email] Error sending merchant confirmation:", err);
      });
      
      const activeRecipients = await storage.getActiveEmailRecipientsByType("sales");
      if (activeRecipients.length > 0) {
        const emails = activeRecipients.map(r => r.email);
        sendNewDealNotification(deal!, emails).catch(err => {
          console.error("[Email] Error sending notification:", err);
        });
      }
      
      await logFormSubmission("deal_creation", "success", req, startTime);
      res.status(201).json(deal);
    } catch (error: any) {
      console.error("Deal creation error:", error);
      const isValidation = error.name === "ZodError";
      if (isValidation && error.issues) {
        const fieldErrors = error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`);
        const errorMsg = `Validation failed: ${fieldErrors.join("; ")}`;
        await logFormSubmission("deal_creation", "validation_error", req, startTime, {
          errorMessage: errorMsg,
          errorDetails: JSON.stringify(error.issues, null, 2),
        });
        return res.status(400).json({ error: errorMsg, details: error.issues });
      }
      await logFormSubmission("deal_creation", "failed", req, startTime, {
        errorMessage: error.message,
        errorDetails: error.stack,
      });
      res.status(500).json({ error: error.message || "Failed to create deal. Please try again." });
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

  // Lightweight summary endpoint - excludes images and heavy data
  app.get("/api/deals/summary", requireAuth, async (req, res) => {
    try {
      const deals = await storage.getAllDealSummaries();
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

  app.get("/api/deals/:id/download-image/:index", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      const index = parseInt(req.params.index);
      if (isNaN(index) || !deal.images || index < 0 || index >= deal.images.length) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      const imageUrl = deal.images[index];
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        return res.status(500).json({ error: "Failed to fetch image" });
      }
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="deal-${deal.id}-image-${index + 1}.${extension}"`);
      
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("[Download] Image download failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      const partialSchema = insertDealSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Handle image uploads to Azure if images are provided
      if (validatedData.images && validatedData.images.length > 0) {
        const hasBase64 = validatedData.images.some(img => img && img.startsWith("data:"));
        if (hasBase64) {
          try {
            const imageUrls = await uploadMultipleImages(validatedData.images, req.params.id);
            validatedData.images = imageUrls;
          } catch (uploadError) {
            console.error("[Azure] Image upload failed:", uploadError);
          }
        }
      }
      
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

  app.patch("/api/deals/:id/advance", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      const pipeline = ["pending", "approved", "created", "licensing", "published"];
      const currentIdx = pipeline.indexOf(deal.status);
      if (currentIdx < 0 || currentIdx >= pipeline.length - 1) {
        return res.status(400).json({ error: "Deal cannot be advanced further" });
      }
      const nextStatus = pipeline[currentIdx + 1];
      const updated = await storage.updateDeal(req.params.id, { status: nextStatus });
      if (nextStatus === "approved" && deal.status === "pending") {
        const moderationRecipients = await storage.getActiveEmailRecipientsByType("moderation");
        if (moderationRecipients.length > 0) {
          const emails = moderationRecipients.map((r: any) => r.email);
          const forwardedBy = req.session.username || "Unknown";
          sendModerationNotification(deal, emails, forwardedBy).catch((err: any) => {
            console.error("[Email] Error sending moderation notification:", err);
          });
        }
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/archive", requireAuth, async (req, res) => {
    try {
      const role = req.session.role;
      if (role === "sales") {
        return res.status(403).json({ error: "You do not have permission to archive deal requests." });
      }
      const deal = await storage.archiveDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/revert-pending", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      const pipeline = ["pending", "approved", "created", "licensing", "published"];
      if (!pipeline.includes(deal.status) || deal.status === "pending") {
        return res.status(400).json({ error: "Deal cannot be reverted to pending from its current status" });
      }
      const updated = await storage.updateDeal(req.params.id, { status: "pending" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/deals/:id/restore-pending", requireAuth, async (req, res) => {
    try {
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      if (deal.status !== "archived") {
        return res.status(400).json({ error: "Can only restore archived deals" });
      }
      const updated = await storage.updateDeal(req.params.id, { status: "pending" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/deals/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const deal = await storage.getDealById(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      if (deal.status !== "archived") {
        return res.status(400).json({ error: "Only archived deals can be permanently deleted" });
      }
      await storage.deleteDeal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check Azure Storage configuration
  app.get("/api/admin/azure-status", requireAuth, async (req, res) => {
    try {
      const hasConnectionString = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
      const connectionStringLength = process.env.AZURE_STORAGE_CONNECTION_STRING?.length || 0;
      
      res.json({
        configured: hasConnectionString,
        connectionStringLength,
        message: hasConnectionString 
          ? "Azure Storage connection string is configured" 
          : "AZURE_STORAGE_CONNECTION_STRING environment variable is not set"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Migrate existing base64 images to Azure Storage
  app.post("/api/admin/migrate-images", requireAuth, async (req, res) => {
    try {
      console.log("[Migration] Starting image migration...");
      const deals = await storage.getAllDeals();
      console.log(`[Migration] Found ${deals.length} total deals`);
      
      const dealsWithImages = deals.filter(deal => deal.images && deal.images.length > 0);
      console.log(`[Migration] Found ${dealsWithImages.length} deals with images`);
      
      const dealsWithBase64 = deals.filter(deal => 
        deal.images && deal.images.some(img => img && img.startsWith("data:"))
      );
      console.log(`[Migration] Found ${dealsWithBase64.length} deals with base64 images to migrate`);
      
      if (dealsWithBase64.length === 0) {
        return res.json({ 
          message: "No deals with base64 images to migrate", 
          migrated: 0,
          totalDeals: deals.length,
          dealsWithImages: dealsWithImages.length
        });
      }
      
      const migratedUrls = await migrateExistingImages(dealsWithBase64);
      
      let migratedCount = 0;
      const entries = Array.from(migratedUrls.entries());
      for (const entry of entries) {
        const dealId = entry[0];
        const urls = entry[1];
        const hasUrls = urls.some((url: string) => url.startsWith("http"));
        if (hasUrls) {
          await storage.updateDeal(dealId, { images: urls });
          migratedCount++;
          console.log(`[Migration] Updated deal ${dealId} with ${urls.length} Azure URLs`);
        }
      }
      
      res.json({ 
        message: `Successfully migrated ${migratedCount} deals`, 
        migrated: migratedCount,
        total: dealsWithBase64.length 
      });
    } catch (error: any) {
      console.error("[Migration] Error:", error);
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
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
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
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subcategories", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertSubCategorySchema.parse(req.body);
      const subCategory = await storage.createSubCategory(validatedData);
      res.status(201).json(subCategory);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/subcategories/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
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
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
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
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const validatedData = insertTermSchema.parse(req.body);
      const term = await storage.createTerm(validatedData);
      res.status(201).json(term);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/terms/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
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
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
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

  // Merchant Onboarding Routes
  app.post("/api/merchants", async (req, res) => {
    const startTime = Date.now();
    try {
      const { deals, brands, ...merchantData } = req.body;
      const isGroup = merchantData.companyType === "group";
      
      const documentFields = ['crDocument', 'establishmentCard', 'tradeLicense', 'menuPriceList', 'companyStamp', 'signedContractUpload', 'taxCardDocument', 'logo', 'coverImage'];
      for (const field of documentFields) {
        if (merchantData[field] && merchantData[field].startsWith('data:')) {
          try {
            const urls = await uploadMultipleImages([merchantData[field]], `merchant-${field}`);
            merchantData[field] = urls[0];
          } catch (uploadError) {
            console.error(`[Azure] ${field} upload failed:`, uploadError);
            await logFormSubmission("merchant_onboarding", "failed", req, startTime, {
              errorMessage: `File upload failed for ${field}: ${(uploadError as Error).message}`,
              errorDetails: (uploadError as Error).stack,
            });
            return res.status(500).json({ error: `Failed to upload ${field}. Please try again.` });
          }
        }
      }

      // For group: upload all brand documents to Azure before creating merchant
      const brandDocFields = ['crDocument', 'establishmentCard', 'tradeLicense', 'menuPriceList', 'taxCardDocument', 'logo', 'coverImage'];
      const processedBrands: any[] = [];
      if (isGroup && Array.isArray(brands)) {
        if (brands.length < 1) {
          const errorMsg = "Group merchants must have at least one brand";
          await logFormSubmission("merchant_onboarding", "validation_error", req, startTime, { errorMessage: errorMsg });
          return res.status(400).json({ error: errorMsg });
        }
        if (brands.length > 50) {
          const errorMsg = "Group merchants cannot have more than 50 brands";
          await logFormSubmission("merchant_onboarding", "validation_error", req, startTime, { errorMessage: errorMsg });
          return res.status(400).json({ error: errorMsg });
        }
        for (let bIdx = 0; bIdx < brands.length; bIdx++) {
          const brandParse = brandPayloadSchema.safeParse(brands[bIdx]);
          if (!brandParse.success) {
            return res.status(400).json({ error: `Brand ${bIdx + 1} validation failed`, details: brandParse.error.flatten() });
          }
          const brand = { ...brands[bIdx] };
          for (const field of brandDocFields) {
            if (brand[field] && typeof brand[field] === 'string' && brand[field].startsWith('data:')) {
              try {
                const urls = await uploadMultipleImages([brand[field]], `merchant-brand-${bIdx}-${field}`);
                brand[field] = urls[0];
              } catch (uploadError) {
                console.error(`[Azure] Brand ${bIdx} ${field} upload failed:`, uploadError);
                await logFormSubmission("merchant_onboarding", "failed", req, startTime, {
                  errorMessage: `Brand file upload failed for ${field}: ${(uploadError as Error).message}`,
                  errorDetails: (uploadError as Error).stack,
                });
                return res.status(500).json({ error: `Failed to upload brand ${bIdx + 1} ${field}. Please try again.` });
              }
            }
          }
          processedBrands.push(brand);
        }
      }
      
      const parsedBranches = (merchantData.branches || []).map((b: string, idx: number) => {
        try {
          const parsed = typeof b === 'string' ? JSON.parse(b) : b;
          return parsed?.name || `Branch ${idx + 1}`;
        } catch {
          return b;
        }
      });
      
      // Skip deal validation entirely for group (deals added later via edit)
      if (!isGroup && deals && Array.isArray(deals)) {
        for (const deal of deals) {
          const dealBranches = deal.branches || [];
          if (parsedBranches.length > 1 && (!dealBranches || dealBranches.length === 0)) {
            const errorMsg = `Deal "${deal.title}" requires at least one branch when multiple branches exist`;
            await logFormSubmission("merchant_onboarding", "validation_error", req, startTime, { errorMessage: errorMsg });
            return res.status(400).json({ error: errorMsg });
          }
          const imgCount = (deal.images || []).length;
          if (imgCount < 4) {
            const errorMsg = `Each deal requires at least 4 images. "${deal.title || 'Untitled Deal'}" has ${imgCount}.`;
            await logFormSubmission("merchant_onboarding", "validation_error", req, startTime, { errorMessage: errorMsg });
            return res.status(400).json({ error: errorMsg });
          }
        }
      }
      
      const validatedMerchant = insertMerchantSchema.parse(merchantData);
      const merchant = await storage.createMerchant(validatedMerchant);

      // Save brands for group merchants
      if (isGroup && processedBrands.length > 0) {
        const brandRows = processedBrands.map((b, i) => ({
          brandName: b.brandName || null,
          address: b.address || null,
          contactPerson: b.contactPerson || null,
          email: b.email || null,
          phone: b.phone || null,
          whatsapp: b.whatsapp || null,
          crNumber: b.crNumber || null,
          crDocument: b.crDocument || null,
          tradeLicense: b.tradeLicense || null,
          taxCardDocument: b.taxCardDocument || null,
          establishmentCard: b.establishmentCard || null,
          menuPriceList: b.menuPriceList || null,
          logo: b.logo || null,
          coverImage: b.coverImage || null,
          businessCategories: b.businessCategories || null,
          displayOrder: i,
        }));
        await storage.replaceMerchantBrands(merchant.id, brandRows);
      }
      
      if (!isGroup && deals && Array.isArray(deals)) {
        for (const deal of deals) {
          try {
            let imageUrls: string[] = [];
            if (deal.images && deal.images.length > 0) {
              try {
                imageUrls = await uploadMultipleImages(deal.images, `merchant-${merchant.id}-deal`);
              } catch (uploadError) {
                console.error("[Azure] Deal image upload failed:", uploadError);
              }
            }
            
            let dealBranches = deal.branches || [];
            if (parsedBranches.length === 1 && (!dealBranches || dealBranches.length === 0)) {
              dealBranches = [parsedBranches[0]];
            }
            
            const dealData = {
              ...deal,
              merchantId: merchant.id,
              images: imageUrls,
              branches: dealBranches,
              discountPercentage: deal.discountedPrice ? null : (deal.discountPercentage || null),
              discountedPrice: deal.discountedPrice || null,
            };
            const validatedDeal = insertMerchantDealSchema.parse(dealData);
            await storage.createMerchantDeal(validatedDeal);
          } catch (dealError) {
            console.error("Error creating merchant deal:", dealError);
          }
        }
      }
      
      sendMerchantOnboardingConfirmation(merchant).catch(err => {
        console.error("[Email] Error sending merchant onboarding confirmation:", err);
      });
      
      const salesRecipients = await storage.getActiveEmailRecipientsByType("sales");
      if (salesRecipients.length > 0) {
        const emails = salesRecipients.map(r => r.email);
        sendMerchantOnboardingNotification(merchant, emails).catch(err => {
          console.error("[Email] Error sending merchant onboarding notification:", err);
        });
      }
      
      await logFormSubmission("merchant_onboarding", "success", req, startTime);
      res.status(201).json(merchant);
    } catch (error: any) {
      console.error("Merchant creation error:", error);
      const isValidation = error.name === "ZodError";
      if (isValidation && error.issues) {
        const fieldErrors = error.issues.map((issue: any) => `${issue.path.join(".")}: ${issue.message}`);
        const errorMsg = `Validation failed: ${fieldErrors.join("; ")}`;
        await logFormSubmission("merchant_onboarding", "validation_error", req, startTime, {
          errorMessage: errorMsg,
          errorDetails: JSON.stringify(error.issues, null, 2),
        });
        return res.status(400).json({ error: errorMsg, details: error.issues });
      }
      await logFormSubmission("merchant_onboarding", "failed", req, startTime, {
        errorMessage: error.message,
        errorDetails: error.stack,
      });
      res.status(500).json({ error: error.message || "Failed to create merchant. Please try again." });
    }
  });

  app.get("/api/merchants", requireAuth, async (req, res) => {
    try {
      const merchants = await storage.getAllMerchants();
      const enriched = await Promise.all(merchants.map(async (m) => {
        const deals = await storage.getMerchantDealsByMerchantId(m.id);
        return { ...m, dealCount: deals.length };
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/merchants/public/:id", async (req, res) => {
    try {
      const merchant = await storage.getMerchantById(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      const deals = await storage.getMerchantDealsByMerchantId(merchant.id);
      const brands = merchant.companyType === "group" ? await storage.getMerchantBrandsByMerchantId(merchant.id) : [];
      res.json({ ...merchant, deals, brands });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/merchants/:id", requireAuth, async (req, res) => {
    try {
      const merchant = await storage.getMerchantById(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      const deals = await storage.getMerchantDealsByMerchantId(merchant.id);
      const brands = merchant.companyType === "group" ? await storage.getMerchantBrandsByMerchantId(merchant.id) : [];
      res.json({ ...merchant, deals, brands });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/merchants/:id", requireAuth, async (req, res) => {
    try {
      const userRole = req.session.role || "user";
      const username = req.session.username || "Unknown";
      
      const existingMerchantForEdit = await storage.getMerchantById(req.params.id);
      if (!existingMerchantForEdit) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      if (userRole === "sales" && existingMerchantForEdit.status !== "pending") {
        return res.status(403).json({ error: "Sales team can only edit merchants in With Sales status" });
      }
      
      if (userRole === "moderation" && existingMerchantForEdit.status === "pending") {
        return res.status(403).json({ error: "Moderation team cannot edit merchants in With Sales status" });
      }
      
      const { deals: dealUpdates, brands: brandUpdates, ...merchantData } = req.body;
      
      // Lock companyType: never allow it to be changed via edit
      delete merchantData.companyType;
      const isGroup = existingMerchantForEdit.companyType === "group";
      
      const docFields = ['crDocument', 'establishmentCard', 'tradeLicense', 'menuPriceList', 'taxCardDocument', 'logo', 'coverImage'];
      for (const field of docFields) {
        if (merchantData[field] && merchantData[field].startsWith('data:')) {
          try {
            const urls = await uploadMultipleImages([merchantData[field]], `merchant-${req.params.id}-${field}`);
            merchantData[field] = urls[0];
          } catch (uploadError) {
            console.error(`[Azure] ${field} upload failed:`, uploadError);
          }
        }
      }

      // Process brand updates for group merchants
      const brandDocFields = ['crDocument', 'establishmentCard', 'tradeLicense', 'menuPriceList', 'taxCardDocument', 'logo', 'coverImage'];
      let processedBrandRows: any[] | null = null;
      if (isGroup && Array.isArray(brandUpdates)) {
        if (brandUpdates.length < 1) {
          return res.status(400).json({ error: "Group merchants must have at least one brand" });
        }
        if (brandUpdates.length > 50) {
          return res.status(400).json({ error: "Group merchants cannot have more than 50 brands" });
        }
        processedBrandRows = [];
        for (let bIdx = 0; bIdx < brandUpdates.length; bIdx++) {
          const brandParse = brandPayloadSchema.safeParse(brandUpdates[bIdx]);
          if (!brandParse.success) {
            return res.status(400).json({ error: `Brand ${bIdx + 1} validation failed`, details: brandParse.error.flatten() });
          }
          const brand = { ...brandUpdates[bIdx] };
          for (const field of brandDocFields) {
            if (brand[field] && typeof brand[field] === 'string' && brand[field].startsWith('data:')) {
              try {
                const urls = await uploadMultipleImages([brand[field]], `merchant-${req.params.id}-brand-${bIdx}-${field}`);
                brand[field] = urls[0];
              } catch (uploadError) {
                console.error(`[Azure] Brand ${bIdx} ${field} upload failed:`, uploadError);
                return res.status(500).json({ error: `Failed to upload brand ${bIdx + 1} ${field}.` });
              }
            }
          }
          processedBrandRows.push({
            brandName: brand.brandName || null,
            address: brand.address || null,
            contactPerson: brand.contactPerson || null,
            email: brand.email || null,
            phone: brand.phone || null,
            whatsapp: brand.whatsapp || null,
            crNumber: brand.crNumber || null,
            crDocument: brand.crDocument || null,
            tradeLicense: brand.tradeLicense || null,
            taxCardDocument: brand.taxCardDocument || null,
            establishmentCard: brand.establishmentCard || null,
            menuPriceList: brand.menuPriceList || null,
            logo: brand.logo || null,
            coverImage: brand.coverImage || null,
            businessCategories: brand.businessCategories || null,
            displayOrder: bIdx,
          });
        }
      }
      
      // Update merchant data (skip when nothing to update — e.g., body had only brands/deals/companyType)
      let merchant = existingMerchantForEdit;
      if (Object.keys(merchantData).length > 0) {
        const updated = await storage.updateMerchant(req.params.id, merchantData);
        if (!updated) {
          return res.status(404).json({ error: "Merchant not found" });
        }
        merchant = updated;
      }

      // Replace brands if provided
      if (processedBrandRows !== null) {
        await storage.replaceMerchantBrands(req.params.id, processedBrandRows);
      }
      
      // Update deals if provided
      if (dealUpdates && Array.isArray(dealUpdates)) {
        const existingDeals = await storage.getMerchantDealsByMerchantId(merchant.id);
        const existingDealIds = new Set(existingDeals.map(d => d.id));

        // Validate ownership: all deal IDs in the update must belong to this merchant
        const updatedDealIds = dealUpdates.filter((d: any) => d.id).map((d: any) => d.id);
        for (const dealId of updatedDealIds) {
          if (!existingDealIds.has(dealId)) {
            return res.status(400).json({ error: `Deal ${dealId} does not belong to this merchant` });
          }
        }

        // Validate min 4 images per deal
        for (const deal of dealUpdates) {
          const imgCount = (deal.images || []).length;
          if (imgCount < 4) {
            return res.status(400).json({ error: `Each deal requires at least 4 images. "${deal.title || 'Untitled Deal'}" has ${imgCount}.` });
          }
        }

        // Pre-upload all images before making any DB changes
        const processedDeals: Array<{ deal: any; images: string[] }> = [];
        for (const deal of dealUpdates) {
          let dealImages = deal.images || [];
          const hasNewImages = dealImages.some((img: string) => img && img.startsWith("data:"));
          if (hasNewImages) {
            const uploadedUrls = await uploadMultipleImages(dealImages, `merchant-${merchant.id}-deal`);
            dealImages = uploadedUrls;
          }
          processedDeals.push({ deal, images: dealImages });
        }

        // Validate new deals before any DB mutations
        const newDealPayloads: any[] = [];
        for (const { deal, images } of processedDeals) {
          if (!deal.id) {
            const dealData = {
              ...deal,
              merchantId: merchant.id,
              images,
              branches: deal.branches || [],
              claimRules: deal.claimRules || [],
              generalRules: deal.generalRules || [],
              discountPercentage: deal.discountedPrice ? null : (deal.discountPercentage || null),
              discountedPrice: deal.discountedPrice || null,
            };
            const validatedDeal = insertMerchantDealSchema.parse(dealData);
            newDealPayloads.push(validatedDeal);
          }
        }

        // All validation passed — now apply DB changes
        // Delete removed deals
        const updatedDealIdSet = new Set(updatedDealIds);
        for (const existing of existingDeals) {
          if (!updatedDealIdSet.has(existing.id)) {
            await storage.deleteMerchantDeal(existing.id);
          }
        }

        // Update existing deals
        for (const { deal, images } of processedDeals) {
          if (deal.id) {
            await storage.updateMerchantDeal(deal.id, {
              category: deal.category,
              subCategory: deal.subCategory,
              dealType: deal.dealType,
              duration: deal.duration,
              redemption: deal.redemption,
              limitPerUser: deal.limitPerUser || null,
              originalPrice: deal.originalPrice || null,
              isMultipleItems: deal.isMultipleItems || false,
              discountPercentage: deal.discountedPrice ? null : (deal.discountPercentage || null),
              discountedPrice: deal.discountedPrice || null,
              isTwoTranches: deal.isTwoTranches || false,
              trancheValidity: deal.trancheValidity || null,
              specificDays: deal.specificDays || false,
              days: deal.days || [],
              title: deal.title,
              description: deal.description || null,
              claimRules: deal.claimRules || [],
              generalRules: deal.generalRules || [],
              otherRules: deal.otherRules || null,
              branches: deal.branches || [],
              images,
              brandId: deal.brandId || null,
            });
          }
        }

        // Create new deals
        for (const validatedDeal of newDealPayloads) {
          await storage.createMerchantDeal(validatedDeal);
        }
      }
      
      storage.createActivityLog({
        username,
        action: "Edited merchant details",
        merchantId: req.params.id,
        merchantName: existingMerchantForEdit.companyName,
      }).catch(err => console.error("[ActivityLog] Error:", err));
      
      const updatedDeals = await storage.getMerchantDealsByMerchantId(merchant.id);
      res.json({ ...merchant, deals: updatedDeals });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/merchants/:id/offers-created", requireAuth, async (req, res) => {
    try {
      if (!(await checkMerchantRoleAccess(req, res, req.params.id))) return;
      const { offersCreated } = req.body;
      if (typeof offersCreated !== "number" || !Number.isInteger(offersCreated) || offersCreated < 0) {
        return res.status(400).json({ error: "Invalid offers count" });
      }
      const merchant = await storage.updateMerchantOffersCreated(req.params.id, offersCreated);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/merchants/:id", requireAuth, async (req, res) => {
    try {
      if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const merchant = await storage.getMerchantById(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      if (merchant.status !== "archived") {
        return res.status(400).json({ error: "Can only permanently delete archived merchants" });
      }
      await storage.deleteMerchant(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/merchants/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "moderation", "archived", "created", "licensing", "licensed", "trained"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const existingMerchant = await storage.getMerchantById(req.params.id);
      if (!existingMerchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      const userRole = req.session.role || "user";
      const username = req.session.username || "Unknown";
      
      const statusLabels: Record<string, string> = {
        pending: "With Sales", moderation: "In Moderation", created: "Created",
        licensing: "Licensing", licensed: "Licensed", trained: "Trained", archived: "Archived"
      };

      if (userRole === "sales") {
        const salesAllowed =
          (existingMerchant.status === "pending" && status === "moderation") ||
          (existingMerchant.status === "licensed" && status === "trained");
        if (!salesAllowed) {
          return res.status(403).json({ error: "Sales team can only forward merchants from With Sales to Moderation, or from Licensed to Trained" });
        }
      }
      
      if (userRole === "moderation") {
        const allowedFromStatuses = ["moderation", "created", "licensing", "licensed", "trained"];
        if (!allowedFromStatuses.includes(existingMerchant.status)) {
          return res.status(403).json({ error: "Moderation team can only manage merchants from In Moderation onwards" });
        }
        if (status === "trained") {
          return res.status(403).json({ error: "Only the Sales team can mark a merchant as Trained" });
        }
      }
      
      if (status === "created" && existingMerchant.status !== "moderation" && existingMerchant.status !== "licensing") {
        return res.status(400).json({ error: "Can only mark as Created from In Moderation or Licensing status" });
      }
      
      if (status === "licensing" && existingMerchant.status !== "created" && existingMerchant.status !== "licensed") {
        return res.status(400).json({ error: "Can only move to Licensing from Created or Licensed status" });
      }
      
      if (status === "licensed" && existingMerchant.status !== "licensing" && existingMerchant.status !== "trained") {
        return res.status(400).json({ error: "Can only mark as Licensed from Licensing or Trained status" });
      }

      if (status === "trained" && existingMerchant.status !== "licensed") {
        return res.status(400).json({ error: "Can only mark as Trained from Licensed status" });
      }
      
      if (status === "pending" && existingMerchant.status !== "moderation" && existingMerchant.status !== "archived") {
        return res.status(400).json({ error: "Can only move to With Sales from In Moderation or Archived status" });
      }
      
      if (status === "moderation" && existingMerchant.status !== "pending" && existingMerchant.status !== "archived" && existingMerchant.status !== "created") {
        return res.status(400).json({ error: "Can only forward to Moderation from With Sales, Created, or Archived status" });
      }
      
      if (status === "moderation") {
        const missingDocs: string[] = [];
        if (!existingMerchant.crDocument) missingDocs.push("CR Document");
        
        if (missingDocs.length > 0) {
          return res.status(400).json({ 
            error: `Missing required documents: ${missingDocs.join(", ")}`,
            missingDocs
          });
        }
        
        const merchantDeals = await storage.getMerchantDealsByMerchantId(req.params.id);
        const dealsWithFewImages = merchantDeals.filter(d => !d.images || d.images.length < 4);
        if (dealsWithFewImages.length > 0) {
          return res.status(400).json({ 
            error: `Each deal must have at least 4 images. ${dealsWithFewImages.length} deal(s) have fewer than 4 images.`,
            dealsWithFewImages: dealsWithFewImages.map(d => d.title)
          });
        }
      }
      
      const wasNotModeration = existingMerchant.status !== "moderation";
      
      const merchant = await storage.updateMerchantStatus(req.params.id, status);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      if (status === "moderation" && wasNotModeration) {
        await storage.updateMerchantSubmittedBy(req.params.id, username);
        
        const moderationRecipients = await storage.getActiveEmailRecipientsByType("moderation");
        if (moderationRecipients.length > 0) {
          const emails = moderationRecipients.map(r => r.email);
          sendMerchantModerationNotification(merchant, emails, username).catch(err => {
            console.error("[Email] Error sending merchant moderation notification:", err);
          });
        }
      }

      if (status === "pending") {
        await storage.updateMerchantSubmittedBy(req.params.id, null);
      }
      
      storage.createActivityLog({
        username,
        action: `Status: ${statusLabels[existingMerchant.status]} → ${statusLabels[status]}`,
        merchantId: req.params.id,
        merchantName: existingMerchant.companyName,
      }).catch(err => console.error("[ActivityLog] Error:", err));
      
      const updatedMerchant = await storage.getMerchantById(req.params.id);
      res.json(updatedMerchant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/merchants/:id/sales-order", requireAuth, async (req, res) => {
    try {
      if (!(await checkMerchantRoleAccess(req, res, req.params.id))) return;
      const { salesOrder } = req.body;

      if (!salesOrder) {
        return res.status(400).json({ error: "Sales order file is required" });
      }

      const existing = await storage.getMerchantById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      let uploadUrl = salesOrder;
      if (salesOrder.startsWith('data:')) {
        const mimeMatch = salesOrder.match(/^data:([^;]+);base64,/);
        if (!mimeMatch || !mimeMatch[1].includes('pdf')) {
          return res.status(400).json({ error: "Only PDF files are allowed" });
        }
        try {
          const urls = await uploadMultipleImages([salesOrder], `merchant-${req.params.id}-sales-order`);
          uploadUrl = urls[0];
        } catch (uploadError) {
          console.error("[Azure] Sales order upload failed:", uploadError);
          return res.status(500).json({ error: "Failed to upload sales order" });
        }
      }

      const merchant = await storage.updateMerchant(req.params.id, { salesOrder: uploadUrl });
      res.json(merchant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/merchants/:id/sales-order", requireAuth, async (req, res) => {
    try {
      if (!(await checkMerchantRoleAccess(req, res, req.params.id))) return;
      const existing = await storage.getMerchantById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const merchant = await storage.updateMerchant(req.params.id, { salesOrder: null });
      res.json(merchant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/merchants/:id/notes", requireAuth, async (req, res) => {
    try {
      const notes = await storage.getMerchantNotes(req.params.id);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/merchants/:id/notes", requireAuth, async (req, res) => {
    try {
      const merchant = await storage.getMerchantById(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Note content is required" });
      }
      const author = req.session.username || "Unknown";
      const note = await storage.createMerchantNote({
        merchantId: req.params.id,
        author,
        content: content.trim(),
      });
      res.status(201).json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/merchants/:id/trainings", requireAuth, async (req, res) => {
    try {
      const trainings = await storage.getMerchantTrainings(req.params.id);
      res.json(trainings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/merchants/:id/trainings", requireAuth, async (req, res) => {
    try {
      const userRole = (req.session as any).role;
      if (!["admin", "moderation", "sales"].includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const { trainingDate, trainingTime, trainerName, comment } = req.body;
      if (!trainingDate || !trainingTime || !trainerName) {
        return res.status(400).json({ error: "trainingDate, trainingTime, and trainerName are required" });
      }
      const existingMerchant = await storage.getMerchantById(req.params.id);
      if (!existingMerchant) return res.status(404).json({ error: "Merchant not found" });
      if (!["licensed", "trained"].includes(existingMerchant.status)) {
        return res.status(400).json({ error: "Training can only be added to Licensed or Trained merchants" });
      }
      const username = (req.session as any).username || "unknown";
      const training = await storage.createMerchantTraining({
        merchantId: req.params.id,
        trainingDate,
        trainingTime,
        trainerName,
        comment: comment || null,
        createdBy: username,
      });
      if (existingMerchant.status === "licensed") {
        await storage.updateMerchantStatus(req.params.id, "trained");
        await storage.createActivityLog({
          username,
          action: "status_change",
          merchantId: req.params.id,
          merchantName: existingMerchant.companyName,
          details: `Status changed from licensed to trained (first training added)`,
        });
      }
      await storage.createActivityLog({
        username,
        action: "training_added",
        merchantId: req.params.id,
        merchantName: existingMerchant.companyName,
        details: `Training added: ${trainerName} on ${trainingDate} at ${trainingTime}`,
      });
      res.json({ training, statusChanged: existingMerchant.status === "licensed" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/merchants/:id/upload-signed", requireAuth, async (req, res) => {
    try {
      if (!(await checkMerchantRoleAccess(req, res, req.params.id))) return;
      const existing = await storage.getMerchantById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const { signedContractUpload } = req.body;
      
      if (!signedContractUpload) {
        return res.status(400).json({ error: "Signed contract file is required" });
      }

      if (!signedContractUpload.startsWith('data:')) {
        return res.status(400).json({ error: "Invalid file upload format" });
      }

      const mimeMatch = signedContractUpload.match(/^data:([^;]+);base64,/);
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (!mimeMatch || !allowedMimes.includes(mimeMatch[1])) {
        return res.status(400).json({ error: "Only PDF and image files (JPEG, PNG, WebP) are allowed" });
      }

      let uploadUrl: string;
      try {
        const urls = await uploadMultipleImages([signedContractUpload], `merchant-${req.params.id}-signed`);
        uploadUrl = urls[0];
      } catch (uploadError) {
        console.error("[Azure] Signed contract upload failed:", uploadError);
        return res.status(500).json({ error: "Failed to upload signed contract" });
      }
      
      const merchant = await storage.updateMerchant(req.params.id, { signedContractUpload: uploadUrl });
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      
      sendMerchantSignedContractConfirmation(merchant).catch(err => {
        console.error("[Email] Error sending signed contract confirmation:", err);
      });
      
      res.json(merchant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public lightweight merchant lookup for the public Feedback form (name + id only) — rate-limited
  app.get("/api/public/merchants", publicMerchantsRateLimit, async (req, res) => {
    try {
      const esUrl = process.env.ELASTIC_URL;
      const esApiKey = process.env.ELASTIC_API_KEY;
      if (!esUrl || !esApiKey) {
        return res.json({ merchants: [], total: 0 });
      }
      const search = (req.query.search as string) || "";
      const size = Math.min(parseInt(req.query.size as string) || 30, 100);
      const query: any = search
        ? {
            bool: {
              should: [
                { match_phrase_prefix: { agencyName: search } },
                { wildcard: { agencyName: { value: `*${search.toLowerCase()}*`, case_insensitive: true } } },
              ],
              minimum_should_match: 1,
            },
          }
        : { match_all: {} };
      const esResponse = await fetch(`${esUrl}prod_merchants/_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${esApiKey}`,
        },
        body: JSON.stringify({
          query,
          size,
          _source: ["agencyName", "category"],
          sort: [{ "agencyName.keyword": { order: "asc", unmapped_type: "keyword" } }],
        }),
      });
      if (!esResponse.ok) return res.json({ merchants: [], total: 0 });
      const data = await esResponse.json();
      const merchants = (data.hits?.hits || []).map((hit: any) => ({
        id: hit._id,
        agencyName: hit._source?.agencyName,
        category: hit._source?.category?.name || hit._source?.category || undefined,
      }));
      res.json({ merchants, total: data.hits?.total?.value || 0 });
    } catch (e: any) {
      console.error("[public/merchants] error:", e.message);
      res.json({ merchants: [], total: 0 });
    }
  });

  app.get("/api/es/merchants", requireAuth, async (req, res) => {
    try {
      const esUrl = process.env.ELASTIC_URL;
      const esApiKey = process.env.ELASTIC_API_KEY;

      if (!esUrl || !esApiKey) {
        return res.status(500).json({ error: "Elasticsearch not configured" });
      }

      const search = (req.query.search as string) || "";
      const size = Math.min(parseInt(req.query.size as string) || 200, 1000);
      const from = parseInt(req.query.from as string) || 0;

      const query: any = search
        ? {
            bool: {
              should: [
                { match_phrase_prefix: { agencyName: search } },
                { wildcard: { agencyName: { value: `*${search.toLowerCase()}*`, case_insensitive: true } } },
                { match_phrase_prefix: { "user.email": search } },
                { match_phrase_prefix: { "category.name": search } },
              ],
              minimum_should_match: 1,
            },
          }
        : { match_all: {} };

      const esResponse = await fetch(`${esUrl}prod_merchants/_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${esApiKey}`,
        },
        body: JSON.stringify({ query, size, from, sort: [{ "agencyName.keyword": { order: "asc", unmapped_type: "keyword" } }] }),
      });

      if (!esResponse.ok) {
        const errorText = await esResponse.text();
        console.error("[ES] Search error:", errorText);
        return res.status(502).json({ error: "Failed to query Elasticsearch" });
      }

      const data = await esResponse.json();
      const merchants = data.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));

      res.json({
        merchants,
        total: data.hits.total?.value || 0,
      });
    } catch (error: any) {
      console.error("[ES] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stats/overview", requireAuth, async (req, res) => {
    try {
      const dateFrom = req.query.from as string | undefined;
      const dateTo = req.query.to as string | undefined;

      let allMerchants = await storage.getAllMerchants();
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        allMerchants = allMerchants.filter(m => new Date(m.createdAt) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        allMerchants = allMerchants.filter(m => new Date(m.createdAt) <= toDate);
      }

      const merchantStats = {
        total: allMerchants.filter(m => m.status !== "archived").length,
        pending: allMerchants.filter(m => m.status === "pending").length,
        moderation: allMerchants.filter(m => m.status === "moderation").length,
        created: allMerchants.filter(m => m.status === "created").length,
        licensing: allMerchants.filter(m => m.status === "licensing").length,
        licensed: allMerchants.filter(m => m.status === "licensed").length,
        trained: allMerchants.filter(m => m.status === "trained").length,
        archived: allMerchants.filter(m => m.status === "archived").length,
      };

      const allDeals = await storage.getAllDeals();
      let filteredDeals = allDeals;
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filteredDeals = filteredDeals.filter(d => new Date(d.createdAt) >= fromDate);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filteredDeals = filteredDeals.filter(d => new Date(d.createdAt) <= toDate);
      }

      const dealStats = {
        total: filteredDeals.filter(d => d.status !== "archived").length,
        pending: filteredDeals.filter(d => d.status === "pending").length,
        approved: filteredDeals.filter(d => d.status === "approved").length,
        archived: filteredDeals.filter(d => d.status === "archived").length,
      };

      const recentMerchants = allMerchants
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(m => ({ id: m.id, companyName: m.companyName, brandName: m.brandName, status: m.status, createdAt: m.createdAt }));

      const recentDeals = filteredDeals
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(d => ({ id: d.id, title: d.title, merchantName: d.merchantName, status: d.status, createdAt: d.createdAt }));

      res.json({ merchantStats, dealStats, recentMerchants, recentDeals });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/es/offers", requireAuth, async (req, res) => {
    try {
      const esUrl = process.env.ELASTIC_URL;
      const esApiKey = process.env.ELASTIC_API_KEY;

      if (!esUrl || !esApiKey) {
        return res.status(500).json({ error: "Elasticsearch not configured" });
      }

      const search = (req.query.search as string) || "";
      const size = Math.min(parseInt(req.query.size as string) || 200, 1000);
      const from = parseInt(req.query.from as string) || 0;

      const query: any = search
        ? {
            bool: {
              should: [
                { match_phrase_prefix: { title: search } },
                { match_phrase_prefix: { "agency.agencyName": search } },
                { match_phrase_prefix: { "category.name": search } },
              ],
              minimum_should_match: 1,
            },
          }
        : { match_all: {} };

      const esResponse = await fetch(`${esUrl}prod_offers/_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${esApiKey}`,
        },
        body: JSON.stringify({ query, size, from, sort: [{ _score: { order: "desc" } }] }),
      });

      if (!esResponse.ok) {
        const errorText = await esResponse.text();
        console.error("[ES] Offers search error:", errorText);
        return res.status(502).json({ error: "Failed to query Elasticsearch" });
      }

      const data = await esResponse.json();
      const offers = data.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));

      res.json({
        offers,
        total: data.hits.total?.value || 0,
      });
    } catch (error: any) {
      console.error("[ES] Offers error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/es/offers/counts-by-merchant", requireAuth, async (req, res) => {
    try {
      const esUrl = process.env.ELASTIC_URL;
      const esApiKey = process.env.ELASTIC_API_KEY;

      if (!esUrl || !esApiKey) {
        return res.json({ counts: {} });
      }

      const esResponse = await fetch(`${esUrl}prod_offers/_search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${esApiKey}`,
        },
        body: JSON.stringify({
          size: 0,
          aggs: {
            by_merchant: {
              terms: { field: "agency.agencyId", size: 500 },
            },
          },
        }),
      });

      if (!esResponse.ok) {
        return res.json({ counts: {} });
      }

      const data = await esResponse.json();
      const buckets = data.aggregations?.by_merchant?.buckets || [];
      const counts: Record<number, number> = {};
      for (const b of buckets) {
        counts[b.key] = b.doc_count;
      }
      res.json({ counts });
    } catch (error: any) {
      res.json({ counts: {} });
    }
  });

  app.get("/api/es/offers/count", requireAuth, async (req, res) => {
    try {
      const esUrl = process.env.ELASTIC_URL;
      const esApiKey = process.env.ELASTIC_API_KEY;

      if (!esUrl || !esApiKey) {
        return res.json({ count: 0 });
      }

      const esResponse = await fetch(`${esUrl}prod_offers/_count`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ApiKey ${esApiKey}`,
        },
        body: JSON.stringify({ query: { match_all: {} } }),
      });

      if (!esResponse.ok) {
        return res.json({ count: 0 });
      }

      const data = await esResponse.json();
      res.json({ count: data.count || 0 });
    } catch (error: any) {
      res.json({ count: 0 });
    }
  });

  app.delete("/api/merchants/:id/signed-contract", requireAuth, async (req, res) => {
    try {
      if (!(await checkMerchantRoleAccess(req, res, req.params.id))) return;
      const existing = await storage.getMerchantById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const merchant = await storage.updateMerchant(req.params.id, { signedContractUpload: null });
      res.json(merchant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/submission-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await storage.getSubmissionLogs(limit, offset);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/submission-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.clearSubmissionLogs();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/system-settings/:key", requireAuth, requireAdmin, async (req, res) => {
    try {
      const value = await storage.getSystemSetting(req.params.key);
      res.json({ key: req.params.key, value: value || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/system-settings/:key", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== "string") {
        return res.status(400).json({ error: "Value must be a string" });
      }
      await storage.setSystemSetting(req.params.key, value);
      res.json({ key: req.params.key, value });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/role-permissions", requireAuth, async (req, res) => {
    try {
      const raw = await storage.getSystemSetting("role_permissions");
      if (!raw) {
        const defaults = {
          moderation: [
            "overview.view", "merchants.view", "merchants.edit", "merchants.approve",
            "merchants.training",
            "deals.view", "deals.edit", "deals.approve",
            "feedbacks.view", "feedbacks.manage",
          ],
          sales: [
            "overview.view", "merchants.view", "merchants.training",
            "deals.view", "live_data.view", "feedbacks.view",
          ],
        };
        return res.json(defaults);
      }
      res.json(JSON.parse(raw));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/role-permissions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { moderation, sales } = req.body;
      if (!Array.isArray(moderation) || !Array.isArray(sales)) {
        return res.status(400).json({ error: "moderation and sales must be arrays" });
      }
      const value = JSON.stringify({ moderation, sales });
      await storage.setSystemSetting("role_permissions", value);
      res.json({ moderation, sales });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/activity-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 200;
      const offset = parseInt(req.query.offset as string) || 0;
      const logs = await storage.getActivityLogs(limit, offset);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/activity-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.clearActivityLogs();
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
