import type { Deal, Merchant, MerchantBrand, MerchantDeal } from "@shared/schema";
import type { MerchantQaDetails } from "@shared/merchantQaDetails";
import type { OfferQaDetails } from "@shared/offerQaDetails";

export type OfferRequest = (Deal | MerchantDeal) & { source: "deals" | "merchant_deals" };
type AttemptFields = {
  lastBackofficeError: string | null;
  lastBackofficeAttemptAt: Date;
};
export interface BackofficeUnit {
  getMerchant(id: string, lock?: boolean): Promise<Merchant | undefined>;
  isMerchantDeleted(id: string): Promise<boolean>;
  getOffer(id: string, lock?: boolean): Promise<OfferRequest | undefined>;
  getBrands(merchantId: string): Promise<MerchantBrand[]>;
  getMerchantQaDetails(id: string): Promise<MerchantQaDetails | null>;
  saveMerchantQaDetails(id: string, details: MerchantQaDetails): Promise<void>;
  getOfferQaDetails(offer: OfferRequest): Promise<OfferQaDetails | null>;
  saveOfferQaDetails(offer: OfferRequest, details: OfferQaDetails): Promise<void>;
  getOfferQaTransfers?(offer: OfferRequest): Promise<Record<string, string>>;
  saveOfferQaTransfers?(offer: OfferRequest, references: Record<string, string>): Promise<void>;
  saveMerchant(id: string, patch: AttemptFields & {
    backofficeMerchantId?: string;
    backofficeCreatedAt?: Date;
    status?: string;
  }): Promise<Merchant>;
  saveOffer(offer: OfferRequest, patch: AttemptFields & {
    backofficeOfferId?: string;
    backofficeCreatedAt?: Date;
    status?: string;
  }): Promise<OfferRequest>;
  audit(username: string, action: string, merchant: Merchant, details: string): Promise<void>;
}
export interface BackofficeRepository {
  transaction<T>(work: (unit: BackofficeUnit) => Promise<T>): Promise<T>;
}
