import { backofficeTarget } from "./environment";
import type { Merchant } from "@shared/schema";
import type { BackofficeState } from "@shared/backoffice";
import * as client from "./client";
import { mapMerchant, prepareMerchantPayload } from "./mapMerchant";
import { mapOffer } from "./mapOffer";
import type { BackofficeRepository, BackofficeUnit, OfferRequest } from "./types";
import { merchantQaDetailsSchema, type MerchantQaDetailsResponse, type MerchantQaOptions } from "@shared/merchantQaDetails";
import { getMerchantQaOptions } from "./options";
import { BackofficeHttpError } from "./errors";
import { uploadQaFile } from "./uploads";
import { merchantQaFileIssues, prepareMerchantQaFiles } from "./merchantSourceFiles";
import { OfferQaWorkflow, type OfferQaTools } from "./offerDetails";
import { syncPublishedOfferImages } from "./offerUploads";
export { BackofficeHttpError } from "./errors";

interface Adapter {
  createMerchantInBackoffice: typeof client.createMerchantInBackoffice;
  createOfferInBackoffice: typeof client.createOfferInBackoffice;
  isBackofficeDryRun: typeof client.isBackofficeDryRun;
}
type ActionResult = { statusCode: number; body: BackofficeState & { id?: string; error?: string } };
const iso = (date: Date | null) => date?.toISOString() ?? null;
const merchantQaSetupEditable = (merchant: Merchant) =>
  (merchant.status === "pending" || merchant.status === "moderation")
  && !merchant.backofficeMerchantId
  && !merchant.lastBackofficeError?.startsWith(client.UNCERTAIN_RESULT_PREFIX);

export class BackofficeService {
  private offerQa: OfferQaWorkflow;
  constructor(
    private repository: BackofficeRepository,
    private adapter: Adapter = client,
    private loadQaOptions: () => Promise<MerchantQaOptions> = getMerchantQaOptions,
    private uploadFile: typeof uploadQaFile = uploadQaFile,
    offerTools?: OfferQaTools,
    private syncOfferImages: typeof syncPublishedOfferImages = syncPublishedOfferImages,
    private prepareMerchantFiles: typeof prepareMerchantQaFiles = prepareMerchantQaFiles,
  ) { this.offerQa = new OfferQaWorkflow(repository, offerTools); }

  getOfferQaDetails(id: string) { return this.offerQa.get(id); }
  saveOfferQaDetails(id: string, input: unknown, username: string) { return this.offerQa.save(id, input, username); }
  prepareOfferQaDetails(id: string, input: unknown, username: string) { return this.offerQa.prepare(id, input, username); }
  getOfferQaOptions(id: string, refresh = false) { return this.offerQa.options(id, refresh); }
  uploadOfferQaImage(id: string, bytes: Buffer, contentType: string | undefined, username: string) {
    return this.offerQa.upload(id, bytes, contentType, username);
  }

  private state(merchant: Merchant | undefined, offer?: OfferRequest): BackofficeState {
    const record = offer ?? merchant;
    if (!record) throw new BackofficeHttpError(404, "Request not found.");
    const existingId = offer?.backofficeOfferId ?? (!offer ? merchant?.backofficeMerchantId : null);
    const blockedReason = existingId ? "Already created in the backoffice."
      : record.lastBackofficeError?.startsWith(client.UNCERTAIN_RESULT_PREFIX) ? "Check and reconcile the existing QA record before retrying."
      : offer && !merchant?.backofficeMerchantId ? "Create the merchant first"
      : !offer && merchant?.status !== "moderation" ? "Merchant must be In Moderation." : null;
    return {
      environment: backofficeTarget.environment,
      status: record.status,
      backofficeMerchantId: merchant?.backofficeMerchantId ?? null,
      ...(offer ? { backofficeOfferId: offer.backofficeOfferId } : {}),
      backofficeCreatedAt: iso(record.backofficeCreatedAt),
      lastBackofficeError: record.lastBackofficeError,
      lastBackofficeAttemptAt: iso(record.lastBackofficeAttemptAt),
      dryRun: existingId ? existingId.startsWith("dry-run-") : this.adapter.isBackofficeDryRun(),
      canCreate: !blockedReason,
      blockedReason,
    };
  }

  async getMerchantState(id: string): Promise<BackofficeState> {
    return this.repository.transaction(async (unit) => {
      const merchant = await unit.getMerchant(id);
      if (!merchant) throw new BackofficeHttpError(404, "Merchant not found.");
      return this.merchantState(unit, merchant);
    });
  }

