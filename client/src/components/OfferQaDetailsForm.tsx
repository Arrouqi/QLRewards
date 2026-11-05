import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, RefreshCw, Save } from "lucide-react";
import { offerQaDetailsSchema, offerQaPreparationDetailsSchema, qaOfferDurations, type OfferQaDetails, type OfferQaDetailsResponse, type OfferQaOptions, type QaOption } from "@shared/offerQaDetails";
import { Button } from "@/components/ui/button";
import OfferQaImages from "@/components/OfferQaImages";
import { clearUnavailableOfferQaSelections, isRealOfferParentId, offerQaSaveBlockers, offerQaSelectionIssues } from "./offerQaSaveState";

type Draft = {
  parentMerchantProfileId: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  termsAndConditions: string;
  categoryIds: number[];
  subCategoryIds: number[];
  offerTypeId: number | null;
  branchIds: number[];
  claimRuleIds: number[];
  paymentConditionIds: number[];
  price: string;
  offerDuration: string;
  estimatedSavings: string;
  redemptionType: string;
  redemptionLimit: string;
  startDate: string;
  endDate: string;
  images: string[];
};

const detailsKey = (id: string) => ["offer-qa-details", id] as const;
const optionsKey = (id: string) => ["offer-qa-options", id] as const;
const inputClass = "mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:border-amber-700 focus-visible:ring-2 focus-visible:ring-amber-700/20 disabled:bg-slate-100";
const labelClass = "block text-sm font-medium text-slate-800";

export function createEmptyOfferQaDraft(response?: OfferQaDetailsResponse): Draft {
  const saved = response?.details;
  const prefill = response?.prefill;
  const value = <K extends keyof OfferQaDetails>(key: K) => saved?.[key] !== undefined
    ? saved[key] : prefill?.[key];
  return {
    parentMerchantProfileId: saved?.parentMerchantProfileId ?? response?.merchantProfileId ?? "",
    title: saved?.title ?? prefill?.title ?? "",
    titleAr: saved?.titleAr ?? prefill?.titleAr ?? "",
    description: saved?.description ?? prefill?.description ?? "",
    descriptionAr: saved?.descriptionAr ?? prefill?.descriptionAr ?? "",
    termsAndConditions: saved?.termsAndConditions ?? prefill?.termsAndConditions ?? "",
    categoryIds: [...(value("categoryIds") ?? [])],
    subCategoryIds: [...(value("subCategoryIds") ?? [])],
    offerTypeId: value("offerTypeId") ?? null,
    branchIds: [...(value("branchIds") ?? [])],
    claimRuleIds: [...(value("claimRuleIds") ?? [])],
    paymentConditionIds: [...(value("paymentConditionIds") ?? [])],
    price: value("price") === undefined ? "" : String(value("price")),
    offerDuration: value("offerDuration") === undefined ? "" : String(value("offerDuration")),
    estimatedSavings: saved?.estimatedSavings !== undefined ? String(saved.estimatedSavings) : prefill?.estimatedSavings === undefined ? "" : String(prefill.estimatedSavings),
    redemptionType: value("redemptionType") === undefined ? "" : String(value("redemptionType")),
    redemptionLimit: value("redemptionLimit") == null ? "" : String(value("redemptionLimit")),
    startDate: saved?.startDate ?? prefill?.startDate ?? "",
    endDate: saved?.endDate ?? prefill?.endDate ?? "",
    images: [...(value("images") ?? [])],
  };
}

export function rebindOfferQaDraft(draft: Draft, currentParentId: string): Draft {
  return {
    ...draft,
    parentMerchantProfileId: currentParentId,
    branchIds: [],
  };
}

export async function readOfferQaSaveResponse(response: Response, isCurrent: () => boolean): Promise<{ stale: true } | { stale: false; result: unknown }> {
  const result = await response.json().catch(() => null);
  if (!isCurrent()) return { stale: true };
  return { stale: false, result };
}

export function isValidOfferParentId(value: string | null | undefined): value is string {
  return isRealOfferParentId(value);
}

