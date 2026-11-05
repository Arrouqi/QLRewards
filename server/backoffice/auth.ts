// Credentials and tokens stay server-side. Only the user-confirmed QA login
// endpoint is allowed; never follow redirects or log authentication responses.
import { backofficeTarget, backofficeTargets, backofficeCredentials, type BackofficeTarget } from "./environment";
export const QA_LOGIN_URL = backofficeTargets.qa.loginUrl;

export function createQaTokenProvider(
  credentials: () => { username?: string; password?: string; apiToken?: string },
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
  target: BackofficeTarget = backofficeTargets.qa,
) {
  let cached: { token: string; until: number; username: string; password: string } | undefined;
  let pending: { username: string; password: string; promise: Promise<string> } | undefined;

  async function login(username: string, password: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetchImpl(target.loginUrl, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: {
          Accept: "application/json", "Content-Type": "application/json",
          Origin: target.website,
          Referer: `${target.website}/`,
        },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error();
      // Bound the body rather than retaining an arbitrary authentication response.
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 131072) throw new Error();
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      // Confirmed login response: root token (refresh_token is not used).
      const token = body?.token;
      if (typeof token !== "string" || !token.trim() || /[\s\r\n]/.test(token)) throw new Error();
      let until = now() + 60_000; // Short cache for a token without expiry metadata.
      try {
        const { exp } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
        if (typeof exp === "number" && Number.isFinite(exp)) {
          until = Math.min(exp * 1000 - 60_000, now() + 300_000);
          if (until <= now()) throw new Error("expired");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "expired") throw error;
        // JWT parsing here is only a cache hint, never identity verification.
      }
      cached = { token, until, username, password };
      return token;
    } catch {
      throw new Error(`${target.label} sign-in failed. Check the separately configured ${target.label} backoffice credentials and account access. No creation request was sent.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async getToken(): Promise<string> {
      const { username, password, apiToken } = credentials();
      if (!username && !password) {
        cached = undefined;
        if (apiToken) return apiToken; // Existing explicitly configured token mode.
        throw new Error("Configure QA login secrets or BACKOFFICE_API_TOKEN.");
      }
      if (!username || !password) {
        cached = undefined;
        throw new Error("Both BACKOFFICE_USER and BACKOFFICE_PW are required. No creation request was sent.");
      }
      if (cached && cached.username === username && cached.password === password && cached.until > now()) return cached.token;
      cached = undefined;
      if (pending && pending.username === username && pending.password === password) return pending.promise;
      const request = { username, password, promise: login(username, password) };
      pending = request;
      try {
        return await request.promise;
      } finally {
        if (pending === request) pending = undefined;
      }
    },
    invalidate(token: string) {
      if (cached?.token === token) cached = undefined;
    },
  };
}

export const qaTokenProvider = createQaTokenProvider(() => backofficeCredentials(), fetch, Date.now, backofficeTarget);
