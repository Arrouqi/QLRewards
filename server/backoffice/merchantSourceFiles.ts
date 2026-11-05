import type { MerchantQaDetails } from "@shared/merchantQaDetails";
import { isQaStorageKey, qaFileMaxBytes, type QaFileKind } from "@shared/qaFiles";
import type { MerchantSource } from "./mapMerchant";
import { BackofficeHttpError } from "./errors";
import { fileFormat, uploadQaFile } from "./uploads";
import { isCurrentStorageKey } from "./environment";

const fields = [
  { field: "agencyLogoUri", source: "logo", kind: "logo" },
  { field: "coverPhoto", source: "coverImage", kind: "cover" },
  { field: "crUri", source: "crDocument", kind: "cr" },
] as const;

export function isTrustedMerchantSourceFile(value: string): boolean {
  if (!value || /[\\%]/.test(value) || value.includes("..")) return false;
  try {
    const url = new URL(value);
    return url.origin === "https://qlrstoragedev.blob.core.windows.net"
      && !url.username && !url.password && !url.search && !url.hash && url.href === value
      && /^\/deals-clients\/merchant-documents\/[a-zA-Z0-9/_-]+\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|pdf)$/i.test(url.pathname);
  } catch { return false; }
}

export function merchantQaFileIssues(source: MerchantSource, details: MerchantQaDetails): string[] {
  return fields.filter(({ field, source: name }) => !(isQaStorageKey(details[field]) && isCurrentStorageKey(details[field]))
    && !(details[field] === source.assets[name] && isTrustedMerchantSourceFile(details[field])))
    .map(({ field }) => `${field} (upload this submitted file to QA before creation)`);
}

async function readSourceFile(url: string, kind: QaFileKind, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, {
    method: "GET", redirect: "error", signal: AbortSignal.timeout(20000),
    headers: { Accept: kind === "cr" ? "application/pdf,image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp" },
  });
  const limit = qaFileMaxBytes[kind];
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel(); throw new Error();
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error();
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = Buffer.concat(chunks);
  const format = fileFormat(bytes);
  if (!format || (kind !== "cr" && format.mime === "application/pdf")
    || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== format.mime) throw new Error();
  return { bytes, contentType: format.mime };
}

export function createMerchantFilePreparer(fetchImpl: typeof fetch = fetch) {
  return async (
    source: MerchantSource,
    details: MerchantQaDetails,
    upload: typeof uploadQaFile,
    checkpoint: (details: MerchantQaDetails) => Promise<void>,
  ): Promise<MerchantQaDetails> => {
    // Validate every reference before downloading or uploading anything. Only
    // this merchant's exact stored source files may be fetched automatically.
    if (merchantQaFileIssues(source, details).length) {
      throw new BackofficeHttpError(400, "Upload a QA file for each unsupported merchant asset reference.");
    }
    let prepared = { ...details };
    try {
      for (const { field, kind } of fields) {
        if (isQaStorageKey(prepared[field]) && isCurrentStorageKey(prepared[field])) continue;
        const file = await readSourceFile(prepared[field], kind, fetchImpl);
        const result = await upload(kind, file.bytes, file.contentType);
        if (!isQaStorageKey(result.reference) || !isCurrentStorageKey(result.reference)) throw new Error("Wrong upload environment");
        if (result.kind !== kind || !isQaStorageKey(result.reference)) throw new Error();
        prepared = { ...prepared, [field]: result.reference };
        await checkpoint(prepared);
      }
      return prepared;
    } catch {
      throw new BackofficeHttpError(502, "Merchant files could not all be transferred to QA. Completed uploads were retained for retry; no merchant was created.");
    }
  };
}
export const prepareMerchantQaFiles = createMerchantFilePreparer();