function draftCandidate(draft: Draft): unknown {
  const numeric = (value: string) => value.trim() === "" ? Number.NaN : Number(value);
  return {
    ...draft,
    price: numeric(draft.price),
    offerDuration: numeric(draft.offerDuration),
    estimatedSavings: numeric(draft.estimatedSavings),
    redemptionType: numeric(draft.redemptionType),
    redemptionLimit: draft.redemptionLimit.trim() === "" ? null : numeric(draft.redemptionLimit),
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function OptionChecks({ title, options, selected, onChange, disabled, id, error }: {
  title: string; options: QaOption[]; selected: number[]; onChange: (ids: number[]) => void; disabled: boolean; id: string; error?: React.ReactNode;
}) {
  return <fieldset className="rounded-md border border-slate-200 p-3">
    <legend className="px-1 text-sm font-medium text-slate-800">{title}</legend>
    {options.length ? <div className="mt-1 grid gap-2 sm:grid-cols-2">
      {options.map((option) => <label key={option.id} className="flex items-start gap-2 text-sm text-slate-700">
        <input id={`${id}-${option.id}`} type="checkbox" className="mt-1 accent-amber-700" checked={selected.includes(option.id)} disabled={disabled}
          onChange={(event) => onChange(event.target.checked ? [...selected, option.id] : selected.filter((value) => value !== option.id))} />
        <span>{option.name}</span>
      </label>)}
    </div> : <p className="mt-1 text-xs text-slate-500">No options are available.</p>}{error}
  </fieldset>;
}

type Props = {
  environmentLabel?: string;
  requestId: string;
  locked?: boolean;
  onSaved?: () => void | Promise<void>;
  onUploadStateChange?: (scope: object, pending: boolean) => void;
  onDraftStateChange?: (scope: object, dirty: boolean) => void;
};

export type OfferQaDetailsFormHandle = { prepareForCreate: () => Promise<boolean> };
type OfferQaDetailsExtendedResponse = OfferQaDetailsResponse & {
  sourceImages?: string[];
  preparationIssues?: string[];
  optionsIssue?: string | null;
  sourceValues?: { price?: string; duration?: string; redemption?: string; branches?: string[] };
};

const OfferQaDetailsEditor = forwardRef<OfferQaDetailsFormHandle, Props>(function OfferQaDetailsEditor({ requestId, locked = false, onSaved, onUploadStateChange, onDraftStateChange, environmentLabel = "QA" }, ref) {
  const formId = useId();
  const idFor = (field: string) => `${formId}-${field}`;
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => createEmptyOfferQaDraft());
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [uploadsPending, setUploadsPending] = useState(false);
  const [useSourceImages, setUseSourceImages] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const sourceSelectionTouched = useRef(false);
  const uploadScope = useRef<object>({});
  const dirtyScope = useRef<object>({});
  const callbacks = useRef({ onUploadStateChange, onDraftStateChange });
  callbacks.current = { onUploadStateChange, onDraftStateChange };
  const baseline = useRef("");
  const currentRequestId = useRef(requestId);
  const mounted = useRef(false);
  const saveController = useRef<AbortController | null>(null);
  const refreshOptionsRequested = useRef(false);
  currentRequestId.current = requestId;

  const detailsQuery = useQuery<OfferQaDetailsResponse>({
    queryKey: detailsKey(requestId), enabled: !!requestId, retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/deal-requests/${encodeURIComponent(requestId)}/qa-details`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "You are not authorized to view offer QA details." : "Unable to load offer QA details.");
      return response.json();
    },
  });
  const optionsQuery = useQuery<OfferQaOptions>({
    queryKey: optionsKey(requestId), enabled: !!requestId, retry: false,
    queryFn: async () => {
      const refresh = refreshOptionsRequested.current;
      refreshOptionsRequested.current = false;
      const response = await fetch(`/api/deal-requests/${encodeURIComponent(requestId)}/qa-options${refresh ? "?refresh=1" : ""}`, { credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(response.status === 403 ? "You are not authorized to load offer QA options." : "Unable to load offer categories, types, rules, and branches.");
      return result as OfferQaOptions;
    },
  });

  useEffect(() => {
    mounted.current = true;
    setSaving(false);
    return () => {
      mounted.current = false;
      saveController.current?.abort();
      saveController.current = null;
    };
  }, [requestId]);

  useEffect(() => {
    const response = detailsQuery.data;
    if (!response || currentRequestId.current !== requestId) {
      currentRequestId.current = requestId;
      setInitialized(false);
      return;
    }
    if (initialized || optionsQuery.isLoading) return;
    const next = createEmptyOfferQaDraft(response);
    setDraft(next);
    setUseSourceImages(!response.details && !!(response as OfferQaDetailsResponse & { sourceImages?: string[] }).sourceImages?.length);
    sourceSelectionTouched.current = false;
    baseline.current = JSON.stringify(next);
    setInitialized(true);
    callbacks.current.onDraftStateChange?.(dirtyScope.current, false);
  }, [detailsQuery.data, initialized, optionsQuery.isLoading, requestId]);

  const readOnly = locked || detailsQuery.data?.editable === false;
  const parentId = detailsQuery.data?.merchantProfileId;
  const savedParentMismatch = !!detailsQuery.data?.details && detailsQuery.data.details.parentMerchantProfileId !== parentId;
  const draftParentMismatch = initialized && isValidOfferParentId(parentId) && draft.parentMerchantProfileId !== parentId;
  const parentValid = isValidOfferParentId(parentId) && draft.parentMerchantProfileId === parentId;
  const options = optionsQuery.data;
  const optionsMatchParent = !!options && options.merchantProfileId === parentId;
  const branchReady = !!options && optionsMatchParent && !options.branchIssue && options.branches.length > 0;
  const dirty = useMemo(() => initialized && (JSON.stringify(draft) !== baseline.current || sourceSelectionTouched.current), [draft, initialized, useSourceImages]);
  useEffect(() => {
    callbacks.current.onDraftStateChange?.(dirtyScope.current, dirty);
  }, [dirty]);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSavedNotice(false);
  };
  const reportUploadPending = useCallback((pending: boolean) => {
    setUploadsPending(pending);
    callbacks.current.onUploadStateChange?.(uploadScope.current, pending);
  }, []);
  const reloadOptions = (refreshPrefill = true) => {
    refreshOptionsRequested.current = true;
    const untouched = refreshPrefill && !dirty && !sourceSelectionTouched.current;
    return optionsQuery.refetch().then(async () => {
      if (!refreshPrefill) return;
      const refreshed = await detailsQuery.refetch();
      if (untouched && refreshed.data && currentRequestId.current === requestId) {
        const next = createEmptyOfferQaDraft(refreshed.data);
        setDraft(next);
        setUseSourceImages(!refreshed.data.details && !!(refreshed.data as OfferQaDetailsResponse & { sourceImages?: string[] }).sourceImages?.length);
        baseline.current = JSON.stringify(next);
      }
      return refreshed;
    });
  };
  const reviewForCurrentParent = async () => {
    if (!isValidOfferParentId(parentId) || readOnly || saving || uploadsPending || optionsQuery.isFetching) return;
    update(rebindOfferQaDraft(draft, parentId));
    setValidationErrors({});
    setServerErrors([]);
    setSaveError("");
    setSavedNotice(false);
    await reloadOptions(false);
  };
  useEffect(() => () => {
    callbacks.current.onUploadStateChange?.(uploadScope.current, false);
    callbacks.current.onDraftStateChange?.(dirtyScope.current, false);
  }, []);

  const categoryOptions = options?.categories ?? [];
  const availableSubcategories = categoryOptions.filter((category) => draft.categoryIds.includes(category.id)).flatMap((category) => category.subCategories);
  const optionsHaveSavedBranchIds = !options || draft.branchIds.every((id) => options.branches.some((branch) => branch.id === id));
  const selectionIssues = options && optionsMatchParent ? offerQaSelectionIssues(draft, options) : [];
  const mappingsValid = !!options && optionsMatchParent && selectionIssues.length === 0;
  const saveBlockers = offerQaSaveBlockers({
    initialized, locked, editable: detailsQuery.data?.editable === true,
    editBlockedReason: detailsQuery.data?.editBlockedReason, saving, uploadsPending,
    parentId, draft, options, optionsLoading: optionsQuery.isLoading, optionsFetching: optionsQuery.isFetching,
    optionsError: optionsQuery.isError, hasSavedDetails: !!detailsQuery.data?.details, dirty,
  });

  const validateCurrentDraft = () => {
    const candidate = draftCandidate(draft) as Record<string, unknown>;
    const parsed = (useSourceImages ? offerQaPreparationDetailsSchema : offerQaDetailsSchema).safeParse(candidate);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path.join(".");
        const missingNumberMessages: Record<string, string> = {
          price: "Enter a price using digits, for example 0 or 24.50.",
          offerDuration: "Choose Monthly Offer or Yearly Offer, or retain the displayed legacy code.",
          estimatedSavings: "Enter estimated savings using digits; use 0 when there are no savings.",
          redemptionType: "Choose Unlimited or Limited, or retain the displayed legacy code.",
          redemptionLimit: "Enter a whole-number redemption count, or leave it blank.",
        };
        if (key && !errors[key]) errors[key] = issue.message.toLowerCase().includes("nan") && missingNumberMessages[key]
          ? missingNumberMessages[key] : issue.message;
      });
      setValidationErrors(errors);
      setSaveError("Review the highlighted fields before continuing.");
      const firstField = Object.keys(errors)[0];
      const focusIds: Record<string, string> = {
        categoryIds: "mapping-heading", subCategoryIds: "mapping-heading",
        offerTypeId: "offer-type", branchIds: "mapping-heading",
        claimRuleIds: "mapping-heading", paymentConditionIds: "mapping-heading",
        images: "images-heading",
        price: "offer-price", offerDuration: "offer-duration", estimatedSavings: "offer-savings",
        redemptionType: "offer-redemption-type", redemptionLimit: "offer-redemption-limit",
      };
      const target = firstField ? document.getElementById(idFor(focusIds[firstField] ?? `offer-${firstField.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`)) : null;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) target.focus?.({ preventScroll: true });
      return null;
    }
    if (!useSourceImages && parsed.data.images.length === 0) {
      setValidationErrors({ images: "Choose at least one offer image." });
      setSaveError("Review the highlighted fields before continuing.");
      return null;
    }
    setValidationErrors({});
    setSaveError("");
    return parsed.data;
  };

  const prepareForCreate = async () => {
    if (!initialized || readOnly || !detailsQuery.data?.editable || saving || preparing || uploadsPending || optionsQuery.isLoading || optionsQuery.isFetching || optionsQuery.isError || !optionsMatchParent || !mappingsValid || !parentValid) return false;
    const parsed = validateCurrentDraft();
    if (!parsed) return false;
    setPreparing(true);
    const controller = new AbortController();
    saveController.current = controller;
    const isCurrent = () => mounted.current && currentRequestId.current === requestId && !controller.signal.aborted;
    try {
      const response = await fetch(`/api/deal-requests/${encodeURIComponent(requestId)}/qa-prepare`, {
        method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details: { ...parsed, images: draft.images }, useSourceImages }), signal: controller.signal,
      });
      const result = await response.json().catch(() => null);
      if (!isCurrent()) return false;
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Offer setup could not be prepared.");
      const confirmed = result as OfferQaDetailsResponse;
      const valid = offerQaDetailsSchema.safeParse(confirmed?.details);
      if (!valid.success || confirmed.merchantProfileId !== valid.data.parentMerchantProfileId || confirmed.editable !== true) {
        throw new Error("Prepared offer details could not be confirmed. Review and retry.");
      }
      const saved: OfferQaDetailsExtendedResponse = { ...confirmed, details: valid.data, prefill: valid.data };
      queryClient.setQueryData(detailsKey(requestId), saved);
      const next = createEmptyOfferQaDraft(saved);
      setDraft(next);
      setUseSourceImages(false);
      sourceSelectionTouched.current = false;
      baseline.current = JSON.stringify(next);
      callbacks.current.onDraftStateChange?.(dirtyScope.current, false);
      return true;
    } catch (error) {
      if (isCurrent()) {
        setSaveError(errorMessage(error, "Offer setup could not be prepared."));
        return false;
      }
      return false;
    } finally {
      if (saveController.current === controller) saveController.current = null;
      if (isCurrent()) setPreparing(false);
    }
  };
  useImperativeHandle(ref, () => ({ prepareForCreate }), [draft, useSourceImages, initialized, readOnly, saving, preparing, uploadsPending, optionsQuery.isLoading, optionsQuery.isFetching, optionsQuery.isError, optionsMatchParent, mappingsValid, parentValid]);

  const save = async () => {
    if (saveBlockers.length || !detailsQuery.data) return;
    setSaveError("");
    setServerErrors([]);
    setSavedNotice(false);
    const parsed = validateCurrentDraft();
    if (!parsed) return;
    setSaving(true);
    const controller = new AbortController();
    saveController.current = controller;
    const isCurrent = () => mounted.current && currentRequestId.current === requestId && !controller.signal.aborted;
    try {
      const response = await fetch(`/api/deal-requests/${encodeURIComponent(requestId)}/${useSourceImages ? "qa-prepare" : "qa-details"}`, {
        method: useSourceImages ? "POST" : "PUT", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useSourceImages ? { details: { ...parsed, images: draft.images }, useSourceImages: true } : parsed), signal: controller.signal,
      });
      if (!isCurrent()) return;
      const parsedResponse = await readOfferQaSaveResponse(response, isCurrent);
      if (!isCurrent() || parsedResponse.stale) return;
      const result = parsedResponse.result && typeof parsedResponse.result === "object"
        ? parsedResponse.result as Record<string, unknown>
        : null;
      if (!response.ok) {
        if (response.status === 409) {
          await detailsQuery.refetch();
          throw new Error("The offer status or merchant link changed. Review the current offer details before saving.");
        }
        if (response.status === 400 && Array.isArray(result?.fields)) {
          setServerErrors(result.fields.slice(0, 12).flatMap((item: unknown) => {
            if (!item || typeof item !== "object") return [];
            const field = "field" in item && typeof item.field === "string" ? item.field : "Offer setup";
            const message = "message" in item && typeof item.message === "string" ? item.message : "";
            return message ? [`${field}: ${message}`] : [];
          }));
          return;
        }
        if (response.status === 400 && typeof result?.error === "string") {
          setServerErrors([result.error]);
          // A changed taxonomy or branch list may explain the rejected mapping.
          await reloadOptions();
          return;
        }
        throw new Error(response.status === 403 ? "You are not authorized to save offer QA details." : "Offer QA details were not saved. Review the fields and retry.");
      }
      const savedDetails = offerQaDetailsSchema.safeParse(result?.details);
      if (!savedDetails.success || typeof result?.offerTitle !== "string"
        || typeof result.editable !== "boolean"
        || result.merchantProfileId !== savedDetails.data.parentMerchantProfileId
        || !Array.isArray(result.issues) || result.issues.some((issue) => typeof issue !== "string")) {
        throw new Error("The saved QA details could not be confirmed. Reload this offer before trying again.");
      }
      const saved: OfferQaDetailsExtendedResponse = {
        ...(result as unknown as OfferQaDetailsExtendedResponse),
        details: savedDetails.data, prefill: savedDetails.data,
        offerTitle: result.offerTitle, merchantProfileId: savedDetails.data.parentMerchantProfileId,
        editable: result.editable, issues: result.issues,
        editBlockedReason: typeof result.editBlockedReason === "string" ? result.editBlockedReason : null,
      };
      if (!isCurrent()) return;
      queryClient.setQueryData(detailsKey(requestId), saved);
      const next = createEmptyOfferQaDraft(saved);
      setDraft(next);
      setUseSourceImages(false);
      sourceSelectionTouched.current = false;
      baseline.current = JSON.stringify(next);
      callbacks.current.onDraftStateChange?.(dirtyScope.current, false);
      await queryClient.invalidateQueries({ queryKey: detailsKey(requestId) });
      if (!isCurrent()) return;
      await queryClient.invalidateQueries({ queryKey: ["backoffice", "offer", requestId] });
      if (!isCurrent()) return;
      await queryClient.invalidateQueries({ queryKey: ["backoffice"] });
      if (!isCurrent()) return;
      await onSaved?.();
      if (!isCurrent()) return;
      setSavedNotice(true);
    } catch (error) {
      if (isCurrent()) {
        setSaveError(errorMessage(error, "Offer QA details were not saved. Retry."));
      }
    } finally {
      if (saveController.current === controller) saveController.current = null;
      if (isCurrent()) setSaving(false);
    }
  };

  if (detailsQuery.isLoading) return <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Loading offer QA details">
    <div className="mb-3 h-4 w-52 animate-pulse rounded bg-slate-200" /><div className="space-y-2"><div className="h-3 w-full animate-pulse rounded bg-slate-100" /><div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" /></div>
  </section>;
  if (detailsQuery.isError || !detailsQuery.data) return <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4" aria-label="Offer QA details unavailable">
    <div className="flex items-start gap-2 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><h4 className="font-semibold">Offer QA details could not be loaded</h4><p className="mt-1">{errorMessage(detailsQuery.error, "Check your connection, then retry.")}</p></div></div>
    <Button type="button" className="mt-3" size="sm" variant="outline" onClick={() => detailsQuery.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Retry loading details</Button>
  </section>;

  const fieldError = (path: string) => validationErrors[path] ? <span className="mt-1 block text-xs text-red-700" id={idFor(`offer-error-${path}`)}>{validationErrors[path]}</span> : null;
  const fieldAttrs = (path: string) => validationErrors[path] ? { "aria-invalid": true as const, "aria-describedby": idFor(`offer-error-${path}`) } : {};

  return <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby={idFor("offer-qa-details-title")}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><h4 id={idFor("offer-qa-details-title")} className="text-base font-semibold text-slate-900">Offer {environmentLabel} setup</h4>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Prepare the merchant’s actual deal values for {environmentLabel}. Verified source matches are prefilled; unresolved mappings stay blank. Saving stores setup here and does not create an offer.</p></div>
      {readOnly && <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Read only</span>}
    </div>
    {!!detailsQuery.data.issues.length && <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
      <p className="font-semibold">Source mapping needs operator review</p><ul className="mt-1 list-inside list-disc space-y-1">{detailsQuery.data.issues.map((issue, i) => <li key={`${i}-${issue}`}>{issue}</li>)}</ul>
    </div>}
    {!!(detailsQuery.data as OfferQaDetailsExtendedResponse).preparationIssues?.length && <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
      <p className="font-semibold">{environmentLabel} values needing confirmation</p>
      <ul className="mt-1 list-inside list-disc space-y-1">{(detailsQuery.data as OfferQaDetailsExtendedResponse).preparationIssues?.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>
    </div>}
    {(detailsQuery.data as OfferQaDetailsExtendedResponse).optionsIssue && <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">{(detailsQuery.data as OfferQaDetailsExtendedResponse).optionsIssue}</p>}
    {!detailsQuery.data.editable && !locked && <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">Editing is unavailable for this offer’s current status or because its backoffice link is uncertain.</p>}
    {!isValidOfferParentId(parentId) && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">A real numeric merchant profile ID could not be confirmed for this offer. Setup cannot be saved and this offer cannot be created. A simulated or missing merchant ID is not valid.</p>}
    {draftParentMismatch && <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
      <p>The draft belongs to merchant profile {draft.parentMerchantProfileId || "not yet linked"}, while the source now resolves to {parentId}. Existing offer values are retained, but review the current merchant and select its branches before saving.</p>
      <Button type="button" className="mt-2" size="sm" variant="outline" disabled={!isValidOfferParentId(parentId) || readOnly || saving || uploadsPending || optionsQuery.isFetching} onClick={reviewForCurrentParent}>
        {optionsQuery.isFetching ? "Reloading merchant options…" : "Review for current merchant and reload options"}
      </Button>
    </div>}
    {savedParentMismatch && parentValid && <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">This draft has been rebound to the current merchant profile. Choose a current branch and save to replace the stale saved binding. Offer creation remains blocked until that save completes.</p>}
    {optionsQuery.isLoading && <div className="mt-4 h-8 w-64 animate-pulse rounded bg-slate-100" aria-label="Loading offer QA options" />}
    {optionsQuery.isError && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p>{errorMessage(optionsQuery.error, "QA options are unavailable.")}</p></div>}
    {options && optionsMatchParent && options.branchIssue && <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">{options.branchIssue} Only verified merchant branch options can be selected; profile branch IDs are not interchangeable.</p>}
    {options && !optionsMatchParent && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">Offer options belong to a different merchant profile. Saving is blocked to prevent incorrect mappings.</p>}
    {optionsMatchParent && !mappingsValid && <ul className="mt-3 list-inside list-disc rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="alert">{selectionIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
    {isValidOfferParentId(parentId) && !readOnly && <Button type="button" className="mt-3" size="sm" variant="outline"
      disabled={saving || uploadsPending || optionsQuery.isFetching} onClick={() => reloadOptions()}>
      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />{optionsQuery.isFetching ? "Reloading QA options and branches…" : "Reload QA options and branches"}
    </Button>}
    {options && optionsMatchParent && selectionIssues.length > 0 && !readOnly && <Button type="button" className="ml-2 mt-3" size="sm" variant="outline"
      disabled={saving || uploadsPending || optionsQuery.isFetching}
      onClick={() => update(clearUnavailableOfferQaSelections(draft, options))}>Clear unavailable selections</Button>}

    <fieldset disabled={readOnly || saving || preparing || uploadsPending} className="mt-5 space-y-6">
      <legend className="sr-only">Offer details for QA</legend>
      <section aria-labelledby={idFor("offer-copy-heading")}>
        <h5 id={idFor("offer-copy-heading")} className="text-sm font-semibold text-slate-900">Offer copy</h5>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className={labelClass} htmlFor={idFor("offer-title")}>Title
            <input id={idFor("offer-title")} className={inputClass} value={draft.title} onChange={(e) => update({ title: e.target.value })} {...fieldAttrs("title")} />{fieldError("title")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-title-ar")}>Arabic title <span className="font-normal text-slate-500">optional</span>
            <input id={idFor("offer-title-ar")} dir="rtl" className={inputClass} value={draft.titleAr} onChange={(e) => update({ titleAr: e.target.value })} {...fieldAttrs("titleAr")} />{fieldError("titleAr")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-description")}>Description
            <textarea id={idFor("offer-description")} rows={4} className={inputClass} value={draft.description} onChange={(e) => update({ description: e.target.value })} {...fieldAttrs("description")} />{fieldError("description")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-description-ar")}>Arabic description <span className="font-normal text-slate-500">optional</span>
            <textarea id={idFor("offer-description-ar")} dir="rtl" rows={4} className={inputClass} value={draft.descriptionAr} onChange={(e) => update({ descriptionAr: e.target.value })} {...fieldAttrs("descriptionAr")} />{fieldError("descriptionAr")}
          </label>
          <label className={`${labelClass} sm:col-span-2`} htmlFor={idFor("offer-terms")}>Terms and conditions
            <textarea id={idFor("offer-terms")} rows={4} className={inputClass} value={draft.termsAndConditions} onChange={(e) => update({ termsAndConditions: e.target.value })} {...fieldAttrs("termsAndConditions")} />{fieldError("termsAndConditions")}
          </label>
        </div>
      </section>

      <section aria-labelledby={idFor("mapping-heading")}>
        <h5 id={idFor("mapping-heading")} tabIndex={-1} className="text-sm font-semibold text-slate-900">Confirmed {environmentLabel} mappings</h5>
        <p className="mt-1 text-xs text-slate-500">Choose IDs from loaded options only. Category selection controls available subcategories.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <fieldset className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">Categories</legend>
            <div className="mt-1 grid gap-2">
              {categoryOptions.map((category) => <label key={category.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-amber-700" checked={draft.categoryIds.includes(category.id)} disabled={readOnly || saving || uploadsPending || !optionsMatchParent}
                  onChange={(e) => {
                    const nextIds = e.target.checked ? [...draft.categoryIds, category.id] : draft.categoryIds.filter((id) => id !== category.id);
                    const allowed = categoryOptions.filter((entry) => nextIds.includes(entry.id)).flatMap((entry) => entry.subCategories.map((sub) => sub.id));
                    update({ categoryIds: nextIds, subCategoryIds: draft.subCategoryIds.filter((id) => allowed.includes(id)) });
                  }} />{category.name}
              </label>)}
            </div>{fieldError("categoryIds")}
            {!categoryOptions.length && <p className="mt-1 text-xs text-slate-500">No categories loaded.</p>}
          </fieldset>
          <OptionChecks title="Subcategories" id={idFor("offer-subcategory")} options={availableSubcategories} selected={draft.subCategoryIds} error={fieldError("subCategoryIds")}
            disabled={readOnly || saving || uploadsPending || !optionsMatchParent} onChange={(subCategoryIds) => update({ subCategoryIds })} />
          <label className={labelClass} htmlFor={idFor("offer-type")}>Offer type
            <select id={idFor("offer-type")} className={inputClass} value={draft.offerTypeId ?? ""} disabled={readOnly || saving || uploadsPending || !optionsMatchParent} onChange={(e) => update({ offerTypeId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Choose confirmed offer type</option>{(options?.offerTypes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>{fieldError("offerTypeId")}
          </label>
          <fieldset className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">Branches</legend>
            {branchReady ? <div className="mt-1 grid gap-2 sm:grid-cols-2">{(options?.branches ?? []).map((branch) => <label key={branch.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="accent-amber-700" checked={draft.branchIds.includes(branch.id)} disabled={readOnly || saving || uploadsPending} onChange={(e) => update({ branchIds: e.target.checked ? [...draft.branchIds, branch.id] : draft.branchIds.filter((id) => id !== branch.id) })} />{branch.name}
            </label>)}</div> : optionsQuery.isLoading || optionsQuery.isFetching
              ? <p className="mt-1 text-xs text-slate-600">Merchant branch options are loading.</p>
              : optionsQuery.isError
                ? <p className="mt-1 text-xs text-slate-600">Merchant branch options could not be verified. Retry loading QA options.</p>
                : optionsMatchParent && !options?.branchIssue && options?.branches.length === 0
                  ? <p className="mt-1 text-xs text-slate-600">The confirmed merchant has no selectable branches.</p>
                  : <p className="mt-1 text-xs text-slate-600">No verified merchant branch links are available to select.</p>}
            {(detailsQuery.data as OfferQaDetailsExtendedResponse).sourceValues?.branches?.length ? <div className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-700">
              <span className="font-medium">Submitted branch names:</span> {(detailsQuery.data as OfferQaDetailsExtendedResponse).sourceValues?.branches?.join(", ")}
              <span className="mt-1 block text-slate-500">Names are shown for reference only; select a branch only when it appears in the verified merchant options.</span>
            </div> : null}
            {fieldError("branchIds")}
            {!optionsHaveSavedBranchIds && <p className="mt-2 text-xs text-amber-800">A saved branch mapping is absent from current options. Select an available branch before saving.</p>}
          </fieldset>
          <OptionChecks title="Claim rules" id={idFor("offer-claim-rule")} options={options?.claimRules ?? []} selected={draft.claimRuleIds}
            disabled={readOnly || saving || uploadsPending || !optionsMatchParent} onChange={(claimRuleIds) => update({ claimRuleIds })} />
          <OptionChecks title="Payment conditions" id={idFor("offer-payment-condition")} options={options?.paymentConditions ?? []} selected={draft.paymentConditionIds}
            disabled={readOnly || saving || uploadsPending || !optionsMatchParent} onChange={(paymentConditionIds) => update({ paymentConditionIds })} />
          <p className="text-xs text-slate-500 sm:col-span-2">Claim rules and payment conditions may be intentionally empty. Submitted rule text is matched only to an exact verified QA option label.</p>
        </div>
      </section>

      <section aria-labelledby={idFor("offer-values-heading")}>
        <h5 id={idFor("offer-values-heading")} className="text-sm font-semibold text-slate-900">Price, validity and redemption</h5>
        <p className="mt-1 text-xs text-slate-500">Choose the QA offer duration that matches the submitted deal. Source values remain available below for reference.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass} htmlFor={idFor("offer-price")}>Price
            <input id={idFor("offer-price")} type="number" min="0" step="any" inputMode="decimal" className={inputClass} value={draft.price} onChange={(e) => update({ price: e.target.value })} {...fieldAttrs("price")} />{fieldError("price")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-duration")}>Offer duration
            <select id={idFor("offer-duration")} className={inputClass} value={draft.offerDuration} onChange={(e) => update({ offerDuration: e.target.value })} {...fieldAttrs("offerDuration")}>
              <option value="">Choose an offer duration</option>
              <option value={qaOfferDurations.monthly}>Monthly Offer</option>
              <option value={qaOfferDurations.yearly}>Yearly Offer</option>
              {draft.offerDuration !== "" && ![String(qaOfferDurations.monthly), String(qaOfferDurations.yearly)].includes(draft.offerDuration)
                && /^\d+$/.test(draft.offerDuration)
                && Number(draft.offerDuration) > 0
                && <option value={draft.offerDuration}>Legacy code {draft.offerDuration} (retained)</option>}
            </select>{fieldError("offerDuration")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-savings")}>Estimated savings
            <input id={idFor("offer-savings")} type="number" min="0" step="any" inputMode="decimal" className={inputClass} value={draft.estimatedSavings} onChange={(e) => update({ estimatedSavings: e.target.value })} {...fieldAttrs("estimatedSavings")} />{fieldError("estimatedSavings")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-redemption-type")}>Redemption type
            <select id={idFor("offer-redemption-type")} className={inputClass} value={draft.redemptionType} onChange={(e) => {
              const redemptionType = e.target.value;
              update({ redemptionType, ...(redemptionType === "1" ? { redemptionLimit: "" } : {}) });
            }} {...fieldAttrs("redemptionType")}>
              <option value="">Choose redemption type</option>
              <option value="1">Unlimited</option>
              <option value="2">Limited</option>
              {!["1", "2", "0"].includes(draft.redemptionType) && <option value="0">Legacy code 0 (retained)</option>}
              {draft.redemptionType !== "" && !["1", "2"].includes(draft.redemptionType)
                && /^\d+$/.test(draft.redemptionType)
                && <option value={draft.redemptionType}>Legacy code {draft.redemptionType} (retained)</option>}
            </select>{fieldError("redemptionType")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-redemption-limit")}>Redemption limit <span className="font-normal text-slate-500">optional count</span>
            <input id={idFor("offer-redemption-limit")} type="number" min="0" step="1" inputMode="numeric" className={inputClass} placeholder="No limit specified" value={draft.redemptionLimit} onChange={(e) => update({ redemptionLimit: e.target.value })} {...fieldAttrs("redemptionLimit")} />{fieldError("redemptionLimit")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-start-date")}>Start date
            <input id={idFor("offer-start-date")} type="date" className={inputClass} value={draft.startDate} onChange={(e) => update({ startDate: e.target.value })} {...fieldAttrs("startDate")} />{fieldError("startDate")}
          </label>
          <label className={labelClass} htmlFor={idFor("offer-end-date")}>End date
            <input id={idFor("offer-end-date")} type="date" className={inputClass} value={draft.endDate} onChange={(e) => update({ endDate: e.target.value })} {...fieldAttrs("endDate")} />{fieldError("endDate")}
          </label>
        </div>
      </section>
      {(detailsQuery.data as OfferQaDetailsExtendedResponse).sourceValues && <section className="rounded-md border border-slate-200 bg-slate-50 p-3" aria-label="Submitted deal values">
        <h5 className="text-sm font-semibold text-slate-900">Submitted values — reference only</h5>
        <p className="mt-1 text-xs text-slate-600">Submitted values are shown for reference; confirm the QA offer duration against the source before saving.</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {(["price", "duration", "redemption"] as const).map((key) => <div key={key}>
            <dt className="text-xs font-medium capitalize text-slate-500">{key === "duration" ? "Duration" : key}</dt>
            <dd className="mt-0.5 text-slate-800">{(detailsQuery.data as OfferQaDetailsExtendedResponse).sourceValues?.[key] || "Not provided"}</dd>
          </div>)}
        </dl>
      </section>}
      {!!(detailsQuery.data as OfferQaDetailsExtendedResponse).sourceImages?.length && <section className="rounded-md border border-slate-200 bg-slate-50 p-3" aria-label="Submitted deal images">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h5 className="text-sm font-semibold text-slate-900">Submitted deal images</h5>
            <p className="mt-1 text-xs text-slate-600">The original submission stays on file. Include it to reuse the source images without uploading them again.</p></div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input type="checkbox" className="accent-amber-700" checked={useSourceImages} disabled={readOnly || saving || preparing || uploadsPending}
            onChange={(event) => { sourceSelectionTouched.current = true; setUseSourceImages(event.target.checked); setSavedNotice(false); }} />
            Include source images
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{(detailsQuery.data as OfferQaDetailsExtendedResponse).sourceImages?.map((image, index) =>
          <div key={`${index}-${image}`} className="w-24">
            <img src={image.startsWith("qa/") ? `https://qlrstorageqa.blob.core.windows.net/ad-images/${image}` : image} alt={`Submitted deal image ${index + 1}`} className="h-20 w-24 rounded border border-slate-200 bg-white object-cover" />
            <span className="mt-1 block truncate text-[10px] text-slate-500" title={image}>{image}</span>
          </div>)}</div>
      </section>}
      <div>
        <h5 id={idFor("images-heading")} tabIndex={-1} className="mb-2 text-sm font-semibold text-slate-900">Prepared QA images</h5>
        {draft.images.length > 0 && <ul className="mb-2 space-y-1 text-xs text-slate-600" aria-label="Existing prepared images">
          {draft.images.map((image) => <li key={image} className="truncate" title={image}>{image}</li>)}
        </ul>}
        <OfferQaImages requestId={requestId} images={draft.images} disabled={readOnly || saving || preparing} onChange={(images) => update({ images })} onPendingChange={reportUploadPending} />
      </div>
      {fieldError("images")}
    </fieldset>

    {(saveError || serverErrors.length > 0) && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
      {saveError && <p>{saveError}</p>}{serverErrors.length > 0 && <ul className="list-inside list-disc">{serverErrors.map((error, i) => <li key={`${i}-${error}`}>{error}</li>)}</ul>}
    </div>}
    {savedNotice && <p className="mt-3 text-sm text-emerald-800" role="status"><CheckCircle2 className="mr-1.5 inline h-4 w-4" />Offer QA details saved.</p>}
    {saveBlockers.length > 0 && <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" aria-label="Why offer setup cannot be saved">
      <p className="font-semibold">Save is unavailable</p>
      <ul className="mt-1 list-inside list-disc">{saveBlockers.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </div>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-xs text-slate-500">{dirty ? "Unsaved edits are kept in this draft. Create deal prepares and confirms them before creation." : "Save offer setup remains available separately from deal creation."}</p>
      <Button type="button" onClick={save} disabled={saveBlockers.length > 0 || preparing}>
        <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : uploadsPending ? "Wait for image upload" : "Save offer setup"}
      </Button>
    </div>
  </section>;
});

// A route change must start fresh state even if a caller does not supply a key.
const OfferQaDetailsForm = forwardRef<OfferQaDetailsFormHandle, Props>(function OfferQaDetailsForm(props, ref) {
  return <OfferQaDetailsEditor key={props.requestId} {...props} ref={ref} />;
});
export default OfferQaDetailsForm;