  private async merchantState(unit: BackofficeUnit, merchant: Merchant): Promise<BackofficeState> {
    const details = await unit.getMerchantQaDetails(merchant.id);
    const source = mapMerchant(merchant, await unit.getBrands(merchant.id));
    const mappingIssues = prepareMerchantPayload(source, details ?? {}).issues;
    if (details && !this.adapter.isBackofficeDryRun() && !merchant.backofficeMerchantId) {
      mappingIssues.push(...merchantQaFileIssues(source, details));
    }
    const state = this.state(merchant);
    return {
      ...state, mappingIssues,
      canCreate: state.canCreate && mappingIssues.length === 0,
      blockedReason: state.blockedReason ?? (mappingIssues.length ? "Complete this merchant’s actual QA details before creation." : null),
    };
  }

  async getMerchantQaDetails(id: string): Promise<MerchantQaDetailsResponse> {
    return this.repository.transaction(async (unit) => {
      const merchant = await unit.getMerchant(id);
      if (!merchant) throw new BackofficeHttpError(404, "Merchant not found.");
      return this.detailsResponse(unit, merchant);
    });
  }

  private async detailsResponse(unit: BackofficeUnit, merchant: Merchant): Promise<MerchantQaDetailsResponse> {
    const details = await unit.getMerchantQaDetails(merchant.id);
    const state = await this.merchantState(unit, merchant);
    return {
      details, merchantName: merchant.companyName,
      sourceBranches: (merchant.branches ?? []).map((raw) => {
        let branch: Record<string, unknown>;
        try { const parsed = JSON.parse(raw); branch = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { name: raw }; }
        catch { branch = { name: raw }; }
        const text = (value: unknown) => typeof value === "string" ? value : "";
        return { name: text(branch.name), locationUri: text(branch.location), contactMobile: text(branch.phone) };
      }),
      editable: merchantQaSetupEditable(merchant),
      issues: state.mappingIssues ?? [],
      prefill: {
        agencyName: merchant.brandName || "",
        agencyEmail: merchant.email || "",
        contactMobile: merchant.phone || "",
        contactWhatsapp: merchant.whatsapp || "",
        agencyLogoUri: merchant.logo || "",
        coverPhoto: merchant.coverImage || "",
        crNumber: merchant.crNumber || "",
        crUri: merchant.crDocument || "",
        isPriceList: !!merchant.menuPriceList,
      },
      ...(merchant.companyType === "group" ? {
        profileNames: Array.from(new Set([merchant.brandName, ...(await unit.getBrands(merchant.id)).map((brand) => brand.brandName)].filter((name): name is string => !!name))),
      } : {}),
    };
  }

