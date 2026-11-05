import express, { type Express, type RequestHandler } from "express";
import { BackofficeHttpError, type BackofficeService } from "./service";
import { getMerchantQaOptions } from "./options";

export function registerBackofficeRoutes(app: Express, requireAuth: RequestHandler, service: BackofficeService) {
  const requireModerator: RequestHandler = (req, res, next) => {
    if (req.session.role !== "admin" && req.session.role !== "moderation") {
      res.status(403).json({ error: "Moderator or admin access required." });
      return;
    }
    next();
  };
  const privateDetails: RequestHandler = (_req, res, next) => {
    res.locals.omitResponseLog = true;
    res.setHeader("Cache-Control", "no-store");
    next();
  };
  const handle = (handler: RequestHandler): RequestHandler => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      if (error instanceof BackofficeHttpError) {
        res.status(error.status).json({ error: error.message });
      } else {
        // Never leak SQL values, credentials or upstream response bodies.
        res.status(500).json({ error: "Unable to save the backoffice action. Please contact an administrator." });
      }
    });
  };
  app.get("/api/merchant-requests/:id/backoffice", requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.getMerchantState(req.params.id));
  }));
  app.get("/api/backoffice/merchant-options", requireAuth, requireModerator, handle(async (_req, res) => {
    res.json(await getMerchantQaOptions());
  }));
  app.get("/api/merchant-requests/:id/qa-details", privateDetails, requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.getMerchantQaDetails(req.params.id));
  }));
  app.put("/api/merchant-requests/:id/qa-details", privateDetails, requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.saveMerchantQaDetails(req.params.id, req.body, req.session.username || req.session.userId || "Unknown"));
  }));
  app.post("/api/merchant-requests/:id/qa-files/:kind", privateDetails, requireAuth, requireModerator,
    (req, res, next) => {
      express.raw({ type: () => true, limit: "10mb" })(req, res, (error) => {
        if (error) { res.status(413).json({ error: "File is too large. Images allow 5 MB; CR files allow 10 MB." }); return; }
        next();
      });
    },
    handle(async (req, res) => {
      res.json(await service.uploadMerchantQaFile(req.params.id, req.params.kind, req.body,
        req.header("content-type"), req.session.username || req.session.userId || "Unknown"));
    }));
  app.get("/api/deal-requests/:id/backoffice", requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.getOfferState(req.params.id));
  }));
  app.get("/api/deal-requests/:id/qa-details", privateDetails, requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.getOfferQaDetails(req.params.id));
  }));
  app.put("/api/deal-requests/:id/qa-details", privateDetails, requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.saveOfferQaDetails(req.params.id, req.body, req.session.username || req.session.userId || "Unknown"));
  }));
  app.post("/api/deal-requests/:id/qa-prepare", privateDetails, requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.prepareOfferQaDetails(req.params.id, req.body, req.session.username || req.session.userId || "Unknown"));
  }));
  app.get("/api/deal-requests/:id/qa-options", privateDetails, requireAuth, requireModerator, handle(async (req, res) => {
    res.json(await service.getOfferQaOptions(req.params.id, req.query.refresh === "1"));
  }));
  app.post("/api/deal-requests/:id/qa-images", privateDetails, requireAuth, requireModerator, (req, res, next) => {
    express.raw({ type: () => true, limit: "5mb" })(req, res, (error) => {
      if (error) { res.status(413).json({ error: "Offer images must be 5 MB or smaller." }); return; }
      next();
    });
  }, handle(async (req, res) => {
    res.json(await service.uploadOfferQaImage(req.params.id, req.body, req.header("content-type"), req.session.username || req.session.userId || "Unknown"));
  }));
  app.post("/api/merchant-requests/:id/create-merchant", requireAuth, requireModerator, handle(async (req, res) => {
    const result = await service.createMerchant(req.params.id, req.session.username || req.session.userId || "Unknown");
    res.status(result.statusCode).json(result.body);
  }));
  app.post("/api/deal-requests/:id/create-offer", requireAuth, requireModerator, handle(async (req, res) => {
    const result = await service.createOffer(req.params.id, req.session.username || req.session.userId || "Unknown");
    res.status(result.statusCode).json(result.body);
  }));
}
