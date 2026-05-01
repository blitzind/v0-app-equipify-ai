// ─── Platform Admin mock data ─────────────────────────────────────────────────
// Represents the super-admin layer above all tenant workspaces.

export type PlatformAdminRole = "Super Admin" | "Support Admin" | "Sales Admin" | "Finance Admin"

export interface PlatformAdmin {
  id: string
  name: string
  email: string
  role: PlatformAdminRole
  avatar: string
}

export const CURRENT_PLATFORM_ADMIN: PlatformAdmin = {
  id: "pa-01",
  name: "Devon Park",
  email: "devon@equipify.ai",
  role: "Super Admin",
  avatar: "",
}

// ─── Tenant accounts (platform-level view) ────────────────────────────────────

export type AccountStatus = "Active" | "Trialing" | "Past Due" | "Canceled" | "Suspended"

export interface PlatformAccount {
  id: string
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  plan: "Starter" | "Growth" | "Enterprise"
  billingCycle: "monthly" | "annual"
  status: AccountStatus
  mrr: number           // monthly recurring revenue in cents
  seats: number
  equipmentCount: number
  workOrderCount: number
  createdAt: string
  lastActive: string
  trialEndsAt?: string
  country: string
  industry: string
}

export const PLATFORM_ACCOUNTS: PlatformAccount[] = [
  {
    id: "ws-acme",
    name: "Acme Field Services",
    slug: "acme",
    ownerName: "Sarah Mitchell",
    ownerEmail: "sarah@acme.com",
    plan: "Growth",
    billingCycle: "annual",
    status: "Active",
    mrr: 26500,
    seats: 4,
    equipmentCount: 94,
    workOrderCount: 312,
    createdAt: "2024-01-15",
    lastActive: "2026-04-30",
    country: "US",
    industry: "Heavy Equipment",
  },
  {
    id: "ws-medology",
    name: "Medology Solutions",
    slug: "medology",
    ownerName: "Megan Brooks",
    ownerEmail: "m.brooks@medology.com",
    plan: "Growth",
    billingCycle: "annual",
    status: "Active",
    mrr: 26500,
    seats: 4,
    equipmentCount: 73,
    workOrderCount: 218,
    createdAt: "2024-06-01",
    lastActive: "2026-04-30",
    country: "US",
    industry: "Medical Equipment",
  },
  {
    id: "ws-zephyr",
    name: "Zephyr Equipment Co.",
    slug: "zephyr",
    ownerName: "Priya Mehta",
    ownerEmail: "priya@zephyr.com",
    plan: "Starter",
    billingCycle: "monthly",
    status: "Trialing",
    mrr: 0,
    seats: 2,
    equipmentCount: 18,
    workOrderCount: 24,
    createdAt: "2026-04-14",
    lastActive: "2026-04-30",
    trialEndsAt: "2026-05-14",
    country: "US",
    industry: "Construction",
  },
  {
    id: "ws-hartwell",
    name: "Hartwell Industrial",
    slug: "hartwell",
    ownerName: "Greg Hartwell",
    ownerEmail: "g.hartwell@hartwell.com",
    plan: "Enterprise",
    billingCycle: "annual",
    status: "Active",
    mrr: 89900,
    seats: 22,
    equipmentCount: 340,
    workOrderCount: 1204,
    createdAt: "2023-09-01",
    lastActive: "2026-04-29",
    country: "US",
    industry: "Manufacturing",
  },
  {
    id: "ws-pacific",
    name: "Pacific Lift Solutions",
    slug: "pacific",
    ownerName: "Naomi Yee",
    ownerEmail: "n.yee@pacificlift.com",
    plan: "Growth",
    billingCycle: "monthly",
    status: "Past Due",
    mrr: 29900,
    seats: 7,
    equipmentCount: 61,
    workOrderCount: 189,
    createdAt: "2025-02-18",
    lastActive: "2026-04-22",
    country: "US",
    industry: "Crane & Lift",
  },
  {
    id: "ws-volta",
    name: "Volta Energy Systems",
    slug: "volta",
    ownerName: "Andre Volta",
    ownerEmail: "a.volta@voltaenergy.com",
    plan: "Starter",
    billingCycle: "monthly",
    status: "Active",
    mrr: 9900,
    seats: 3,
    equipmentCount: 27,
    workOrderCount: 88,
    createdAt: "2025-11-05",
    lastActive: "2026-04-28",
    country: "US",
    industry: "Electrical",
  },
  {
    id: "ws-summit",
    name: "Summit HVAC Corp",
    slug: "summit",
    ownerName: "Lisa Park",
    ownerEmail: "l.park@summithvac.com",
    plan: "Growth",
    billingCycle: "annual",
    status: "Active",
    mrr: 26500,
    seats: 9,
    equipmentCount: 112,
    workOrderCount: 401,
    createdAt: "2024-03-22",
    lastActive: "2026-04-30",
    country: "US",
    industry: "HVAC",
  },
  {
    id: "ws-ridgeline",
    name: "Ridgeline Fleet Services",
    slug: "ridgeline",
    ownerName: "Carlos Ruiz",
    ownerEmail: "c.ruiz@ridgeline.com",
    plan: "Enterprise",
    billingCycle: "annual",
    status: "Active",
    mrr: 89900,
    seats: 18,
    equipmentCount: 287,
    workOrderCount: 976,
    createdAt: "2023-06-14",
    lastActive: "2026-04-30",
    country: "US",
    industry: "Fleet Management",
  },
  {
    id: "ws-clearwater",
    name: "Clearwater Plumbing",
    slug: "clearwater",
    ownerName: "Ben Waters",
    ownerEmail: "b.waters@clearwater.com",
    plan: "Starter",
    billingCycle: "monthly",
    status: "Canceled",
    mrr: 0,
    seats: 2,
    equipmentCount: 14,
    workOrderCount: 45,
    createdAt: "2025-07-01",
    lastActive: "2026-03-15",
    country: "US",
    industry: "Plumbing",
  },
]

// ─── Platform-level usage stats ───────────────────────────────────────────────

export const PLATFORM_STATS = {
  totalAccounts: 9,
  activeAccounts: 7,
  totalMrr: 298600,      // cents → $2,986.00
  trialAccounts: 1,
  churnedAccounts: 1,
  totalSeats: 71,
  totalEquipment: 1026,
  totalWorkOrders: 3457,
  mrrGrowth: 12.4,       // % MoM
  accountGrowth: 18.2,   // % MoM
}

export const MRR_TREND = [
  { month: "Nov", mrr: 212000 },
  { month: "Dec", mrr: 228000 },
  { month: "Jan", mrr: 244000 },
  { month: "Feb", mrr: 259000 },
  { month: "Mar", mrr: 271000 },
  { month: "Apr", mrr: 298600 },
]

export const PLAN_DISTRIBUTION = [
  { plan: "Starter",    accounts: 3, color: "#f59e0b" },
  { plan: "Growth",     accounts: 4, color: "#3b82f6" },
  { plan: "Enterprise", accounts: 2, color: "#8b5cf6" },
]

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
    actor: "Devon Park",
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
    actor: "Devon Park",
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
    actor: "Devon Park",
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
    actor: "Devon Park",
    actorRole: "Super Admin",
    action: "added_admin",
    target: "Morgan Lee",
    detail: "Granted Sales Admin role",
    timestamp: "2026-04-25T09:00:00Z",
    severity: "info",
  },
]
