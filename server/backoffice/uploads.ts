import { randomUUID } from "node:crypto";
import { qaTokenProvider } from "./auth";
import { BackofficeHttpError } from "./errors";
import { isQaStorageKey, qaFileKinds, qaFileMaxBytes, type QaFileKind, type QaFileUploadResult } from "@shared/qaFiles";
import { backofficeTarget, backofficeWritesEnabled } from "./environment";

const SIGNING_URL = backofficeTarget.merchantSigner;
const STORAGE_ORIGIN = backofficeTarget.merchantStorage;

export function fileFormat(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return undefined;
}

export async function signingBody(response: Response, maxBytes = 65536) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error();
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); }
}

export function createQaFileUploader(
  tokenProvider = qaTokenProvider,
  fetchImpl: typeof fetch = fetch,
  settings = {
    writesEnabled: backofficeWritesEnabled,
    fileId: () => `${Date.now()}-${randomUUID()}`,
  },
) {
  return async (kindInput: string, bytes: Buffer, declaredType?: string): Promise<QaFileUploadResult> => {
    if (!qaFileKinds.includes(kindInput as QaFileKind)) throw new BackofficeHttpError(400, "Choose a logo, cover image or CR file.");
    const kind = kindInput as QaFileKind;
    if (!Buffer.isBuffer(bytes) || !bytes.length) throw new BackofficeHttpError(400, "Select a non-empty file to upload.");
    if (bytes.length > qaFileMaxBytes[kind]) throw new BackofficeHttpError(413, kind === "cr" ? "CR files must be 10 MB or smaller." : "Images must be 5 MB or smaller.");
    const format = fileFormat(bytes);
    if (!format || (kind !== "cr" && format.mime === "application/pdf")) {
      throw new BackofficeHttpError(400, kind === "cr" ? "Upload a PDF, PNG, JPEG or WebP CR file." : "Upload a PNG, JPEG or WebP image.");
    }
    const mime = declaredType?.split(";")[0].trim().toLowerCase();
    if (mime && mime !== "application/octet-stream" && mime !== format.mime) throw new BackofficeHttpError(400, "The file content does not match its declared type.");
    if (!settings.writesEnabled()) throw new BackofficeHttpError(409, "QA uploads require QA writes enabled and dry-run disabled.");
    // Captured fileType 2 = logos (including cover); 4 = license-files.
    // The signer returns the requested path; the stable payload key adds qa/.
    const path = `${kind === "logo" ? "default" : "0"}/${settings.fileId()}.${format.ext}`;
    const reference = `${backofficeTarget.prefix}/${path}`;
    if (!isQaStorageKey(reference)) throw new BackofficeHttpError(500, "Unable to prepare the QA file path.");
    const container = kind === "cr" ? "license-files" : "logos";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const token = await tokenProvider.getToken();
      if (!token || /[\r\n]/.test(token)) throw new Error();
      const signingUrl = new URL(SIGNING_URL);
      signingUrl.searchParams.set("path", path);
      signingUrl.searchParams.set("fileType", kind === "cr" ? "4" : "2");
      signingUrl.searchParams.set("mimeType", "");
      const signed = await fetchImpl(signingUrl, {
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
      if (target.origin !== STORAGE_ORIGIN || target.username || target.password || target.hash
        || target.pathname !== `/${container}/${reference}` || !target.searchParams.get("sig")) throw new Error();
      // Never forward QA account Authorization to Azure. No redirect or replay.
      const uploaded = await fetchImpl(target, {
        method: "PUT", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": format.mime, "x-ms-blob-type": "BlockBlob" },
        body: new Uint8Array(bytes),
      });
      await uploaded.body?.cancel();
      if (!uploaded.ok) throw new Error();
      return { kind, reference };
    } catch {
      // Signing responses contain SAS credentials. Never echo bodies/URLs/errors.
      throw new BackofficeHttpError(502, "QA file upload could not be confirmed. The file reference was not changed. Select the file and retry.");
    } finally { clearTimeout(timeout); }
  };
}
export const uploadQaFile = createQaFileUploader();
