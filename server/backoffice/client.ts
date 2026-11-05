import { randomUUID } from "node:crypto";
import { prepareMerchantPayload, type MerchantSource } from "./mapMerchant";
import { prepareOfferPayload, type OfferSource } from "./mapOffer";
import type { BackofficeMappings, PreparedPayload } from "./contracts";
import { qaTokenProvider } from "./auth";
import { backofficeTarget, backofficeTargets, backofficeWritesEnabled, type BackofficeEnvironment } from "./environment";
import type { MerchantQaDetails } from "@shared/merchantQaDetails";
import type { OfferQaDetails } from "@shared/offerQaDetails";

export const QA_API_ORIGIN = "https://qlr-bo-qa.qatarliving.com";
export const UNCERTAIN_RESULT_PREFIX = "[QA_RESULT_UNCERTAIN]";

export class BackofficeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackofficeError";
  }
}

export interface BackofficeCreation {
  id: string;
  dryRun: boolean;
  warnings?: string[];
}

export interface BackofficeConfig {
  environment?: BackofficeEnvironment;
  dryRun: boolean;
  baseUrl?: string;
  apiToken?: string;
  getApiToken?: () => Promise<string>;
  invalidateApiToken?: (token: string) => void;
  authHeader?: string;
  authScheme?: string;
  platform?: string;
  qaWritesEnabled?: boolean;
  timeoutMs?: number;
  /** Legacy compatibility only. Staff actual-details arguments are authoritative. */
  mappings?: BackofficeMappings;
  mappingJson?: string;
}

function qaOrigin(baseUrl?: string, environment: BackofficeEnvironment = "qa") {
  try {
    const expected = backofficeTargets[environment].apiOrigin;
    const url = new URL(baseUrl || expected);
    if (url.origin !== expected || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
    return url.origin;
  } catch {
    throw new BackofficeError(`Only the confirmed ${backofficeTargets[environment].label} API origin is allowed.`);
  }
}

function safeLogShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeLogShape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safeLogShape(v)]));
  return value === null || value === undefined ? null : `<${typeof value}>`;
}

async function notFoundMessage(response: Response): Promise<string> {
  const fallback = "QA returned HTTP 404: the endpoint or a referenced resource was not found. Verify platform: 0 and the registered QA account/IDs before retrying.";
  // Classify only known error fields; never echo an upstream body or its values.
  // Limit reads so an unexpected response cannot retain unlimited private data.
  try {
    const reader = response.body?.getReader();
    if (!reader) return fallback;
    try {
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) return fallback;
        chunks.push(value);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const fields = [body?.message, body?.error, body?.code, body?.error?.message, body?.response?.message];
      const messages = fields.flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.replace(/[_-]+/g, " "));
      const missing = messages.filter((message) => /not\s+found|does\s+not\s+exist|cannot\s+find|no\s+.+\s+found/i.test(message));
      if (missing.some((message) => /\buser\b|\baccount\b/i.test(message))) {
        return "QA could not find the account identified by userEmail (HTTP 404). Select a registered QA user as the owner; a synthetic contact email is not an existing account.";
      }
      for (const resource of ["agency", "category", "location", "branch", "merchant"]) {
        if (missing.some((message) => new RegExp(`\\b${resource}\\b`, "i").test(message))) {
          return `QA could not find the referenced ${resource} (HTTP 404). Verify its QA ID before retrying.`;
        }
      }
      return fallback;
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch {
    return fallback;
  }
}

