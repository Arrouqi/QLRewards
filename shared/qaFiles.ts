export const qaFileKinds = ["logo", "cover", "cr"] as const;
export type QaFileKind = (typeof qaFileKinds)[number];
export const qaFileMaxBytes = { logo: 5 * 1024 * 1024, cover: 5 * 1024 * 1024, cr: 10 * 1024 * 1024 } as const;
export interface QaFileUploadResult { kind: QaFileKind; reference: string }

// QA's payload stores the returned key, not the temporary signed upload URL.
export function isQaStorageKey(value: string): boolean {
  const parts = value.split("/");
  if (parts.length !== 3 || !["qa", "prod"].includes(parts[0]) || !/^(default|\d+)$/.test(parts[1])) return false;
  try {
    const name = decodeURIComponent(parts[2]);
    return name.length > 0 && name.length <= 255 && name !== "." && name !== ".."
      && !/[\\/?#\x00-\x1f\x7f]/.test(name);
  } catch { return false; }
}

export function isMerchantAssetReference(value: string): boolean {
  if (isQaStorageKey(value)) return true;
  if (!value || /[\s\x00-\x1f]/.test(value)) return false;
  if (!/^https?:\/\//i.test(value) && !/^\/(?!\/)/.test(value)) return false;
  try {
    const url = new URL(value, "https://portal.invalid");
    return !url.username && !url.password && !url.hash
      && !Array.from(url.searchParams.keys()).some((key) => /^(sig|signature|x-amz-signature)$/i.test(key));
  } catch { return false; }
}
