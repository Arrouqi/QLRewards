import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { BackofficeState } from "@shared/backoffice";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import MerchantQaDetailsForm from "@/components/MerchantQaDetailsForm";
import type { MerchantQaDetailsResponse } from "@shared/merchantQaDetails";
import OfferQaDetailsForm, { isValidOfferParentId, type OfferQaDetailsFormHandle } from "@/components/OfferQaDetailsForm";
import type { OfferQaDetailsResponse } from "@shared/offerQaDetails";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BackofficeActionProps = {
  kind: "merchant" | "offer";
  requestId: string;
  merchantStatus?: string;
  onCreated?: () => void | Promise<void>;
};

type Session = { role?: string };
type BackofficeActionState = BackofficeState & { mappingIssues?: string[] };

const metadataKey = (kind: BackofficeActionProps["kind"], requestId: string) =>
  ["backoffice", kind, requestId] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function BackofficeAction({ kind, requestId, merchantStatus, onCreated }: BackofficeActionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingQaUploadScopes, setPendingQaUploadScopes] = useState<Set<object>>(() => new Set());
  const createLock = useRef(false);
  const offerEditorRef = useRef<OfferQaDetailsFormHandle>(null);
  const activeCreateController = useRef<AbortController | null>(null);
  const currentRequestId = useRef(requestId);
  const mounted = useRef(false);
  currentRequestId.current = requestId;
  useEffect(() => {
    mounted.current = true;
    setIsCreating(false);
    setConfirmOpen(false);
    createLock.current = false;
    return () => {
      mounted.current = false;
      activeCreateController.current?.abort();
      activeCreateController.current = null;
      createLock.current = false;
    };
  }, [requestId]);
  const onQaUploadStateChange = useCallback((scope: object, pending: boolean) => {
    setPendingQaUploadScopes((current) => {
      const next = new Set(current);
      if (pending) next.add(scope);
      else next.delete(scope);
      return next;
    });
  }, []);

  const { data: session, isLoading: sessionLoading } = useQuery<Session>({
    queryKey: ["/api/auth/session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      if (!response.ok) return { role: "user" };
      return response.json();
    },
  });
  const authorized = session?.role === "moderation" || session?.role === "admin";

  const metadataQuery = useQuery<BackofficeActionState>({
    queryKey: metadataKey(kind, requestId),
    enabled: !!requestId && !!authorized,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/${kind === "merchant" ? "merchant-requests" : "deal-requests"}/${encodeURIComponent(requestId)}/backoffice`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || `Unable to load QA backoffice details (${response.status})`);
      }
      return response.json();
    },
  });

  const merchantDetailsQuery = useQuery<MerchantQaDetailsResponse>({
    queryKey: ["merchant-qa-details", requestId],
    enabled: kind === "merchant" && !!requestId && !!authorized,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/merchant-requests/${encodeURIComponent(requestId)}/qa-details`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load merchant QA details.");
      return response.json();
    },
  });

  const offerDetailsQuery = useQuery<OfferQaDetailsResponse>({
    queryKey: ["offer-qa-details", requestId],
    enabled: kind === "offer" && !!requestId && !!authorized,
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/deal-requests/${encodeURIComponent(requestId)}/qa-details`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load offer QA details.");
      return response.json();
    },
  });

  if (sessionLoading || !authorized) return null;

  const state = metadataQuery.data;
  if (kind === "merchant" && state && state.status !== "moderation") return null;
  if (kind === "offer" && (merchantStatus !== undefined
    ? merchantStatus !== "moderation"
    : !state || !["approved", "moderation"].includes(state.status))) return null;
  const recordId = kind === "merchant" ? state?.backofficeMerchantId : state?.backofficeOfferId;
  const canOfferCreate = kind !== "offer" || !!state?.backofficeMerchantId;
  const canCreateAction =
    kind === "merchant"
      ? state?.status === "moderation" && !state?.backofficeMerchantId
      : !state?.backofficeOfferId;
  const merchantDetailsSaved = kind !== "merchant" || (!!merchantDetailsQuery.data?.details && merchantDetailsQuery.data.editable);
  const offerPreparationAllowed = !!offerDetailsQuery.data?.editable
    && isValidOfferParentId(offerDetailsQuery.data.merchantProfileId)
    && (!offerDetailsQuery.data.details || offerDetailsQuery.data.details.parentMerchantProfileId === offerDetailsQuery.data.merchantProfileId);
  const canCreateWithDetails = kind === "merchant" ? merchantDetailsSaved : offerPreparationAllowed;
  const qaUploadPending = pendingQaUploadScopes.size > 0;
  const environmentLabel = state?.environment === "production" ? "Production" : "QA";
  const confirmation = kind === "merchant"
    ? `Create this merchant in the ${environmentLabel} backoffice? The profile will remain In Moderation.`
    : `The current deal draft will be prepared and confirmed before it is created in the ${environmentLabel} backoffice.`;
  const actionLabel = kind === "merchant" ? "Create Merchant" : "Create deal";

  const createRecord = async () => {
    if (!state || !canCreateAction || (kind === "merchant" && !state.canCreate) || !canOfferCreate || !canCreateWithDetails || qaUploadPending || createLock.current) return;
    createLock.current = true;
    setIsCreating(true);
    const isCurrentRequest = () => mounted.current && currentRequestId.current === requestId;
    try {
      if (kind === "offer") {
        const prepared = await offerEditorRef.current?.prepareForCreate();
        if (!isCurrentRequest()) return;
        if (!prepared) {
          setConfirmOpen(false);
          return;
        }
        const readiness = await metadataQuery.refetch();
        if (!isCurrentRequest()) return;
        if (readiness.isError || !readiness.data?.canCreate) {
          setConfirmOpen(false);
          toast({
            title: "Deal setup saved; creation is still blocked",
            description: readiness.data?.blockedReason || "The latest backoffice checks did not confirm that this deal can be created.",
            variant: "destructive",
          });
          return;
        }
      }
      if (!isCurrentRequest()) return;
      const controller = new AbortController();
      activeCreateController.current = controller;
      const response = await fetch(`/api/${kind === "merchant" ? "merchant-requests" : "deal-requests"}/${encodeURIComponent(requestId)}/${kind === "merchant" ? "create-merchant" : "create-offer"}`, {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
      });
      if (!isCurrentRequest()) return;
      const result = await response.json().catch(() => null);
      if (!isCurrentRequest()) return;
      if (!response.ok) {
        throw new Error(result?.error || `Creation failed (${response.status})`);
      }
      toast({
        title: result?.dryRun ? `${kind === "merchant" ? "Merchant" : "Offer"} simulated successfully` : `${kind === "merchant" ? "Merchant" : "Offer"} created in ${environmentLabel} backoffice`,
        description: result?.warnings?.length ? result.warnings.join(" ")
          : result?.dryRun ? "A test ID was saved in this portal. No QA backoffice record was created." : undefined,
      });
      setConfirmOpen(false);
      await metadataQuery.refetch();
      if (!isCurrentRequest()) return;
      await queryClient.invalidateQueries({ queryKey: ["backoffice"] });
      if (!isCurrentRequest()) return;
      await onCreated?.();
    } catch (error) {
      if (!isCurrentRequest() || (error instanceof DOMException && error.name === "AbortError")) return;
      toast({
        title: "Backoffice creation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      // A failed response may still have persisted an attempt/error server-side.
      await metadataQuery.refetch();
    } finally {
      if (isCurrentRequest()) {
        activeCreateController.current = null;
        createLock.current = false;
        setIsCreating(false);
      }
    }
  };

  return (
    <section className="rounded-lg border border-amber-300/80 bg-amber-50/70 p-4" aria-label={`${environmentLabel} backoffice`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{environmentLabel} backoffice</h3>
            <span className="rounded border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {state?.dryRun === false ? `${environmentLabel} · real records will be created` : "Dry run · simulated, not real creation"}
            </span>
          </div>

          {metadataQuery.isLoading ? (
            <div className="mt-3 space-y-2" aria-label="Loading backoffice details">
              <div className="h-3 w-48 animate-pulse rounded bg-amber-200/70" />
              <div className="h-3 w-64 animate-pulse rounded bg-amber-200/70" />
            </div>
          ) : metadataQuery.isError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{metadataQuery.error instanceof Error ? metadataQuery.error.message : "Unable to load backoffice details."}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => metadataQuery.refetch()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : state ? (
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">{kind === "merchant" ? "Backoffice merchant ID" : "Backoffice offer ID"}</dt>
                <dd className="mt-0.5 break-all font-mono text-slate-800">{recordId || "Not created"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last attempt</dt>
                <dd className="mt-0.5 text-slate-800">{formatDate(state.lastBackofficeAttemptAt)}</dd>
              </div>
              {state.lastBackofficeError && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Last error</dt>
                  <dd className="mt-0.5 break-words text-red-800">{state.lastBackofficeError}</dd>
                </div>
              )}
              {state.backofficeCreatedAt && (
                <div>
                  <dt className="text-slate-500">Created</dt>
                  <dd className="mt-0.5 text-slate-800">{formatDate(state.backofficeCreatedAt)}</dd>
                </div>
              )}
            </dl>
          ) : null}
        </div>

        {!metadataQuery.isError && state && canCreateAction && (
          <div className="flex shrink-0 flex-col items-start gap-1.5">
            <span title={kind === "offer" && !canOfferCreate ? "Create the merchant first" : undefined}>
              <Button
                type="button"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={(kind === "merchant" && !state.canCreate) || !canOfferCreate || !canCreateWithDetails || qaUploadPending || isCreating || metadataQuery.isFetching || (kind === "offer" && (offerDetailsQuery.isLoading || offerDetailsQuery.isError))}
                aria-label={actionLabel}
              >
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {actionLabel}
              </Button>
            </span>
            {!canOfferCreate ? (
              <p className="text-xs text-slate-600">Create the merchant first</p>
            ) : !canCreateWithDetails ? (
              <p className="max-w-56 text-xs text-slate-600">{kind === "merchant" ? "Save actual merchant QA details before creating." : offerDetailsQuery.isLoading ? "Loading saved offer setup…" : "Save editable offer QA details with a confirmed merchant profile before creating."}</p>
            ) : qaUploadPending ? (
              <p className="max-w-56 text-xs text-amber-800">Wait for QA image uploads to finish.</p>
            ) : !state.canCreate && state.blockedReason ? (
              <p className="max-w-56 text-xs text-slate-600">{state.blockedReason}</p>
            ) : null}
          </div>
        )}
      </div>

      {state?.blockedReason && (!canCreateAction || canOfferCreate) && (
        <p className="mt-3 border-t border-amber-200 pt-3 text-xs text-slate-600">{state.blockedReason}</p>
      )}
      {!!state?.mappingIssues?.length && (
        <ul className="mt-3 list-inside list-disc border-t border-amber-200 pt-3 text-xs text-amber-950">
          {state.mappingIssues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}
        </ul>
      )}

      {recordId && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-amber-200 pt-3 text-xs text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {state?.dryRun ? "Simulated ID saved — no QA record created" : "QA record linked"}
        </p>
      )}

      {kind === "merchant" && <MerchantQaDetailsForm
        environmentLabel={environmentLabel}
        key={requestId}
        requestId={requestId}
        locked={!!state?.backofficeMerchantId}
        onUploadStateChange={onQaUploadStateChange}
        onSaved={async () => {
          await metadataQuery.refetch();
          await queryClient.invalidateQueries({ queryKey: metadataKey("merchant", requestId) });
        }}
      />}
      {kind === "offer" && <OfferQaDetailsForm
        environmentLabel={environmentLabel}
        key={requestId}
        ref={offerEditorRef}
        requestId={requestId}
        locked={!!state?.backofficeOfferId}
        onUploadStateChange={onQaUploadStateChange}
        onSaved={async () => {
          await offerDetailsQuery.refetch();
          await queryClient.invalidateQueries({ queryKey: metadataKey("offer", requestId) });
        }}
      />}

      <Dialog open={confirmOpen} onOpenChange={(open) => !isCreating && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabel} in {environmentLabel} backoffice</DialogTitle>
            <DialogDescription>{confirmation}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-amber-900">{state?.dryRun
            ? `This is a simulated ${environmentLabel} action. No backoffice record will be created. Merchant profiles remain In Moderation.`
            : `This creates a real record in the ${environmentLabel} backoffice. Check the merchant and deal details before confirming. Do not repeat creation for a record already present there.`}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button type="button" onClick={createRecord} disabled={isCreating || qaUploadPending || (kind === "merchant" && !state?.canCreate) || !canOfferCreate || !canCreateWithDetails || (kind === "offer" && (offerDetailsQuery.isLoading || offerDetailsQuery.isError))}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
