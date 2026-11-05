import React, { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, FileUp, Trash2 } from "lucide-react";
import { isQaOfferImageKey, qaOfferImageMaxBytes } from "@shared/offerQaDetails";
import { Button } from "@/components/ui/button";

const inputClass = "mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:border-amber-700 focus-visible:ring-2 focus-visible:ring-amber-700/20 disabled:bg-slate-100";

export function isOfferQaRequestActive(mounted: boolean, expectedId: string, currentId: string, signal: AbortSignal): boolean {
  return mounted && expectedId === currentId && !signal.aborted;
}

export type OfferImageReadResult =
  | { kind: "stale" }
  | { kind: "invalid" }
  | { kind: "valid"; reference: string };

export async function readOfferImageUploadResult(response: Response, isCurrent: () => boolean): Promise<OfferImageReadResult> {
  const result = await response.json().catch(() => null) as { reference?: unknown } | null;
  if (!isCurrent()) return { kind: "stale" };
  if (!result || typeof result.reference !== "string" || !isQaOfferImageKey(result.reference)) return { kind: "invalid" };
  return { kind: "valid", reference: result.reference };
}

type Props = {
  requestId: string;
  images: string[];
  disabled: boolean;
  onChange: (images: string[]) => void;
  onPendingChange: (pending: boolean) => void;
};

export default function OfferQaImages({ requestId, images, disabled, onChange, onPendingChange }: Props) {
  const imageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const currentRequestId = useRef(requestId);
  currentRequestId.current = requestId;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [existingReference, setExistingReference] = useState("");

  useEffect(() => {
    mounted.current = true;
    setPending(false);
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
      onPendingChange(false);
    };
  }, [requestId, onPendingChange]);

  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > qaOfferImageMaxBytes) {
      setError("Offer images must be no larger than 5 MB.");
      return;
    }
    if (images.length >= 30) {
      setError("A maximum of 30 offer images can be saved.");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => isOfferQaRequestActive(mounted.current, requestId, currentRequestId.current, controller.signal);
    setPending(true);
    onPendingChange(true);
    try {
      const response = await fetch(`/api/deal-requests/${encodeURIComponent(requestId)}/qa-images`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal,
      });
      if (!isCurrent()) return;
      if (!response.ok) {
        setError(response.status === 403 ? "You are not authorized to upload QA offer images." : response.status === 413 ? "This image is larger than the allowed limit." : response.status === 409 ? "This offer can no longer receive QA images." : "The image could not be uploaded. Please retry.");
        return;
      }
      const result = await readOfferImageUploadResult(response, isCurrent);
      if (!isCurrent() || result.kind === "stale") return;
      if (result.kind === "invalid") {
        setError("The upload response did not contain a valid QA offer-image key.");
        return;
      }
      if (!images.includes(result.reference)) onChange([...images, result.reference]);
      setNotice("Image uploaded. Save QA details to keep its position.");
    } catch {
      if (isCurrent()) setError("The image could not be uploaded. Check your connection and retry.");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (isCurrent()) {
        setPending(false);
        onPendingChange(false);
      }
    }
  };

  const reorder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const addExistingReference = () => {
    const key = existingReference.trim();
    if (!isQaOfferImageKey(key) || key.length > 512) {
      setError("Enter a valid stable QA offer-image key.");
      setNotice("");
      return;
    }
    if (images.includes(key)) {
      setError("That QA image key is already in the ordered list.");
      return;
    }
    if (images.length >= 30) {
      setError("A maximum of 30 offer images can be saved.");
      return;
    }
    onChange([...images, key]);
    setExistingReference("");
    setError("");
    setNotice("Existing QA image key added. Save QA details to keep its position.");
  };

  return <section aria-labelledby={`${imageId}-heading`} className="rounded-md border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h5 id={`${imageId}-heading`} className="text-sm font-semibold text-slate-900">Offer images</h5>
        <p className="mt-1 text-xs text-slate-500">Use real QA image captures. Files are uploaded to QA storage; save the ordered keys below to the offer setup.</p></div>
      <Button type="button" size="sm" variant="outline" disabled={disabled || pending || images.length >= 30} onClick={() => inputRef.current?.click()}>
        <FileUp className="mr-1.5 h-4 w-4" />{pending ? "Uploading…" : "Add image"}
      </Button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose a QA offer image" disabled={disabled || pending} onChange={selectFile} />
    </div>
    <p className="mt-1 text-xs text-slate-500">PNG, JPEG, or WebP · up to 5 MB · up to 30 images</p>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor={`${imageId}-existing-key`}>Existing QA offer-image key</label>
      <input id={`${imageId}-existing-key`} className={`${inputClass} mt-0`} value={existingReference} disabled={disabled || pending || images.length >= 30}
        onChange={(event) => setExistingReference(event.target.value)} placeholder="qa/<capture-id>/<filename>" />
      <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={disabled || pending || images.length >= 30 || !existingReference.trim()} onClick={addExistingReference}>
        Add existing key
      </Button>
    </div>
    {images.length > 0 ? <ol className="mt-3 space-y-2">
      {images.map((image, index) => <li key={`${image}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md bg-slate-50 p-2">
        <span className="w-8 shrink-0 text-center font-mono text-xs text-slate-500">{String(index + 1).padStart(2, "0")}</span>
        <code className="min-w-0 flex-1 break-all text-xs text-slate-700">{image}</code>
        <Button type="button" size="icon" variant="ghost" aria-label={`Move image ${index + 1} up`} disabled={disabled || pending || index === 0} onClick={() => reorder(index, -1)}><ChevronUp className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Move image ${index + 1} down`} disabled={disabled || pending || index === images.length - 1} onClick={() => reorder(index, 1)}><ChevronDown className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={`Remove image ${index + 1}`} disabled={disabled || pending} onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
      </li>)}
    </ol> : <p className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-600">No QA images added. Upload at least one image before saving.</p>}
    {pending && <p className="mt-2 text-xs text-amber-800" role="status">Uploading image to QA storage…</p>}
    {notice && <p className="mt-2 text-xs text-emerald-800" role="status">{notice}</p>}
    {error && <p className="mt-2 flex items-center gap-1.5 text-xs text-red-800" role="alert"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
  </section>;
}
