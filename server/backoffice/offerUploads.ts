import { randomUUID } from "node:crypto";
import { isQaOfferImageKey, qaOfferImageMaxBytes, type OfferQaImageUploadResult } from "@shared/offerQaDetails";
import { qaTokenProvider } from "./auth";
import { BackofficeHttpError } from "./errors";
import { fileFormat, signingBody } from "./uploads";
import { backofficeTarget, backofficeWritesEnabled, isCurrentStorageKey } from "./environment";

export function createOfferImageUploader(
  tokenProvider = qaTokenProvider,
  fetchImpl: typeof fetch = fetch,
  settings = {
    writesEnabled: backofficeWritesEnabled,
    folderId: randomUUID as () => string,
    fileId: () => `${Date.now()}-${randomUUID()}`,
  },
) {
  return async (bytes: Buffer, declaredType?: string, offerFolder?: string): Promise<OfferQaImageUploadResult> => {
    if (!Buffer.isBuffer(bytes) || !bytes.length) throw new BackofficeHttpError(400, "Choose a non-empty offer image.");
    if (bytes.length > qaOfferImageMaxBytes) throw new BackofficeHttpError(413, "Offer images must be 5 MB or smaller.");
    const format = fileFormat(bytes);
    if (!format || format.mime === "application/pdf") throw new BackofficeHttpError(400, "Choose a PNG, JPEG or WebP offer image.");
    const mime = declaredType?.split(";")[0].trim().toLowerCase();
    if (mime && mime !== "application/octet-stream" && mime !== format.mime) throw new BackofficeHttpError(400, "The image content does not match its declared type.");
    if (!settings.writesEnabled()) throw new BackofficeHttpError(409, "QA uploads require QA writes enabled and dry-run disabled.");
    // QA's browser uploader keeps all images of an offer in one folder.
    // The source deal ID is a stable UUID and never an arbitrary caller path.
    if (offerFolder !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerFolder)) {
      throw new BackofficeHttpError(400, "Unable to identify the offer image folder.");
    }
    const path = `${offerFolder ?? settings.folderId()}/${settings.fileId()}.${format.ext}`;
    const reference = `${backofficeTarget.prefix}/${path}`;
    if (!isQaOfferImageKey(reference)) throw new BackofficeHttpError(500, "Unable to prepare the QA image path.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const token = await tokenProvider.getToken();
      if (!token || /[\r\n]/.test(token)) throw new Error();
      const signer = new URL(`${backofficeTarget.apiOrigin}/images/generateSignedURL`);
      signer.searchParams.set("path", path);
      const signed = await fetchImpl(signer, {
        method: "GET", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, platform: "0" },
      });
      if (!signed.ok) {
        if (signed.status === 401) tokenProvider.invalidate(token);
        await signed.body?.cancel();
        throw new Error();
      }
      const entries = await signingBody(signed);
      if (!Array.isArray(entries) || entries.length !== 1 || entries[0]?.path !== path || typeof entries[0]?.signedUrl !== "string") throw new Error();
      const target = new URL(entries[0].signedUrl);
      if (target.origin !== backofficeTarget.offerStorage
        || target.username || target.password || target.hash || !target.searchParams.get("sig")
        || target.pathname !== `/ad-images/${reference}`) throw new Error();
      const put = await fetchImpl(target, {
        method: "PUT", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": format.mime, "x-ms-blob-type": "BlockBlob" },
        body: new Uint8Array(bytes),
      });
      await put.body?.cancel();
      if (!put.ok) throw new Error();
      return { reference };
    } catch {
      throw new BackofficeHttpError(502, "QA offer-image upload could not be confirmed. No image was added. Select the file to retry.");
    } finally { clearTimeout(timeout); }
  };
}
export const uploadOfferImage = createOfferImageUploader();

// QA rewrites offer image URIs to qa/<new numeric offer ID>/<filename> when it
// creates the offer. Only the cover image is copied by QA; copy any remaining
// already-uploaded blobs to those exact final paths without overwriting files.
export function createPublishedOfferImageSync(
  tokenProvider = qaTokenProvider,
  fetchImpl: typeof fetch = fetch,
) {
  return async (offerId: string, references: string[]): Promise<void> => {
    if (!/^[1-9]\d*$/.test(offerId) || !Number.isSafeInteger(Number(offerId))
      || !references.length || references.length > 30 || references.some((ref) => !isQaOfferImageKey(ref) || !isCurrentStorageKey(ref))) {
      throw new BackofficeHttpError(400, "Cannot verify the created QA offer images.");
    }
    const filenames = references.map((ref) => ref.split("/")[2]);
    if (new Set(filenames).size !== filenames.length) throw new BackofficeHttpError(400, "Offer images need distinct filenames.");
    const origin = `${backofficeTarget.offerStorage}/ad-images/`;
    try {
      for (let index = 0; index < filenames.length; index++) {
        const filename = filenames[index];
        const finalKey = `${backofficeTarget.prefix}/${offerId}/${filename}`;
        const finalUrl = `${origin}${finalKey}`;
        const head = await fetchImpl(finalUrl, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(15000) });
        await head.body?.cancel();
        if (head.status === 200) continue;
        if (head.status !== 404) throw new Error();
        const original = await fetchImpl(`${origin}${references[index]}`, {
          method: "GET", redirect: "error", signal: AbortSignal.timeout(20000),
        });
        if (!original.ok || !original.body || Number(original.headers.get("content-length")) > qaOfferImageMaxBytes) {
          await original.body?.cancel(); throw new Error();
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = original.body.getReader();
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
        if (!format || format.mime === "application/pdf"
          || original.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== format.mime
          || !filename.toLowerCase().endsWith(`.${format.ext}`)) throw new Error();
        const token = await tokenProvider.getToken();
        if (!token || /[\r\n]/.test(token)) throw new Error();
        const signer = new URL(`${backofficeTarget.apiOrigin}/images/generateSignedURL`);
        signer.searchParams.set("path", `${offerId}/${filename}`);
        const signed = await fetchImpl(signer, {
          method: "GET", redirect: "error", signal: AbortSignal.timeout(15000),
          headers: { Accept: "application/json", Authorization: `Bearer ${token}`, platform: "0" },
        });
        if (!signed.ok) {
          if (signed.status === 401) tokenProvider.invalidate(token);
          await signed.body?.cancel(); throw new Error();
        }
        const entries = await signingBody(signed);
        if (!Array.isArray(entries) || entries.length !== 1
          || entries[0]?.path !== `${offerId}/${filename}` || typeof entries[0]?.signedUrl !== "string") throw new Error();
        const target = new URL(entries[0].signedUrl);
        if (target.origin !== backofficeTarget.offerStorage
          || target.pathname !== `/ad-images/${finalKey}` || target.username || target.password || target.hash
          || !target.searchParams.get("sig")) throw new Error();
        const put = await fetchImpl(target, {
          method: "PUT", redirect: "error", signal: AbortSignal.timeout(30000),
          headers: { "Content-Type": format.mime, "x-ms-blob-type": "BlockBlob", "If-None-Match": "*" },
          body: new Uint8Array(bytes),
        });
        await put.body?.cancel();
        if (!put.ok && put.status !== 412) throw new Error();
        const verified = await fetchImpl(finalUrl, { method: "HEAD", redirect: "error", signal: AbortSignal.timeout(15000) });
        await verified.body?.cancel();
        if (verified.status !== 200) throw new Error();
      }
    } catch {
      throw new BackofficeHttpError(502, "The QA deal exists, but its images could not all be verified. Do not create it again.");
    }
  };
}
export const syncPublishedOfferImages = createPublishedOfferImageSync();
