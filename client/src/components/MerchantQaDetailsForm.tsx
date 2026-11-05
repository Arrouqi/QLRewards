import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  merchantQaDetailsSchema,
  qaWeekdays,
  type MerchantQaDetails,
  type MerchantQaDetailsResponse,
  type MerchantQaOptions,
} from "@shared/merchantQaDetails";
import { Button } from "@/components/ui/button";
import QaFileUpload from "@/components/QaFileUpload";
import type { QaFileKind } from "@shared/qaFiles";

type BranchDraft = {
  name: string;
  locationId: number | null;
  locationUri: string;
  contactMobile: string;
  pin: string;
  pinEnabled: boolean;
  qrEnabled: boolean;
};

type HoursDraft = { closed: boolean | null; open: string; close: string };

type DetailsDraft = {
  agencyMode: "new" | "existing";
  agencyId: string;
  agencyName: string;
  userEmail: string;
  agencyEmail: string;
  contactMobile: string;
  contactWhatsapp: string;
  agencyLogoUri: string;
  coverPhoto: string;
  aboutAgency: string;
  crNumber: string;
  crUri: string;
  isPriceList: boolean;
  categoryId: number | null;
  hoursEnabled: boolean;
  workingHours: Record<(typeof qaWeekdays)[number], HoursDraft>;
  branches: BranchDraft[];
};

