export interface BackofficeState {
  environment?: "qa" | "production";
  status: string;
  backofficeMerchantId: string | null;
  backofficeOfferId?: string | null;
  backofficeCreatedAt: string | null;
  lastBackofficeError: string | null;
  lastBackofficeAttemptAt: string | null;
  dryRun: boolean;
  canCreate: boolean;
  blockedReason: string | null;
  warnings?: string[];
  mappingIssues?: string[];
}
