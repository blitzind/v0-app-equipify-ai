// ─── Platform Admin shared types & sample audit log ────────────────────────────
// Live KPIs: GET /api/platform/analytics. Accounts grid: GET /api/platform/accounts.

export type PlatformAdminRole = "Super Admin" | "Support Admin" | "Sales Admin" | "Finance Admin"

// ─── Tenant accounts (platform-level view) ────────────────────────────────────

export type AccountStatus = "Active" | "Trialing" | "Past Due" | "Canceled" | "Suspended" | "Archived"

/** Admin table status pill when no subscription row exists (workspace not archived). */
export type AccountDisplayStatus = AccountStatus | "Unassigned" | "—"

export interface PlatformAccount {
  id: string
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  /** Tier label for pills / filters; mirrored by displayPlan when present. */
  plan: string
  /** Server-computed pill label from GET /api/platform/accounts (preferred for table UI). */
  displayPlan?: string
  billingCycle: "monthly" | "annual" | null
  /** Display pill + filters; mirrored by displayStatus when present. */
  status: AccountDisplayStatus
  /** Server-computed pill label from GET /api/platform/accounts (preferred for table UI). */
  displayStatus?: AccountDisplayStatus
  /** Soft-delete: organization.status === 'archived' */
  organizationArchived?: boolean
  mrr: number           // effective MRR in cents (after internal discount when active)
  /** List MRR in cents before discount; set when a discount reduces price */
  mrrBaseCents?: number | null
  hasActiveDiscount?: boolean
  discountType?: string | null
  discountValue?: number | null
  discountLabel?: string | null
  discountReason?: string | null
  discountExpiresAt?: string | null
  seats: number
  equipmentCount: number
  workOrderCount: number
  createdAt: string
  lastActive: string
  /** ISO 8601 trial end from `organization_subscriptions.trial_ends_at` */
  trialEndsAt?: string | null
  /** Whole days until trial ends; negative if expired; null if no trial end date */
  trialDaysLeft?: number | null
  /** Raw `organization_subscriptions.status` */
  subscriptionStatus?: string | null
  /** Raw `organization_subscriptions.plan_id` */
  planId?: string | null
  /** Raw `organization_subscriptions.intended_plan_id` when set */
  intendedPlanId?: string | null
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  country: string
  industry: string
}

// ─── Feature flags ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string
  name: string
  description: string
  enabledFor: "all" | "enterprise" | "growth_up" | "none" | string[]  // string[] = specific account IDs
  category: "AI" | "Billing" | "Portal" | "Operations" | "Lab"
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: "ff-ai-insights",
    name: "AI Insights",
    description: "Predictive maintenance and repeat-repair analysis powered by AI.",
    enabledFor: "growth_up",
    category: "AI",
  },
  {
    id: "ff-ai-scan",
    name: "AI Equipment Scan",
    description: "Camera-based equipment identification and auto-population.",
    enabledFor: "growth_up",
    category: "AI",
  },
  {
    id: "ff-portal",
    name: "Customer Portal",
    description: "Self-service portal for customers to view equipment, invoices, and book service.",
    enabledFor: "growth_up",
    category: "Portal",
  },
  {
    id: "ff-custom-roles",
    name: "Custom Role Permissions",
    description: "Granular per-permission overrides on workspace roles.",
    enabledFor: "enterprise",
    category: "Operations",
  },
  {
    id: "ff-api-access",
    name: "API Access",
    description: "REST API and webhook access for custom integrations.",
    enabledFor: "enterprise",
    category: "Operations",
  },
  {
    id: "ff-white-label",
    name: "White-Label Branding",
    description: "Custom logo, colors, and domain for the customer portal.",
    enabledFor: "enterprise",
    category: "Portal",
  },
  {
    id: "ff-advanced-reports",
    name: "Advanced Reports",
    description: "Exportable PDF/CSV reports with custom date ranges.",
    enabledFor: "growth_up",
    category: "Operations",
  },
  {
    id: "ff-multi-location",
    name: "Multi-Location Support",
    description: "Separate service regions and technician pools per location.",
    enabledFor: "enterprise",
    category: "Operations",
  },
  {
    id: "ff-beta-scheduling",
    name: "[Beta] Smart Scheduling",
    description: "AI-driven technician routing and schedule optimization.",
    enabledFor: ["ws-acme", "ws-hartwell"],
    category: "Lab",
  },
  {
    id: "ff-beta-cost-tracking",
    name: "[Beta] Parts Cost Tracking",
    description: "Track parts inventory and cost-per-repair on work orders.",
    enabledFor: ["ws-ridgeline"],
    category: "Lab",
  },
]

// ─── Platform audit log ───────────────────────────────────────────────────────

export interface AdminAuditEvent {
  id: string
  actor: string
  actorRole: PlatformAdminRole
  action: string
  target: string
  detail: string
  timestamp: string
  severity: "info" | "warning" | "critical"
}

export const ADMIN_AUDIT_LOG: AdminAuditEvent[] = [
  {
    id: "ae-001",
    actor: "Platform admin",
    actorRole: "Super Admin",
    action: "impersonated_account",
    target: "Acme Field Services",
    detail: "Support session opened for billing dispute",
    timestamp: "2026-04-30T14:22:00Z",
    severity: "warning",
  },
  {
    id: "ae-002",
    actor: "Jess Cooper",
    actorRole: "Support Admin",
    action: "reset_user_password",
    target: "sarah@acme.com",
    detail: "Password reset requested by account owner",
    timestamp: "2026-04-30T11:05:00Z",
    severity: "info",
  },
  {
    id: "ae-003",
    actor: "Platform admin",
    actorRole: "Super Admin",
    action: "updated_feature_flag",
    target: "ff-beta-scheduling",
    detail: "Enabled for ws-acme, ws-hartwell",
    timestamp: "2026-04-29T16:44:00Z",
    severity: "info",
  },
  {
    id: "ae-004",
    actor: "Ryan Moss",
    actorRole: "Finance Admin",
    action: "issued_credit",
    target: "Pacific Lift Solutions",
    detail: "$150 credit applied to resolve billing dispute (inv INV-PAC-2026-03)",
    timestamp: "2026-04-29T10:20:00Z",
    severity: "info",
  },
  {
    id: "ae-005",
    actor: "Platform admin",
    actorRole: "Super Admin",
    action: "suspended_account",
    target: "Clearwater Plumbing",
    detail: "Account suspended due to failed payment after 3 retries",
    timestamp: "2026-04-28T08:15:00Z",
    severity: "critical",
  },
  {
    id: "ae-006",
    actor: "Jess Cooper",
    actorRole: "Support Admin",
    action: "extended_trial",
    target: "Zephyr Equipment Co.",
    detail: "Trial extended 14 days at Sales request (ticket #4892)",
    timestamp: "2026-04-27T15:30:00Z",
    severity: "info",
  },
  {
    id: "ae-007",
    actor: "Morgan Lee",
    actorRole: "Sales Admin",
    action: "upgraded_plan",
    target: "Summit HVAC Corp",
    detail: "Manually upgraded from Growth Monthly to Growth Annual",
    timestamp: "2026-04-26T13:55:00Z",
    severity: "info",
  },
  {
    id: "ae-008",
    actor: "Platform admin",
    actorRole: "Super Admin",
    action: "added_admin",
    target: "Morgan Lee",
    detail: "Granted Sales Admin role",
    timestamp: "2026-04-25T09:00:00Z",
    severity: "info",
  },
]
