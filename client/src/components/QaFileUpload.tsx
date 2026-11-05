import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { isQaStorageKey, qaFileMaxBytes, type QaFileKind, type QaFileUploadResult } from "@shared/qaFiles";
import { Button } from "@/components/ui/button";

type QaFileUploadProps = {
  requestId: string;
  kind: QaFileKind;
  value: string;
  disabled?: boolean;
  onUploaded: (reference: string) => void;
  onUploadStateChange: (kind: QaFileKind, pending: boolean) => void;
};

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const fieldNames: Record<QaFileKind, string> = { logo: "Logo", cover: "Cover image", cr: "CR document" };
const acceptByKind: Record<QaFileKind, string> = {
  logo: "image/png,image/jpeg,image/webp",
  cover: "image/png,image/jpeg,image/webp",
  cr: "application/pdf,image/png,image/jpeg,image/webp",
};

function isAcceptedFile(file: File, kind: QaFileKind) {
  if (kind === "cr" && (imageTypes.has(file.type) || file.type === "application/pdf")) return true;
  if (kind !== "cr" && imageTypes.has(file.type)) return true;
  if (file.type) return false;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return kind === "cr"
    ? ["pdf", "png", "jpg", "jpeg", "webp"].includes(extension ?? "")
    : ["png", "jpg", "jpeg", "webp"].includes(extension ?? "");
}

function messageForStatus(status: number) {
  if (status === 400) return "This file type is not accepted. Choose a PNG, JPEG, or WebP image; CR documents may also be PDF.";
  if (status === 413) return "This file is larger than the allowed limit.";
  if (status === 409) return "This request can no longer receive QA files because its status or backoffice link changed.";
  if (status === 403) return "You are not authorized to upload QA files.";
  return "The QA file could not be uploaded. Please try again.";
}

export default function QaFileUpload({
  requestId,
  kind,
  value,
  disabled = false,
  onUploaded,
  onUploadStateChange,
}: QaFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const qaKey = isQaStorageKey(value);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const handleSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError("");
    setSuccess("");

    if (!isAcceptedFile(file, kind)) {
      setError(kind === "cr"
        ? "Choose a PDF, PNG, JPEG, or WebP file."
        : "Choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > qaFileMaxBytes[kind]) {
      setError(`${fieldNames[kind]} must be no larger than ${kind === "cr" ? "10" : "5"} MB.`);
      return;
    }

    setUploading(true);
    onUploadStateChange(kind, true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch(`/api/merchant-requests/${encodeURIComponent(requestId)}/qa-files/${kind}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
        signal: controller.signal,
      });
      if (!mountedRef.current) return;
      if (!response.ok) {
        setError(messageForStatus(response.status));
        return;
      }
      const result = await response.json().catch(() => null) as QaFileUploadResult | null;
      if (!result || result.kind !== kind || typeof result.reference !== "string" || !isQaStorageKey(result.reference)) {
        setError("The upload response did not contain a valid QA storage reference. Please retry.");
        return;
      }
      onUploaded(result.reference);
      setSuccess(`${fieldNames[kind]} uploaded. Save QA details to keep this reference.`);
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setError("The QA file could not be uploaded. Check your connection and retry.");
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current) {
        setUploading(false);
        onUploadStateChange(kind, false);
      }
    }
  };

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-700">Upload a QA {fieldNames[kind].toLowerCase()}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {kind === "cr" ? "PDF or PNG, JPEG, WebP · up to 10 MB" : "PNG, JPEG, or WebP · up to 5 MB"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptByKind[kind]}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={handleSelection}
          aria-label={`Choose QA ${fieldNames[kind].toLowerCase()} file`}
        />
      </div>
      {value && <p className="mt-2 break-all text-xs text-slate-600" role="status">
        {qaKey ? "QA storage key already set" : "External / portal reference — reupload here if QA needs a direct file"}
      </p>}
      {uploading && <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading file to QA storage…
      </p>}
      {success && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-800" role="status">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{success}
      </p>}
      {error && <p className="mt-2 flex items-start gap-1.5 text-xs text-red-800" role="alert">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}
      </p>}
    </div>
  );
}
