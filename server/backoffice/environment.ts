export type BackofficeEnvironment = "qa" | "production";
export const backofficeTargets = {
  qa: {
    environment: "qa", label: "QA", prefix: "qa",
    apiOrigin: "https://qlr-bo-qa.qatarliving.com",
    loginUrl: "https://users-be-qa.qatarliving.com/api/v4/login",
    website: "https://backoffice-qa.qatarliving.com",
    merchantSigner: "https://ql-shared-qa.qatarliving.com/generateSignedURL",
    merchantStorage: "https://qlsharedstorageqa.blob.core.windows.net",
    offerStorage: "https://qlrstorageqa.blob.core.windows.net",
  },
  production: {
    environment: "production", label: "Production", prefix: "prod",
    apiOrigin: "https://qlr-bo-prod.qatarliving.com",
    loginUrl: "https://users-be-prod.qatarliving.com/api/v4/login",
    website: "https://backoffice.qatarliving.com",
    merchantSigner: "https://ql-shared-prod.qatarliving.com/generateSignedURL",
    merchantStorage: "https://qlsharedstorageprod.blob.core.windows.net",
    offerStorage: "https://qlrstorageprod.blob.core.windows.net",
  },
} as const;
export type BackofficeTarget = typeof backofficeTargets[BackofficeEnvironment];
export function getBackofficeTarget(env: NodeJS.ProcessEnv = process.env): BackofficeTarget {
  const name = env.BACKOFFICE_TARGET ?? "qa";
  if (name !== "qa" && name !== "production") throw new Error("Invalid BACKOFFICE_TARGET; use qa or production.");
  return backofficeTargets[name];
}
// Immutable per process: changing the target requires an application restart,
// so token/option caches cannot cross environments.
export const backofficeTarget = getBackofficeTarget();
export function backofficeWritesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BACKOFFICE_DRY_RUN?.trim().toLowerCase() === "false"
    && (backofficeTarget.environment === "production"
      ? env.BACKOFFICE_PRODUCTION_WRITES_ENABLED === "true" && env.NODE_ENV === "production"
      : env.BACKOFFICE_QA_WRITES_ENABLED === "true");
}
export function scopedSettingKey(key: string): string {
  return backofficeTarget.environment === "production" ? `production:${key}` : key;
}
export function isCurrentStorageKey(value: string): boolean {
  return value.startsWith(`${backofficeTarget.prefix}/`);
}
export function backofficeCredentials(env: NodeJS.ProcessEnv = process.env, target = backofficeTarget) {
  return target.environment === "production"
    ? { username: env.BACKOFFICE_PROD_USER, password: env.BACKOFFICE_PROD_PW, apiToken: env.BACKOFFICE_PROD_API_TOKEN }
    : { username: env.BACKOFFICE_USER, password: env.BACKOFFICE_PW, apiToken: env.BACKOFFICE_API_TOKEN };
}