  async saveMerchantQaDetails(id: string, input: unknown, username: string): Promise<MerchantQaDetailsResponse> {
    const parsed = merchantQaDetailsSchema.safeParse(input);
    if (!parsed.success) {
      const fields = Array.from(new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "details")));
      throw new BackofficeHttpError(400, `Complete valid QA details: ${fields.join(", ")}`);
    }
    return this.repository.transaction(async (unit) => {
      const merchant = await unit.getMerchant(id, true);
      if (!merchant) throw new BackofficeHttpError(404, "Merchant not found.");
      if (merchant.backofficeMerchantId || merchant.lastBackofficeError?.startsWith(client.UNCERTAIN_RESULT_PREFIX)) {
        throw new BackofficeHttpError(409, "QA details are locked. Reconcile any existing QA record before making changes.");
      }
      if (!merchantQaSetupEditable(merchant)) throw new BackofficeHttpError(409, "QA details can be prepared only while the merchant is Pending or In Moderation.");
      const options = await this.loadQaOptions();
      if (!options.categories.some((category) => category.id === parsed.data.categoryId)) {
        throw new BackofficeHttpError(400, "Select a current QA category.");
      }
      if (parsed.data.branches.some((branch) => !options.locations.some((location) => location.id === branch.locationId))) {
        throw new BackofficeHttpError(400, "Select a current QA location for every branch.");
      }
      if (merchant.companyType === "group") {
        const names = [merchant.brandName, ...(await unit.getBrands(id)).map((brand) => brand.brandName)];
        if (!parsed.data.agencyName || !names.includes(parsed.data.agencyName)) {
          throw new BackofficeHttpError(400, "Select one of this group’s submitted brand names as the QA profile.");
        }
      }
      await unit.saveMerchantQaDetails(id, parsed.data);
      // Never audit owner email, contact values, hours or redemption PINs.
      await unit.audit(username, "backoffice_update_merchant_details", merchant, JSON.stringify({ requestId: id, fields: Object.keys(parsed.data) }));
      return this.detailsResponse(unit, merchant);
    });
  }

  async uploadMerchantQaFile(id: string, kind: string, bytes: Buffer, contentType: string | undefined, username: string) {
    return this.repository.transaction(async (unit) => {
      const merchant = await unit.getMerchant(id, true);
      if (!merchant) throw new BackofficeHttpError(404, "Merchant not found.");
      if (!merchantQaSetupEditable(merchant)) {
        throw new BackofficeHttpError(409, "QA uploads are locked for this merchant. Check its status and any existing QA record.");
      }
      const result = await this.uploadFile(kind, bytes, contentType);
      await unit.audit(username, "backoffice_upload_merchant_file", merchant, JSON.stringify({
        requestId: id, kind: result.kind, bytes: bytes.length,
      }));
      return result;
    });
  }

  async getOfferState(id: string): Promise<BackofficeState> {
    return this.repository.transaction(async (unit) => {
      const offer = await unit.getOffer(id);
      if (!offer) throw new BackofficeHttpError(404, "Deal not found.");
      const merchant = offer.merchantId ? await unit.getMerchant(offer.merchantId) : undefined;
      // Some legacy standalone merchantId values identify external merchants,
      // not portal requests. Do not guess a link by name: show the disabled
      // prerequisite instead. A genuinely soft-deleted parent stays hard-hidden.
      if (offer.merchantId && !merchant && await unit.isMerchantDeleted(offer.merchantId)) {
        throw new BackofficeHttpError(404, "Merchant not found.");
      }
      return this.offerQa.state(unit, offer, merchant, this.state(merchant, offer));
    });
  }

  private async recoverFailedSave(kind: "merchant" | "offer", id: string, remoteId: string): Promise<ActionResult> {
    const error = `${client.UNCERTAIN_RESULT_PREFIX} QA returned ${kind === "merchant" ? "merchantProfileId" : "offerId"} ${remoteId}, but the portal save could not be confirmed. Reconcile that existing QA record before retrying.`;
    try {
      return await this.repository.transaction(async (unit) => {
        const offer = kind === "offer" ? await unit.getOffer(id, true) : undefined;
        const merchant = await unit.getMerchant(kind === "merchant" ? id : offer?.merchantId ?? "", true);
        if (!merchant || (kind === "offer" && !offer)) throw new Error("Request not available");
        const linkedId = offer ? offer.backofficeOfferId : merchant.backofficeMerchantId;
        // A commit acknowledgement can fail after the transaction committed.
        if (linkedId === remoteId) return { statusCode: 200, body: { ...this.state(merchant, offer), id: remoteId } };
        if (!linkedId) {
          const patch = { lastBackofficeError: error, lastBackofficeAttemptAt: new Date() };
          if (offer) {
            const updated = await unit.saveOffer(offer, patch);
            return { statusCode: 502, body: { ...this.state(merchant, updated), error } };
          }
          const updated = await unit.saveMerchant(id, patch);
          return { statusCode: 502, body: { ...this.state(updated), error } };
        }
        return { statusCode: 502, body: { ...this.state(merchant, offer), error } };
      });
    } catch {
      // If the DB is also unavailable for this recovery write, the operator
      // must reconcile the reported primary ID before trying any create again.
      throw new BackofficeHttpError(502, error);
    }
  }

  async createMerchant(id: string, username: string): Promise<ActionResult> {
    let confirmedRemoteId: string | undefined;
    return this.repository.transaction(async (unit) => {
      // PostgreSQL row lock serializes concurrent clicks across processes.
      const merchant = await unit.getMerchant(id, true);
      if (!merchant) throw new BackofficeHttpError(404, "Merchant not found.");
      if (merchant.backofficeMerchantId) {
        return { statusCode: 200, body: { ...this.state(merchant), id: merchant.backofficeMerchantId } };
      }
      if (merchant.lastBackofficeError?.startsWith(client.UNCERTAIN_RESULT_PREFIX)) {
        throw new BackofficeHttpError(409, "Check and reconcile the existing QA record before retrying.");
      }
      if (merchant.status !== "moderation") throw new BackofficeHttpError(409, "Merchant must be In Moderation.");
      const details = await unit.getMerchantQaDetails(id);
      const source = mapMerchant(merchant, await unit.getBrands(id));
      const issues = prepareMerchantPayload(source, details ?? {}).issues;
      if (details && !this.adapter.isBackofficeDryRun()) {
        issues.push(...merchantQaFileIssues(source, details));
      }
      if (!details || issues.length) {
        throw new BackofficeHttpError(409, `Complete this merchant’s actual QA details before creation: ${issues.join(", ")}`);
      }
      const attemptedAt = new Date();
      let preparedDetails = details;
      if (!this.adapter.isBackofficeDryRun()) {
        try {
          preparedDetails = await this.prepareMerchantFiles(source, details, this.uploadFile,
            (prepared) => unit.saveMerchantQaDetails(id, prepared));
        } catch {
          const error = "Merchant files could not all be prepared in QA. Completed uploads were retained; retry the existing request. No merchant was created.";
          const failed = await unit.saveMerchant(id, { lastBackofficeError: error, lastBackofficeAttemptAt: attemptedAt });
          return { statusCode: 502, body: { ...await this.merchantState(unit, failed), error } };
        }
      }
      let creation: client.BackofficeCreation;
      try {
        creation = await this.adapter.createMerchantInBackoffice(source, preparedDetails);
      } catch (error) {
        if (!(error instanceof client.BackofficeError)) throw error;
        const message = error.message.slice(0, 2000);
        const failed = await unit.saveMerchant(id, { lastBackofficeError: message, lastBackofficeAttemptAt: attemptedAt });
        return { statusCode: 502, body: { ...this.state(failed), error: message } };
      }
      if (!creation.dryRun) confirmedRemoteId = creation.id;
      const createdAt = new Date();
      const updated = await unit.saveMerchant(id, {
        backofficeMerchantId: creation.id, backofficeCreatedAt: createdAt,
        lastBackofficeAttemptAt: attemptedAt, lastBackofficeError: null,
      });
      await unit.audit(username, "backoffice_create_merchant", updated, JSON.stringify({
        requestId: id, backofficeId: creation.id, dryRun: creation.dryRun, createdAt: createdAt.toISOString(),
      }));
      return { statusCode: 200, body: { ...this.state(updated), id: creation.id, warnings: creation.warnings } };
    }).catch((error) => confirmedRemoteId
      ? this.recoverFailedSave("merchant", id, confirmedRemoteId)
      : Promise.reject(error));
  }

  async createOffer(id: string, username: string): Promise<ActionResult> {
    let confirmedRemoteId: string | undefined;
    return this.repository.transaction(async (unit) => {
      const offer = await unit.getOffer(id, true);
      if (!offer) throw new BackofficeHttpError(404, "Deal not found.");
      const merchant = offer.merchantId ? await unit.getMerchant(offer.merchantId, true) : undefined;
      if (offer.merchantId && !merchant && await unit.isMerchantDeleted(offer.merchantId)) {
        throw new BackofficeHttpError(404, "Merchant not found.");
      }
      if (offer.backofficeOfferId) {
        return { statusCode: 200, body: { ...this.state(merchant, offer), id: offer.backofficeOfferId } };
      }
      if (offer.lastBackofficeError?.startsWith(client.UNCERTAIN_RESULT_PREFIX)) {
        throw new BackofficeHttpError(409, "Check and reconcile the existing QA record before retrying.");
      }
      if (!merchant?.backofficeMerchantId) throw new BackofficeHttpError(409, "Create the merchant first");
      const details = await this.offerQa.requireReady(unit, offer, merchant);
      const attemptedAt = new Date();
      let creation: client.BackofficeCreation;
      try {
        creation = await this.adapter.createOfferInBackoffice(merchant.backofficeMerchantId, mapOffer(offer), details);
      } catch (error) {
        if (!(error instanceof client.BackofficeError)) throw error;
        const message = error.message.slice(0, 2000);
        const failed = await unit.saveOffer(offer, { lastBackofficeError: message, lastBackofficeAttemptAt: attemptedAt });
        return { statusCode: 502, body: { ...this.state(merchant, failed), error: message } };
      }
      if (!creation.dryRun) confirmedRemoteId = creation.id;
      let imageError: string | null = null;
      if (!creation.dryRun) {
        try {
          await this.syncOfferImages(creation.id, details.images);
        } catch {
          imageError = `QA deal ${creation.id} was created, but some images could not be verified. Do not create it again; repair the existing QA deal.`;
        }
      }
      const createdAt = new Date();
      const updated = await unit.saveOffer(offer, {
        backofficeOfferId: creation.id, backofficeCreatedAt: createdAt,
        lastBackofficeAttemptAt: attemptedAt, lastBackofficeError: imageError, status: "licensing",
      });
      await unit.audit(username, "backoffice_create_offer", merchant, JSON.stringify({
        requestId: id, requestSource: offer.source, backofficeId: creation.id,
        merchantBackofficeId: merchant.backofficeMerchantId, dryRun: creation.dryRun, createdAt: createdAt.toISOString(),
      }));
      return { statusCode: imageError ? 502 : 200, body: { ...this.state(merchant, updated), id: creation.id,
        ...(imageError ? { error: imageError } : { warnings: creation.warnings }) } };
    }).catch((error) => confirmedRemoteId
      ? this.recoverFailedSave("offer", id, confirmedRemoteId)
      : Promise.reject(error));
  }
}
