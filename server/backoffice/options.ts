import type { MerchantQaOptions } from "@shared/merchantQaDetails";
import { qaTokenProvider } from "./auth";
import { backofficeTarget } from "./environment";
import { BackofficeHttpError } from "./errors";

export function createMerchantOptionsLoader(
  tokenProvider = qaTokenProvider,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  let cache: { value: MerchantQaOptions; until: number } | undefined;
  let pending: Promise<MerchantQaOptions> | undefined;
  async function load(): Promise<MerchantQaOptions> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const token = await tokenProvider.getToken();
      if (/[\r\n]/.test(token)) throw new Error();
      const response = await fetchImpl(`${backofficeTarget.apiOrigin}/filters`, {
        method: "GET", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, platform: "0" },
      });
      if (!response.ok) {
        if (response.status === 401) tokenProvider.invalidate(token);
        await response.body?.cancel();
        throw new Error();
      }
      const body = await response.json();
      const normalize = (items: unknown) => {
        if (!Array.isArray(items)) throw new Error();
        return items.filter((item) => Number.isSafeInteger(item?.id) && item.id > 0 && typeof item.name === "string")
          .map((item) => ({ id: item.id as number, name: item.name as string }));
      };
      const value = { categories: normalize(body.categories), locations: normalize(body.locations) };
      if (!value.categories.length || !value.locations.length) throw new Error();
      cache = { value, until: now() + 300_000 };
      return value;
    } catch {
      throw new BackofficeHttpError(502, "Unable to load QA categories and locations. Check QA sign-in and retry.");
    } finally { clearTimeout(timer); }
  }
  return async () => {
    if (cache && cache.until > now()) return cache.value;
    if (!pending) pending = load().finally(() => { pending = undefined; });
    return pending;
  };
}
export const getMerchantQaOptions = createMerchantOptionsLoader();
