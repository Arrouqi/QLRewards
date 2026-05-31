import imageCompression from "browser-image-compression";

export type CompressPreset = "deal" | "merchant";

const PRESETS: Record<CompressPreset, Parameters<typeof imageCompression>[1]> = {
  deal: {
    maxSizeMB: 2,
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    initialQuality: 0.85,
  },
  merchant: {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    initialQuality: 0.85,
  },
};

const MAX_INPUT_BYTES = 100 * 1024 * 1024;

const HEIC_MIME = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const HEIC_EXT = /\.(heic|heif)$/i;

function isHeicFile(file: File): boolean {
  return HEIC_MIME.has(file.type.toLowerCase()) || HEIC_EXT.test(file.name);
}

const HEIC_ERROR =
  'This photo is in HEIC format, which most browsers can\'t process. ' +
  'On iPhone: go to Settings → Camera → Formats and choose "Most Compatible" to shoot in JPEG. ' +
  'Or share the photo to convert it automatically before uploading.';

export async function compressImage(
  file: File,
  preset: CompressPreset = "deal"
): Promise<{ file: File; compressed: boolean; error?: string }> {
  if (!file.type.startsWith("image/")) {
    return { file, compressed: false };
  }

  if (isHeicFile(file)) {
    return { file, compressed: false, error: `"${file.name}" is in HEIC format. ${HEIC_ERROR}` };
  }

  if (file.size > MAX_INPUT_BYTES) {
    return {
      file,
      compressed: false,
      error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB — maximum accepted is 100 MB.`,
    };
  }

  try {
    const compressed = await imageCompression(file, PRESETS[preset]);
    return { file: compressed, compressed: true };
  } catch {
    return { file, compressed: false };
  }
}

export async function compressImages(
  files: File[],
  preset: CompressPreset = "deal"
): Promise<{ files: File[]; errors: string[] }> {
  const results = await Promise.all(files.map((f) => compressImage(f, preset)));
  return {
    files: results.filter((r) => !r.error).map((r) => r.file),
    errors: results.flatMap((r) => (r.error ? [r.error] : [])),
  };
}

export async function compressFileForUpload(file: File, preset: CompressPreset = "merchant"): Promise<File> {
  if (!file.type.startsWith("image/") || isHeicFile(file)) return file;
  const result = await compressImage(file, preset);
  return result.file;
}
