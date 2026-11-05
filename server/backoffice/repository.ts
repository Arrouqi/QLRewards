import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { activityLogs, deals, merchantBrands, merchantDeals, merchants, systemSettings } from "@shared/schema";
import { merchantQaDetailsSchema, merchantQaSettingKey } from "@shared/merchantQaDetails";
import { isQaOfferImageKey, offerQaDetailsSchema, offerQaSettingKey } from "@shared/offerQaDetails";
import type { BackofficeRepository, BackofficeUnit } from "./types";
import { backofficeTarget, scopedSettingKey } from "./environment";
import { BackofficeHttpError } from "./errors";

export const backofficeRepository: BackofficeRepository = {
  transaction: (work) => db.transaction(async (tx) => {
    async function requireProductionLink(kind: string, id: string, remoteId: string | null) {
      if (backofficeTarget.environment !== "production" || !remoteId) return;
      const [row] = await tx.select({ value: systemSettings.value }).from(systemSettings)
        .where(eq(systemSettings.key, `backoffice_link_environment:${kind}:${id}`));
      if (row?.value !== "production" || remoteId.startsWith("dry-run-")) {
        throw new BackofficeHttpError(409, "Existing backoffice link is not verified as production. Reconcile it before using production actions; do not create a duplicate.");
      }
    }
    async function markProductionLink(kind: string, id: string, remoteId?: string) {
      if (!remoteId || backofficeTarget.environment !== "production") return;
      const key = `backoffice_link_environment:${kind}:${id}`;
      await tx.insert(systemSettings).values({ key, value: "production" })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: "production", updatedAt: new Date() } });
    }
    const unit: BackofficeUnit = {
      async getMerchant(id, lock = false) {
        const query = tx.select().from(merchants).where(and(eq(merchants.id, id), isNull(merchants.deletedAt)));
        const [row] = await (lock ? query.for("update") : query);
        if (row) await requireProductionLink("merchant", row.id, row.backofficeMerchantId);
        return row;
      },
      async isMerchantDeleted(id) {
        const rows = await tx.select({ id: merchants.id }).from(merchants)
          .where(and(eq(merchants.id, id), isNotNull(merchants.deletedAt)));
        return rows.length > 0;
      },
      async getOffer(id, lock = false) {
        const standaloneQuery = tx.select().from(deals).where(eq(deals.id, id));
        const [standalone] = await (lock ? standaloneQuery.for("update") : standaloneQuery);
        if (standalone) {
          await requireProductionLink("deals", standalone.id, standalone.backofficeOfferId);
          return { ...standalone, source: "deals" };
        }
        const nestedQuery = tx.select().from(merchantDeals).where(eq(merchantDeals.id, id));
        const [nested] = await (lock ? nestedQuery.for("update") : nestedQuery);
        if (nested) await requireProductionLink("merchant_deals", nested.id, nested.backofficeOfferId);
        return nested ? { ...nested, source: "merchant_deals" } : undefined;
      },
      getBrands: (merchantId) => tx.select().from(merchantBrands).where(eq(merchantBrands.merchantId, merchantId)),
      async getMerchantQaDetails(id) {
        const [row] = await tx.select({ value: systemSettings.value }).from(systemSettings)
          .where(eq(systemSettings.key, scopedSettingKey(merchantQaSettingKey(id))));
        if (!row) return null;
        try {
          const parsed = merchantQaDetailsSchema.safeParse(JSON.parse(row.value));
          return parsed.success ? parsed.data : null;
        } catch { return null; }
      },
      async saveMerchantQaDetails(id, details) {
        const key = scopedSettingKey(merchantQaSettingKey(id));
        await tx.insert(systemSettings).values({ key, value: JSON.stringify(details) })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(details), updatedAt: new Date() } });
      },
      async getOfferQaDetails(offer) {
        const [row] = await tx.select({ value: systemSettings.value }).from(systemSettings)
          .where(eq(systemSettings.key, scopedSettingKey(offerQaSettingKey(offer.source, offer.id))));
        if (!row) return null;
        try {
          const parsed = offerQaDetailsSchema.safeParse(JSON.parse(row.value));
          return parsed.success ? parsed.data : null;
        } catch { return null; }
      },
      async saveOfferQaDetails(offer, details) {
        const key = scopedSettingKey(offerQaSettingKey(offer.source, offer.id));
        await tx.insert(systemSettings).values({ key, value: JSON.stringify(details) })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(details), updatedAt: new Date() } });
      },
      async getOfferQaTransfers(offer) {
        const key = scopedSettingKey(`qa_offer_transfers:${offer.source}:${offer.id}`);
        const [row] = await tx.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key));
        try {
          const parsed = JSON.parse(row?.value ?? "{}");
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
          return Object.fromEntries(Object.entries(parsed).slice(-100).filter(([hash, ref]) =>
            /^[a-f0-9]{64}$/.test(hash) && typeof ref === "string" && isQaOfferImageKey(ref))) as Record<string, string>;
        } catch { return {}; }
      },
      async saveOfferQaTransfers(offer, references) {
        const key = scopedSettingKey(`qa_offer_transfers:${offer.source}:${offer.id}`);
        const value = JSON.stringify(Object.fromEntries(Object.entries(references).slice(-100)));
        await tx.insert(systemSettings).values({ key, value })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
      },
      async saveMerchant(id, patch) {
        await markProductionLink("merchant", id, patch.backofficeMerchantId);
        const [updated] = await tx.update(merchants).set(patch).where(eq(merchants.id, id)).returning();
        if (!updated) throw new Error("Merchant disappeared during creation.");
        return updated;
      },
      async saveOffer(offer, patch) {
        await markProductionLink(offer.source, offer.id, patch.backofficeOfferId);
        if (offer.source === "deals") {
          const [updated] = await tx.update(deals).set(patch).where(eq(deals.id, offer.id)).returning();
          if (!updated) throw new Error("Deal disappeared during creation.");
          return { ...updated, source: "deals" };
        }
        const [updated] = await tx.update(merchantDeals).set(patch).where(eq(merchantDeals.id, offer.id)).returning();
        if (!updated) throw new Error("Deal disappeared during creation.");
        return { ...updated, source: "merchant_deals" };
      },
      async audit(username, action, merchant, details) {
        await tx.insert(activityLogs).values({
          username, action, merchantId: merchant.id, merchantName: merchant.companyName, details,
        });
      },
    };
    return work(unit);
  }),
};
