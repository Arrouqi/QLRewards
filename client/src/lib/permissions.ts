export const ALL_PERMISSIONS = [
  { key: "overview.view", label: "View Overview Dashboard", group: "Overview" },
  { key: "merchants.view", label: "View Merchant Requests", group: "Merchants" },
  { key: "merchants.edit", label: "Edit Merchant Applications", group: "Merchants" },
  { key: "merchants.approve", label: "Approve / Reject Merchants", group: "Merchants" },
  { key: "merchants.archive", label: "Archive Merchant Applications", group: "Merchants" },
  { key: "merchants.training", label: "Add / View Training Records", group: "Merchants" },
  { key: "deals.view", label: "View Deal Requests", group: "Deals" },
  { key: "deals.edit", label: "Edit Deal Submissions", group: "Deals" },
  { key: "deals.approve", label: "Approve / Reject Deals", group: "Deals" },
  { key: "deals.archive", label: "Archive Deal Requests", group: "Deals" },
  { key: "live_data.view", label: "View Live Data (Merchants & Deals)", group: "Live Data" },
  { key: "feedbacks.view", label: "View Feedbacks", group: "Feedbacks" },
  { key: "feedbacks.manage", label: "Manage Feedbacks (status, comments, delete)", group: "Feedbacks" },
  { key: "redirect_analytics.view", label: "View Redirect Analytics", group: "Analytics" },
] as const;

export type Permission = typeof ALL_PERMISSIONS[number]["key"];

export const CONFIGURABLE_ROLES = ["moderation", "sales"] as const;
export type ConfigurableRole = typeof CONFIGURABLE_ROLES[number];

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  moderation: "Moderation",
  sales: "Sales",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableRole, Permission[]> = {
  moderation: [
    "overview.view",
    "merchants.view",
    "merchants.edit",
    "merchants.approve",
    "merchants.archive",
    "merchants.training",
    "deals.view",
    "deals.edit",
    "deals.approve",
    "deals.archive",
    "feedbacks.view",
    "feedbacks.manage",
  ],
  sales: [
    "overview.view",
    "merchants.view",
    "merchants.training",
    "deals.view",
    "live_data.view",
    "feedbacks.view",
  ],
};