// Inject fetch/config for tests: never use captured credentials or replay a HAR.
export function createBackofficeClient(getConfig: () => BackofficeConfig, fetchImpl: typeof fetch = fetch) {
  const isDryRun = () => getConfig().dryRun;
  async function create(kind: "merchant" | "offer", prepared: PreparedPayload, config: BackofficeConfig): Promise<BackofficeCreation> {
    const { dryRun, baseUrl } = config;
    const origin = qaOrigin(baseUrl, config.environment);
    const path = kind === "merchant" ? "/admin/merchant-profiles" : "/admin/offers";
    if (dryRun) {
      // Preserve payload structure for debugging without leaking contacts, PINs,
      // file-upload signatures, IDs or credentials into development logs.
      if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
        console.info(`[Backoffice DRY RUN] POST ${origin}${path}`, JSON.stringify({
          payload: safeLogShape(prepared.payload), unresolvedFields: prepared.issues,
        }));
      }
      return { id: `dry-run-${kind}-${randomUUID()}`, dryRun: true,
        ...(prepared.issues.length ? { warnings: [`QA mapping is incomplete: ${prepared.issues.join(", ")}. No QA request was sent.`] } : {}) };
    }
    if (!config.qaWritesEnabled) {
      throw new BackofficeError("Real QA writes are disabled. Keep dry-run enabled until an approved QA test is ready.");
    }
    const prefix = backofficeTargets[config.environment ?? "qa"].prefix + "/";
    const refs = kind === "merchant"
      ? [prepared.payload.agencyLogoUri, prepared.payload.coverPhoto, prepared.payload.crUri, prepared.payload.taxCardUri].filter(Boolean)
      : (prepared.payload.images as { uri: string }[] | undefined)?.map((image) => image.uri) ?? [];
    if (refs.some((value) => typeof value !== "string"
      || (config.environment === "production" ? !value.startsWith(prefix) : value.startsWith("prod/")))) {
      throw new BackofficeError("File references belong to a different backoffice environment. Upload the original files to the selected environment.");
    }
    if (prepared.issues.length) throw new BackofficeError(`Complete the confirmed QA mapping before creation: ${prepared.issues.join(", ")}`);
    if ((!config.apiToken && !config.getApiToken) || !config.authHeader || !/^(authorization|x-api-key)$/i.test(config.authHeader)
      || (config.authHeader.toLowerCase() === "authorization" && !config.authScheme)) {
      throw new BackofficeError("Configure the approved QA authentication header, scheme and API token. Authentication was not present in the HAR.");
    }
    if ([config.apiToken, config.authScheme, config.platform].some((s) => s && /[\r\n]/.test(s))) {
      throw new BackofficeError("Invalid QA authentication/header configuration.");
    }
    const timeoutMs = config.timeoutMs ?? 15_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) throw new BackofficeError("QA timeout must be between 1 and 30000 milliseconds.");
    let apiToken: string | undefined;
    try {
      apiToken = config.getApiToken ? await config.getApiToken() : config.apiToken;
    } catch {
      throw new BackofficeError("QA sign-in failed. Check BACKOFFICE_USER and BACKOFFICE_PW in Secrets and QA account access. No creation request was sent.");
    }
    if (!apiToken || /[\r\n]/.test(apiToken)) throw new BackofficeError("Invalid QA authentication token. No creation request was sent.");
    const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
    headers[config.authHeader] = config.authScheme ? `${config.authScheme} ${apiToken}` : apiToken;
    headers.platform = config.platform ?? "0";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const uncertain = () => new BackofficeError(`${UNCERTAIN_RESULT_PREFIX} QA may have created this ${kind}. Do not retry until its existing QA ID is checked and reconciled.`);
    try {
      // No automatic retries or redirects: this POST creates a record. Upstream
      // idempotency support has NOT been confirmed and must not be assumed.
      const response = await fetchImpl(`${origin}${path}`, {
        method: "POST", headers, body: JSON.stringify(prepared.payload),
        redirect: "error", signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status >= 500 || response.status < 400) throw uncertain();
        if (response.status === 401 || response.status === 403) {
          if (response.status === 401) config.invalidateApiToken?.(apiToken);
          throw new BackofficeError(`QA authentication/permission rejected (HTTP ${response.status}). Check approved QA credentials.`);
        }
        if (response.status === 404) throw new BackofficeError(await notFoundMessage(response));
        throw new BackofficeError(`QA rejected the ${kind} request (HTTP ${response.status}). Check the mapped fields before retrying.`);
      }
      const result = await response.json().catch(() => { throw uncertain(); });
      const value = result?.[kind === "merchant" ? "merchantProfileId" : "offerId"];
      const numericId = typeof value === "number" ? value : typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
      if (!Number.isSafeInteger(numericId) || numericId <= 0) throw uncertain();
      return { id: String(numericId), dryRun: false };
    } catch (error) {
      // Never echo fetch errors, response bodies or request headers; they may
      // include secrets or customer data. An ambiguous result blocks retries.
      if (error instanceof BackofficeError) throw error;
      throw uncertain();
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    isBackofficeDryRun: isDryRun,
    async createMerchantInBackoffice(source: MerchantSource, details?: Partial<MerchantQaDetails>): Promise<BackofficeCreation> {
      const config = getConfig();
      return create("merchant", prepareMerchantPayload(source, details), config);
    },
    async createOfferInBackoffice(merchantBackofficeId: string, source: OfferSource, details?: OfferQaDetails): Promise<BackofficeCreation> {
      if (!merchantBackofficeId) throw new BackofficeError("Create the merchant first.");
      if (!isDryRun() && merchantBackofficeId.startsWith("dry-run-")) {
        throw new BackofficeError("This merchant has a simulated ID. A real QA merchant must be linked before live offers can be created.");
      }
      if (details && details.parentMerchantProfileId !== merchantBackofficeId) {
        throw new BackofficeError("QA offer mapping belongs to a different parent. Reload and review the offer details.");
      }
      const config = getConfig();
      // Like merchant details, actual per-offer staff data replaces legacy
      // environment fixtures. The source's parent always remains authoritative.
      const mapping = details ? {
        ...details, images: details.images.map((uri, index) => ({ uri, sortOrder: index + 1 })),
      } : undefined;
      return create("offer", prepareOfferPayload(source, merchantBackofficeId, mapping), config);
    },
  };
}

export const { createMerchantInBackoffice, createOfferInBackoffice, isBackofficeDryRun } = createBackofficeClient(() => ({
  environment: backofficeTarget.environment,
  // Fail closed: only an explicit "false" could enable future real calls.
  dryRun: process.env.BACKOFFICE_DRY_RUN?.trim().toLowerCase() !== "false",
  baseUrl: process.env.BACKOFFICE_BASE_URL,
  apiToken: backofficeTarget.environment === "production" ? process.env.BACKOFFICE_PROD_API_TOKEN : process.env.BACKOFFICE_API_TOKEN,
  getApiToken: qaTokenProvider.getToken,
  invalidateApiToken: qaTokenProvider.invalidate,
  authHeader: process.env.BACKOFFICE_AUTH_HEADER,
  authScheme: process.env.BACKOFFICE_AUTH_SCHEME,
  platform: process.env.BACKOFFICE_PLATFORM,
  qaWritesEnabled: backofficeWritesEnabled(),
  mappingJson: process.env.BACKOFFICE_MAPPING_JSON,
}));