const detailsKey = (requestId: string) => ["merchant-qa-details", requestId] as const;
const optionsKey = ["backoffice", "merchant-options"] as const;
const weekdayNames: Record<(typeof qaWeekdays)[number], string> = {
  saturday: "Saturday",
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

function blankBranch(source?: MerchantQaDetailsResponse["sourceBranches"][number]): BranchDraft {
  return {
    name: source?.name ?? "",
    locationId: null,
    locationUri: source?.locationUri ?? "",
    contactMobile: source?.contactMobile ?? "",
    pin: "",
    pinEnabled: false,
    qrEnabled: false,
  };
}

export function createEmptyMerchantQaDetailsDraft(
  prefill?: Partial<MerchantQaDetails>,
  sourceBranches: MerchantQaDetailsResponse["sourceBranches"] = [],
): DetailsDraft {
  const prefilledBranches = prefill?.branches?.map((branch) => blankBranch({
    name: branch.name,
    locationUri: branch.locationUri,
    contactMobile: branch.contactMobile,
  }));
  const branches = prefilledBranches?.length
    ? prefilledBranches
    : sourceBranches.length ? sourceBranches.map((branch) => blankBranch(branch)) : [blankBranch()];
  return {
    agencyMode: "new",
    agencyId: "0",
    agencyName: prefill?.agencyName ?? "",
    userEmail: "",
    agencyEmail: prefill?.agencyEmail ?? "",
    contactMobile: prefill?.contactMobile ?? "",
    contactWhatsapp: prefill?.contactWhatsapp ?? "",
    agencyLogoUri: prefill?.agencyLogoUri ?? "",
    coverPhoto: prefill?.coverPhoto ?? "",
    aboutAgency: prefill?.aboutAgency ?? "",
    crNumber: prefill?.crNumber ?? "",
    crUri: prefill?.crUri ?? "",
    isPriceList: false,
    categoryId: null,
    hoursEnabled: false,
    workingHours: prefill?.workingHours
      ? { ...prefill.workingHours }
      : Object.fromEntries(qaWeekdays.map((day) => [day, { closed: null, open: "", close: "" }])) as DetailsDraft["workingHours"],
    branches,
  };
}

function toDraft(details: MerchantQaDetails): DetailsDraft {
  return {
    agencyMode: details.agencyId === 0 ? "new" : "existing",
    agencyId: details.agencyId === 0 ? "" : String(details.agencyId),
    agencyName: details.agencyName ?? "",
    userEmail: details.userEmail,
    agencyEmail: details.agencyEmail,
    contactMobile: details.contactMobile,
    contactWhatsapp: details.contactWhatsapp,
    agencyLogoUri: details.agencyLogoUri,
    coverPhoto: details.coverPhoto,
    aboutAgency: details.aboutAgency,
    crNumber: details.crNumber,
    crUri: details.crUri,
    isPriceList: details.isPriceList,
    categoryId: details.categoryId,
    hoursEnabled: details.workingHours !== undefined,
    workingHours: details.workingHours
      ? { ...details.workingHours }
      : Object.fromEntries(qaWeekdays.map((day) => [day, { closed: null, open: "", close: "" }])) as DetailsDraft["workingHours"],
    branches: details.branches.map((branch) => ({ ...branch, pin: branch.pin ?? "", pinEnabled: branch.pinEnabled ?? false, qrEnabled: branch.qrEnabled ?? false })),
  };
}

export function validateMerchantQaDetailsDraft(draft: DetailsDraft, profileNamesPresent: boolean) {
  const candidate = {
    agencyName: draft.agencyName,
    agencyEmail: draft.agencyEmail,
    contactMobile: draft.contactMobile,
    contactWhatsapp: draft.contactWhatsapp,
    agencyLogoUri: draft.agencyLogoUri,
    coverPhoto: draft.coverPhoto,
    aboutAgency: draft.aboutAgency,
    crNumber: draft.crNumber,
    crUri: draft.crUri,
    agencyId: draft.agencyMode === "new" ? 0 : Number(draft.agencyId) > 0 ? Number(draft.agencyId) : -1,
    userEmail: draft.userEmail,
    isPriceList: draft.isPriceList,
    categoryId: draft.categoryId ?? 0,
    ...(draft.hoursEnabled ? { workingHours: draft.workingHours } : {}),
    branches: draft.branches.map((branch) => ({ ...branch, locationId: branch.locationId ?? 0 })),
  } as unknown as MerchantQaDetails;
  if (profileNamesPresent && !draft.agencyName.trim()) {
    return merchantQaDetailsSchema.safeParse({ ...candidate, agencyName: "" });
  }
  return merchantQaDetailsSchema.safeParse(candidate);
}

function responseMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function fieldLabel(path: string) {
  return path.replace(/\[(\d+)\]/g, " $1").replace(/\./g, " › ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function merchantQaDetailsQueryKey(requestId: string) {
  return detailsKey(requestId);
}

type MerchantQaDetailsFormProps = {
  environmentLabel?: string;
  requestId: string;
  locked?: boolean;
  onSaved?: () => void | Promise<void>;
  onUploadStateChange?: (scope: object, pending: boolean) => void;
};

export default function MerchantQaDetailsForm({ requestId, locked = false, onSaved, onUploadStateChange, environmentLabel = "QA" }: MerchantQaDetailsFormProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DetailsDraft>(() => createEmptyMerchantQaDetailsDraft());
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [pendingUploads, setPendingUploads] = useState<Set<QaFileKind>>(() => new Set());
  const pendingUploadKinds = useRef(new Set<QaFileKind>());
  const uploadScope = useRef<object>({});
  const uploadStateCallback = useRef(onUploadStateChange);
  uploadStateCallback.current = onUploadStateChange;

  const detailsQuery = useQuery<MerchantQaDetailsResponse>({
    queryKey: detailsKey(requestId),
    enabled: !!requestId,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/merchant-requests/${encodeURIComponent(requestId)}/qa-details`, { credentials: "include" });
      if (!response.ok) throw new Error(response.status === 403 ? "You are not authorized to view QA details." : "Unable to load this merchant’s QA details.");
      return await response.json() as MerchantQaDetailsResponse;
    },
  });

  const optionsQuery = useQuery<MerchantQaOptions>({
    queryKey: optionsKey,
    enabled: !!requestId,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/backoffice/merchant-options", { credentials: "include" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status === 403 ? "You are not authorized to load QA options." : "Unable to load QA categories and locations.");
      return result as MerchantQaOptions;
    },
  });

  useEffect(() => {
    const response = detailsQuery.data;
    if (!response || initialized) return;
    if (response.details) {
      setDraft(toDraft(response.details));
    } else {
      const initialDraft = createEmptyMerchantQaDetailsDraft(response.prefill, response.sourceBranches);
      if (response.profileNames !== undefined && !response.profileNames.includes(initialDraft.agencyName)) {
        initialDraft.agencyName = "";
      }
      setDraft(initialDraft);
    }
    setInitialized(true);
  }, [detailsQuery.data, initialized]);

  const isReadOnly = locked || detailsQuery.data?.editable === false;
  const uploadsPending = pendingUploads.size > 0;
  const reportUploadState = useCallback((kind: QaFileKind, pending: boolean) => {
    if (pending) pendingUploadKinds.current.add(kind);
    else pendingUploadKinds.current.delete(kind);
    const next = new Set(pendingUploadKinds.current);
    setPendingUploads(next);
    uploadStateCallback.current?.(uploadScope.current, next.size > 0);
  }, []);

  useEffect(() => {
    return () => uploadStateCallback.current?.(uploadScope.current, false);
  }, []);
  const issueList = useMemo(() => detailsQuery.data?.issues ?? [], [detailsQuery.data?.issues]);

  const updateDraft = (patch: Partial<DetailsDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateBranch = (index: number, patch: Partial<BranchDraft>) => setDraft((current) => ({
    ...current,
    branches: current.branches.map((branch, branchIndex) => branchIndex === index ? { ...branch, ...patch } : branch),
  }));

  const handleSave = async () => {
    if (isReadOnly || saving || uploadsPending || !detailsQuery.data) return;
    setSaveError("");
    setSavedNotice(false);
    setServerFieldErrors([]);
    const submittedProfiles = detailsQuery.data.profileNames;
    const savedProfile = detailsQuery.data.details?.agencyName;
    if (submittedProfiles !== undefined && !submittedProfiles.includes(draft.agencyName) && draft.agencyName !== savedProfile) {
      setValidationErrors({ agencyName: "Choose one of the submitted group or brand names." });
      return;
    }
    const parsed = validateMerchantQaDetailsDraft(draft, detailsQuery.data.profileNames !== undefined);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path.join(".");
        if (key && !next[key]) next[key] = issue.message;
      });
      setValidationErrors(next);
      return;
    }
    setValidationErrors({});
    setSaving(true);
    try {
      const response = await fetch(`/api/merchant-requests/${encodeURIComponent(requestId)}/qa-details`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) throw new Error("QA details can be changed only while Pending or In Moderation, before a QA merchant is linked and without an uncertain creation result.");
        if (response.status === 400 && isRecord(result) && Array.isArray(result.fields)) {
          const safeErrors = result.fields.flatMap((item) => {
            if (!isRecord(item)) return [];
            const field = typeof item.field === "string" ? item.field.slice(0, 120) : "Form";
            const message = typeof item.message === "string" ? item.message.slice(0, 240) : "";
            return message ? [`${fieldLabel(field)}: ${message}`] : [];
          }).slice(0, 12);
          if (safeErrors.length) {
            setServerFieldErrors(safeErrors);
            return;
          }
        }
        if (response.status === 400) {
          throw new Error("QA details were rejected. Review the required fields and try again.");
        }
        throw new Error(response.status === 403 ? "You are not authorized to save QA details." : "Unable to save QA details. Please retry.");
      }
      const saved = result as MerchantQaDetailsResponse;
      queryClient.setQueryData(detailsKey(requestId), saved);
      setDraft(saved.details ? toDraft(saved.details) : draft);
      await queryClient.invalidateQueries({ queryKey: detailsKey(requestId) });
      await queryClient.invalidateQueries({ queryKey: ["backoffice", "merchant", requestId] });
      await queryClient.invalidateQueries({ queryKey: ["backoffice"] });
      await onSaved?.();
      setSavedNotice(true);
    } catch (error) {
      setSaveError(responseMessage(error, "Unable to save QA details. Please retry."));
      if (error instanceof Error && error.message.includes("can no longer be changed")) {
        await detailsQuery.refetch();
      }
    } finally {
      setSaving(false);
    }
  };

  if (detailsQuery.isLoading) {
    return <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Loading merchant QA details">
      <div className="mb-3 h-4 w-52 animate-pulse rounded bg-slate-200" />
      <div className="space-y-2"><div className="h-3 w-full animate-pulse rounded bg-slate-100" /><div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" /></div>
    </section>;
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4" aria-label="Merchant QA details unavailable">
      <div className="flex items-start gap-2 text-sm text-red-900">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div><h4 className="font-semibold">QA details could not be loaded</h4><p className="mt-1">{responseMessage(detailsQuery.error, "Check your connection, then retry.")}</p></div>
      </div>
      <Button type="button" className="mt-3" size="sm" variant="outline" onClick={() => detailsQuery.refetch()}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />Retry loading details
      </Button>
    </section>;
  }

  const inputClass = "mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus-visible:border-amber-700 focus-visible:ring-2 focus-visible:ring-amber-700/20 disabled:bg-slate-100";
  const labelClass = "block text-sm font-medium text-slate-800";
  const errorFor = (path: string) => validationErrors[path];
  const renderError = (path: string) => errorFor(path) ? <p className="mt-1 text-xs text-red-700" id={`error-${path.replace(/[^a-zA-Z0-9-]/g, "-")}`}>{errorFor(path)}</p> : null;
  const fieldError = (path: string) => errorFor(path) ? { "aria-invalid": true as const, "aria-describedby": `error-${path.replace(/[^a-zA-Z0-9-]/g, "-")}` } : {};

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="merchant-qa-details-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 id="merchant-qa-details-title" className="text-base font-semibold text-slate-900">Merchant {environmentLabel} details</h4>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Enter the actual {environmentLabel} backoffice values for {detailsQuery.data.merchantName}. Saving records these details in this portal; it does not create a merchant.</p>
        </div>
        {isReadOnly && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Read only</span>}
      </div>

      {issueList.length > 0 && <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
        <p className="font-semibold">Review before creating in QA</p>
        <ul className="mt-1 list-inside list-disc space-y-1">{issueList.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>
      </div>}
      {!detailsQuery.data.editable && !locked && <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">QA details are editable while Pending or In Moderation. Linked merchants and uncertain creation results remain locked.</p>}

      {(optionsQuery.isError || optionsQuery.isLoading) && <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3" aria-live="polite">
        {optionsQuery.isLoading ? <div className="h-4 w-56 animate-pulse rounded bg-slate-200" aria-label="Loading QA categories and locations" /> : <>
          <p className="text-sm text-red-800">{responseMessage(optionsQuery.error, "QA categories and locations are unavailable.")}</p>
          <Button type="button" className="mt-2" size="sm" variant="outline" onClick={() => optionsQuery.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Retry loading options</Button>
        </>}
      </div>}

      <div className="mt-5 space-y-6">
        <fieldset disabled={isReadOnly || saving} className="space-y-5">
          <legend className="sr-only">Merchant backoffice setup</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="rounded-md border border-slate-200 p-3">
              <legend className="px-1 text-sm font-medium text-slate-800">Agency setup</legend>
              {detailsQuery.data.profileNames !== undefined ? <label className={`${labelClass} mb-3`} htmlFor="qa-agency-profile">Submitted group / brand name
                <select id="qa-agency-profile" className={inputClass} value={draft.agencyName} onChange={(event) => updateDraft({ agencyName: event.target.value })} {...fieldError("agencyName")}>
                  <option value="">Choose a submitted name</option>
                  {detailsQuery.data.details?.agencyName && !detailsQuery.data.profileNames.includes(detailsQuery.data.details.agencyName) && <option value={detailsQuery.data.details.agencyName}>{detailsQuery.data.details.agencyName} (saved value)</option>}
                  {detailsQuery.data.profileNames.map((profileName, index) => <option key={`${index}-${profileName}`} value={profileName}>{profileName}</option>)}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">Choose one of the names submitted for this group. New names cannot be entered here.</span>
                {detailsQuery.data.profileNames.length === 0 && <span className="mt-1 block text-xs text-amber-800">No submitted group or brand names are available. Ask for the submitted profile list before saving.</span>}
                {renderError("agencyName")}
              </label> : <label className={labelClass} htmlFor="qa-brand-name">Brand name
                <input id="qa-brand-name" className={inputClass} value={draft.agencyName} onChange={(event) => updateDraft({ agencyName: event.target.value })} {...fieldError("agencyName")} />
                <span className="mt-1 block text-xs font-normal text-slate-500">Enter the merchant’s actual brand name. Do not use a company-name field.</span>
                {renderError("agencyName")}
              </label>}
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Optional QA agency mapping</p>
              <div className="mt-1 space-y-2">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="radio" name={`agency-mode-${requestId}`} className="mt-1 accent-amber-700" checked={draft.agencyMode === "new"} onChange={() => updateDraft({ agencyMode: "new", agencyId: "" })} />
                  <span><strong className="font-medium">Create a new agency</strong><span className="block text-xs text-slate-500">Uses agency ID 0.</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="radio" name={`agency-mode-${requestId}`} className="mt-1 accent-amber-700" checked={draft.agencyMode === "existing"} onChange={() => updateDraft({ agencyMode: "existing" })} />
                  <span><strong className="font-medium">Use an existing agency</strong><span className="block text-xs text-amber-800">Enter the actual positive QA agency ID. Confirm it carefully before saving.</span></span>
                </label>
              </div>
              {draft.agencyMode === "existing" && <label className={`${labelClass} mt-3`} htmlFor="qa-agency-id">Existing agency ID
                <input id="qa-agency-id" inputMode="numeric" className={inputClass} value={draft.agencyId} onChange={(event) => updateDraft({ agencyId: event.target.value })} {...fieldError("agencyId")} />
                {renderError("agencyId")}
              </label>}
            </fieldset>
            <div className="space-y-4">
              <label className={labelClass} htmlFor="qa-owner-email">Registered {environmentLabel} owner email
                <input id="qa-owner-email" type="email" autoComplete="off" className={inputClass} value={draft.userEmail} onChange={(event) => updateDraft({ userEmail: event.target.value })} {...fieldError("userEmail")} />
                <span className="mt-1 block text-xs font-normal text-slate-500">Use the account registered in QA, not the merchant’s contact email.</span>
                {renderError("userEmail")}
              </label>
              <label className={labelClass} htmlFor="qa-category">{environmentLabel} category
                <select id="qa-category" className={inputClass} value={draft.categoryId ?? ""} onChange={(event) => updateDraft({ categoryId: event.target.value ? Number(event.target.value) : null })} {...fieldError("categoryId")}>
                  <option value="">Choose a category</option>
                  {(optionsQuery.data?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                {renderError("categoryId")}
              </label>
              <fieldset className="rounded-md border border-slate-200 p-3">
                <legend className="px-1 text-sm font-medium text-slate-800">Price list</legend>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="accent-amber-700" checked={draft.isPriceList} onChange={(event) => updateDraft({ isPriceList: event.target.checked })} />
                  Include a QA price list
                </label>
              </fieldset>
            </div>
          </div>

          <section aria-labelledby="qa-business-profile-heading">
            <h5 id="qa-business-profile-heading" className="text-sm font-semibold text-slate-900">Business profile and registration</h5>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className={labelClass} htmlFor="qa-business-email">Business email
                <input id="qa-business-email" type="email" autoComplete="off" className={inputClass} value={draft.agencyEmail} onChange={(event) => updateDraft({ agencyEmail: event.target.value })} {...fieldError("agencyEmail")} />
                {renderError("agencyEmail")}
              </label>
              <label className={labelClass} htmlFor="qa-business-phone">Business phone
                <input id="qa-business-phone" type="tel" autoComplete="off" className={inputClass} value={draft.contactMobile} onChange={(event) => updateDraft({ contactMobile: event.target.value })} {...fieldError("contactMobile")} />
                {renderError("contactMobile")}
              </label>
              <label className={labelClass} htmlFor="qa-business-whatsapp">Business WhatsApp
                <input id="qa-business-whatsapp" type="tel" autoComplete="off" className={inputClass} value={draft.contactWhatsapp} onChange={(event) => updateDraft({ contactWhatsapp: event.target.value })} {...fieldError("contactWhatsapp")} />
                {renderError("contactWhatsapp")}
              </label>
              <label className={labelClass} htmlFor="qa-cr-number">Commercial registration (CR) number
                <input id="qa-cr-number" autoComplete="off" className={inputClass} value={draft.crNumber} onChange={(event) => updateDraft({ crNumber: event.target.value })} {...fieldError("crNumber")} />
                {renderError("crNumber")}
              </label>
              <div>
                <label className={labelClass} htmlFor="qa-cr-reference">CR document reference
                <input id="qa-cr-reference" className={inputClass} value={draft.crUri} onChange={(event) => updateDraft({ crUri: event.target.value })} {...fieldError("crUri")} />
                <span className="mt-1 block text-xs font-normal text-slate-500">Enter an existing stable key or permanent URL, or upload a file below.</span>
                {renderError("crUri")}
                </label>
                <QaFileUpload requestId={requestId} kind="cr" value={draft.crUri} disabled={isReadOnly || saving} onUploadStateChange={reportUploadState} onUploaded={(reference) => updateDraft({ crUri: reference })} />
              </div>
              <div>
                <label className={labelClass} htmlFor="qa-logo-reference">Logo reference
                <input id="qa-logo-reference" className={inputClass} value={draft.agencyLogoUri} onChange={(event) => updateDraft({ agencyLogoUri: event.target.value })} {...fieldError("agencyLogoUri")} />
                {renderError("agencyLogoUri")}
                </label>
                <QaFileUpload requestId={requestId} kind="logo" value={draft.agencyLogoUri} disabled={isReadOnly || saving} onUploadStateChange={reportUploadState} onUploaded={(reference) => updateDraft({ agencyLogoUri: reference })} />
              </div>
              <div>
                <label className={labelClass} htmlFor="qa-cover-reference">Cover image reference
                <input id="qa-cover-reference" className={inputClass} value={draft.coverPhoto} onChange={(event) => updateDraft({ coverPhoto: event.target.value })} {...fieldError("coverPhoto")} />
                {renderError("coverPhoto")}
                </label>
                <QaFileUpload requestId={requestId} kind="cover" value={draft.coverPhoto} disabled={isReadOnly || saving} onUploadStateChange={reportUploadState} onUploaded={(reference) => updateDraft({ coverPhoto: reference })} />
              </div>
              <label className={`${labelClass} sm:col-span-2`} htmlFor="qa-about-agency">Business description
                <textarea id="qa-about-agency" rows={5} className={inputClass} value={draft.aboutAgency} onChange={(event) => updateDraft({ aboutAgency: event.target.value })} {...fieldError("aboutAgency")} />
                {renderError("aboutAgency")}
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">References may be QA storage keys or permanent URLs. Portal URLs may need to be uploaded here for QA use; files from the merchant editor are not copied into QA automatically.</p>
          </section>

          <section aria-labelledby="qa-hours-heading">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900" htmlFor="qa-hours-enabled">
              <input id="qa-hours-enabled" type="checkbox" className="accent-amber-700" checked={draft.hoursEnabled} onChange={(event) => updateDraft({ hoursEnabled: event.target.checked })} />
              Add optional QA working hours
            </label>
            {draft.hoursEnabled && <>
              <p className="mt-1 text-xs text-slate-500">Set each day to opening hours or closed. Times use 24-hour format.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {qaWeekdays.map((day) => {
                  const hours = draft.workingHours[day];
                  const base = `workingHours.${day}`;
                  return <fieldset key={day} className="rounded-md border border-slate-200 p-3">
                    <legend className="px-1 text-sm font-medium text-slate-800">{weekdayNames[day]}</legend>
                    <div className="flex gap-4">
                      {[["open", "Open"], ["closed", "Closed"]].map(([value, label]) => <label key={value} className="flex items-center gap-2 text-xs text-slate-700">
                        <input type="radio" name={`hours-${requestId}-${day}`} className="accent-amber-700" checked={hours.closed === (value === "closed")} onChange={() => setDraft((current) => ({ ...current, workingHours: { ...current.workingHours, [day]: { ...current.workingHours[day], closed: value === "closed" } } }))} />{label}
                      </label>)}
                    </div>
                    {hours.closed === false && <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-600">Opens<input type="time" className={inputClass} value={hours.open} onChange={(event) => setDraft((current) => ({ ...current, workingHours: { ...current.workingHours, [day]: { ...current.workingHours[day], open: event.target.value } } }))} /></label>
                      <label className="text-xs text-slate-600">Closes<input type="time" className={inputClass} value={hours.close} onChange={(event) => setDraft((current) => ({ ...current, workingHours: { ...current.workingHours, [day]: { ...current.workingHours[day], close: event.target.value } } }))} /></label>
                    </div>}
                    {renderError(`${base}.closed`)}{renderError(`${base}.open`)}{renderError(`${base}.close`)}
                  </fieldset>;
                })}
              </div>
            </>}
          </section>

          <section aria-labelledby="qa-branches-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><h5 id="qa-branches-heading" className="text-sm font-semibold text-slate-900">QA branch details</h5><p className="mt-1 text-xs text-slate-500">These are QA merchant details only; portal branches are not changed.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => setDraft((current) => ({ ...current, branches: [...current.branches, blankBranch()] }))}><Plus className="mr-1.5 h-4 w-4" />Add branch</Button>
            </div>
            <div className="mt-3 space-y-3">
              {draft.branches.map((branch, index) => {
                const prefix = `branches.${index}`;
                return <fieldset key={index} className="rounded-md border border-slate-200 p-3 sm:p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-800">Branch {index + 1}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelClass} htmlFor={`${prefix}-name`}>Actual QA branch name<input id={`${prefix}-name`} className={inputClass} value={branch.name} onChange={(event) => updateBranch(index, { name: event.target.value })} {...fieldError(`${prefix}.name`)} />{renderError(`${prefix}.name`)}</label>
                    <label className={labelClass} htmlFor={`${prefix}-location`}>QA location<select id={`${prefix}-location`} className={inputClass} value={branch.locationId ?? ""} onChange={(event) => updateBranch(index, { locationId: event.target.value ? Number(event.target.value) : null })} {...fieldError(`${prefix}.locationId`)}>
                      <option value="">Choose a location</option>{(optionsQuery.data?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>{renderError(`${prefix}.locationId`)}</label>
                    <label className={labelClass} htmlFor={`${prefix}-map`}>Map URL<input id={`${prefix}-map`} type="url" inputMode="url" className={inputClass} value={branch.locationUri} onChange={(event) => updateBranch(index, { locationUri: event.target.value })} {...fieldError(`${prefix}.locationUri`)} />{renderError(`${prefix}.locationUri`)}</label>
                    <label className={labelClass} htmlFor={`${prefix}-phone`}>Branch contact phone<input id={`${prefix}-phone`} type="tel" autoComplete="off" className={inputClass} value={branch.contactMobile} onChange={(event) => updateBranch(index, { contactMobile: event.target.value })} {...fieldError(`${prefix}.contactMobile`)} />{renderError(`${prefix}.contactMobile`)}</label>
                  </div>
                  <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">PIN redemption</p>
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" className="accent-amber-700" checked={branch.pinEnabled} onChange={(event) => updateBranch(index, { pinEnabled: event.target.checked })} />Enable PIN redemption</label>
                      {branch.pinEnabled === true && <label className={`${labelClass} mt-2`} htmlFor={`${prefix}-pin`}>QA PIN<input id={`${prefix}-pin`} type="password" autoComplete="new-password" className={inputClass} value={branch.pin} onChange={(event) => updateBranch(index, { pin: event.target.value })} {...fieldError(`${prefix}.pin`)} />{renderError(`${prefix}.pin`)}</label>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">QR redemption</p>
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" className="accent-amber-700" checked={branch.qrEnabled} onChange={(event) => updateBranch(index, { qrEnabled: event.target.checked })} />Enable QR redemption</label>
                    </div>
                  </div>
                  {draft.branches.length > 1 && <Button type="button" size="sm" variant="ghost" className="mt-3 text-red-800 hover:text-red-900" onClick={() => setDraft((current) => ({ ...current, branches: current.branches.filter((_, branchIndex) => branchIndex !== index) }))}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remove branch {index + 1}</Button>}
                </fieldset>;
              })}
            </div>
          </section>
        </fieldset>
      </div>

      {Object.keys(validationErrors).length > 0 && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
        <p className="font-semibold">Complete the required QA values</p><ul className="mt-1 list-inside list-disc space-y-1">{Object.entries(validationErrors).map(([path, message]) => <li key={path}>{fieldLabel(path)}: {message}</li>)}</ul>
      </div>}
      {serverFieldErrors.length > 0 && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert"><p className="font-semibold">The server rejected these values</p><ul className="mt-1 list-inside list-disc space-y-1">{serverFieldErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
      {savedNotice && <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status"><CheckCircle2 className="h-4 w-4 shrink-0" />QA details saved. No QA merchant was created.</p>}
      {saveError && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert"><AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{saveError}</span><Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={saving || isReadOnly || uploadsPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Retry save</Button></div>}

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">No QA merchant is created when these details are saved.</p>
        <Button type="button" onClick={handleSave} disabled={isReadOnly || saving || uploadsPending || optionsQuery.isLoading || optionsQuery.isError} aria-label="Save QA details without creating merchant">
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving QA details…" : "Save QA details"}
        </Button>
      </div>
    </section>
  );
}
