import { isQaOfferImageKey, qaOfferImageMaxBytes } from "@shared/offerQaDetails";
import { isCurrentStorageKey } from "./environment";
import { BackofficeHttpError } from "./errors";
import { fileFormat } from "./uploads";

const SOURCE_ORIGIN = "https://qlrstoragedev.blob.core.windows.net";
export type SourceImageContext = { id: string; merchantId: string | null; source: "deals" | "merchant_deals" };
export function isTrustedOfferSourceImage(value: string, context?: SourceImageContext) {
  if (typeof value !== "string" || value.length > 2048 || /[\\%]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.origin !== SOURCE_ORIGIN || url.username || url.password || url.search || url.hash
      || value.includes("..") || url.href !== value) return false;
    if (/^\/deals-clients\/(?:merchant-deal-images|deal-images)\/[a-zA-Z0-9/_-]+\/?[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return true;
    // uploadImageToAzure also writes directly under the standalone deal ID and
    // onboarding writes under merchant-<id>-deal. Accept only this record's
    // exact folder, not arbitrary UUID folders, logos, licenses or documents.
    if (!context || !/^[a-zA-Z0-9_-]{1,128}$/.test(context.id)) return false;
    const folders = [context.id];
    if (context.source === "merchant_deals" && context.merchantId && /^[a-zA-Z0-9_-]{1,128}$/.test(context.merchantId)) {
      folders.push(`merchant-${context.merchantId}-deal`);
    }
    return folders.some((folder) => url.pathname.startsWith(`/deals-clients/${folder}/`)
      && /^[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname.slice(`/deals-clients/${folder}/`.length)));
  } catch { return false; }
}
export function sourceImageList(images: string[], context?: SourceImageContext) {
  return images.filter((value) => (isQaOfferImageKey(value) && isCurrentStorageKey(value)) || isTrustedOfferSourceImage(value, context)).slice(0, 30);
}
export function createSourceImageReader(fetchImpl: typeof fetch = fetch) {
  return async (url: string, context?: SourceImageContext): Promise<{ bytes: Buffer; contentType: string }> => {
    if (!isTrustedOfferSourceImage(url, context)) throw new BackofficeHttpError(400, "A submitted image is not in the approved portal image storage. Choose a valid offer image.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetchImpl(url, { method: "GET", redirect: "error", signal: controller.signal, headers: { Accept: "image/png,image/jpeg,image/webp" } });
      if (!response.ok) { await response.body?.cancel(); throw new Error(); }
      const declared = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!declared || !["image/png", "image/jpeg", "image/webp"].includes(declared)) {
        await response.body?.cancel(); throw new Error();
      }
      if (Number(response.headers.get("content-length")) > qaOfferImageMaxBytes) { await response.body?.cancel(); throw new Error(); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > qaOfferImageMaxBytes) throw new Error();
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = Buffer.concat(chunks);
      const format = fileFormat(bytes);
      if (!format || format.mime === "application/pdf" || format.mime !== declared) throw new Error();
      return { bytes, contentType: declared };
    } catch {
      throw new BackofficeHttpError(502, "A submitted offer image could not be read safely. No deal was created. Retry or replace that image.");
    } finally { clearTimeout(timeout); }
  };
}
export const readSourceOfferImage = createSourceImageReader();
