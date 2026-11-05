import type { OfferQaOptions, QaOption } from "@shared/offerQaDetails";
import { qaTokenProvider } from "./auth";
import { BackofficeHttpError } from "./errors";
import { signingBody } from "./uploads";
import { backofficeTarget } from "./environment";

export function isRealQaId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}
class BranchAssociationError extends Error {}

export function createOfferOptionsLoader(tokenProvider = qaTokenProvider, fetchImpl: typeof fetch = fetch, now = Date.now) {
  let filterCache: { data: Omit<OfferQaOptions, "branches" | "branchIssue" | "merchantProfileId">; until: number } | undefined;
  let filterPending: { promise: Promise<NonNullable<typeof filterCache>["data"]>; refresh: boolean } | undefined;
  // Cache the verified profile -> agency -> branches result as one unit. Never
  // cache an association longer than its branch list or key branches by profile
  // while accidentally sending that profile ID to the agency-scoped endpoint.
  const branchCache = new Map<string, { data: QaOption[]; until: number }>();
  const branchPending = new Map<string, { promise: Promise<QaOption[]>; refresh: boolean }>();
  async function get(path: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const token = await tokenProvider.getToken();
      if (!token || /[\r\n]/.test(token)) throw new Error();
      const response = await fetchImpl(`${backofficeTarget.apiOrigin}${path}`, {
        method: "GET", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, platform: "0" },
      });
      if (!response.ok) {
        if (response.status === 401) tokenProvider.invalidate(token);
        await response.body?.cancel();
        throw new Error();
      }
      return await signingBody(response, 1024 * 1024);
    } finally { clearTimeout(timer); }
  }
  function normalize(items: unknown): QaOption[] {
    if (!Array.isArray(items) || items.length > 10000
      || items.some((v) => !Number.isSafeInteger(v?.id) || v.id <= 0 || typeof v.name !== "string" || v.name.length > 1000)) throw new Error();
    if (new Set(items.map((v) => v.id)).size !== items.length) throw new Error();
    return items.map(({ id, name }) => ({ id, name }));
  }
  async function filters(refresh: boolean) {
    if (!refresh && filterCache && filterCache.until > now()) return filterCache.data;
    if (filterPending && (!refresh || filterPending.refresh)) return filterPending.promise;
    const request: NonNullable<typeof filterPending> = {
      refresh, promise: Promise.resolve({ categories: [], offerTypes: [], claimRules: [], paymentConditions: [] }),
    };
    request.promise = (async () => {
      const body = await get("/filters");
      const categories = normalize(body.categories).map((item, index) => ({
        ...item, subCategories: normalize(body.categories[index].subCategories),
      }));
      const data = {
        categories, offerTypes: normalize(body.offerTypes), claimRules: normalize(body.claimRules),
        paymentConditions: normalize(body.paymentConditions),
      };
      if (!categories.length || !data.offerTypes.length) throw new Error();
      if (filterPending === request) filterCache = { data, until: now() + 300_000 };
      return data;
    })().finally(() => { if (filterPending === request) filterPending = undefined; });
    filterPending = request;
    return request.promise;
  }
  async function branches(id: string, refresh: boolean) {
    const cached = branchCache.get(id);
    if (!refresh && cached && cached.until > now()) return cached.data;
    const pending = branchPending.get(id);
    if (pending && (!refresh || pending.refresh)) return pending.promise;
    const request = { refresh, promise: Promise.resolve([] as QaOption[]) };
    request.promise = (async () => {
        let profile;
        try { profile = await get(`/admin/merchant-profiles/${id}`); }
        catch { throw new BranchAssociationError("Unable to verify the linked QA merchant profile. Check QA sign-in and reload options."); }
        if (!profile || !Number.isSafeInteger(profile.merchantProfileId)
          || String(profile.merchantProfileId) !== id) {
          throw new BranchAssociationError("The QA merchant profile identity could not be confirmed. Check the merchant link and reload options.");
        }
        if (!Number.isSafeInteger(profile.agencyId) || profile.agencyId <= 0) {
          throw new BranchAssociationError("The linked QA merchant profile has no valid QA agency association. Check its agency in QA and reload options.");
        }
        const body = await get(`/admin/${profile.agencyId}/branches`);
        let data = normalize(body);
        if (!data.length && Array.isArray(profile.branches)) {
          // The profile's id identifies its branch row, NOT the merchant branch
          // used by offers. Only merchantBranchId may back an offer selection.
          const linked = profile.branches.filter((branch: any) => Number.isSafeInteger(branch?.merchantBranchId) && branch.merchantBranchId > 0);
          if (linked.length) data = normalize(linked.map((branch: any) => ({ id: branch.merchantBranchId, name: branch.name })));
          if (!data.length && profile.branches.length) {
            const names = profile.branches.map((branch: any) => typeof branch?.name === "string" ? branch.name.trim().slice(0, 200) : "").filter(Boolean).slice(0, 10);
            throw new BranchAssociationError(`${names.join(", ") || "The submitted branch"} exists on the QA merchant profile but has no usable offer-branch ID yet. Complete branch linking in QA, then reload options. Do not enter the branch again.`);
          }
        }
        // A superseded request may finish, but must not refill the cache with an
        // old association or remove its replacement's in-flight request.
        if (branchPending.get(id) === request) {
          if (branchCache.size >= 100) branchCache.delete(branchCache.keys().next().value!);
          branchCache.set(id, { data, until: now() + 60_000 });
        }
        return data;
      })().finally(() => { if (branchPending.get(id) === request) branchPending.delete(id); });
    branchPending.set(id, request);
    return request.promise;
  }
  return async (merchantProfileId: string | null, refresh = false): Promise<OfferQaOptions> => {
    if (!isRealQaId(merchantProfileId)) return {
      merchantProfileId: null, categories: [], offerTypes: [], claimRules: [], paymentConditions: [], branches: [],
      branchIssue: "Link a real QA merchant before preparing an offer. A simulated ID cannot verify branches.",
    };
    if (refresh) {
      filterCache = undefined;
      branchCache.delete(merchantProfileId);
      if (!branchPending.get(merchantProfileId)?.refresh) branchPending.delete(merchantProfileId);
    }
    let options;
    try { options = await filters(refresh); }
    catch { throw new BackofficeHttpError(502, "Unable to verify QA offer options. Check QA sign-in and retry."); }
    try {
      const scopedBranches = await branches(merchantProfileId, refresh);
      return { ...options, merchantProfileId, branches: scopedBranches,
        branchIssue: scopedBranches.length ? null : "The linked QA merchant has no selectable branches." };
    } catch (error) {
      return { ...options, merchantProfileId, branches: [],
        branchIssue: error instanceof BranchAssociationError ? error.message
          : "Unable to verify the linked QA merchant’s branches. Retry loading options; manual branch IDs are not accepted." };
    }
  };
}
export const getOfferQaOptions = createOfferOptionsLoader();
