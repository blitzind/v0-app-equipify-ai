import type { PlanId } from "./plans"

export type UserRole = "Admin" | "Manager" | "Tech" | "Read Only"

export const ROLE_PERMISSIONS: Record<UserRole, {
  canManageWorkspace: boolean
  canManageBilling: boolean
  canManageTeam: boolean
  canCreateWorkOrders: boolean
  canEditWorkOrders: boolean
  canDeleteWorkOrders: boolean
  canCreateEquipment: boolean
  canEditEquipment: boolean
  canViewInsights: boolean
  canManagePlans: boolean
  canViewBilling: boolean
  canAccessPortal: boolean
}> = {
  Admin: {
    canManageWorkspace: true,
    canManageBilling: true,
    canManageTeam: true,
    canCreateWorkOrders: true,
    canEditWorkOrders: true,
    canDeleteWorkOrders: true,
    canCreateEquipment: true,
    canEditEquipment: true,
    canViewInsights: true,
    canManagePlans: true,
    canViewBilling: true,
    canAccessPortal: true,
  },
  Manager: {
    canManageWorkspace: false,
    canManageBilling: false,
    canManageTeam: false,
    canCreateWorkOrders: true,
    canEditWorkOrders: true,
    canDeleteWorkOrders: false,
    canCreateEquipment: true,
    canEditEquipment: true,
    canViewInsights: true,
    canManagePlans: true,
    canViewBilling: true,
    canAccessPortal: true,
  },
  Tech: {
    canManageWorkspace: false,
    canManageBilling: false,
    canManageTeam: false,
    canCreateWorkOrders: false,
    canEditWorkOrders: true,
    canDeleteWorkOrders: false,
    canCreateEquipment: false,
    canEditEquipment: false,
    canViewInsights: false,
    canManagePlans: false,
    canViewBilling: false,
    canAccessPortal: false,
  },
  "Read Only": {
    canManageWorkspace: false,
    canManageBilling: false,
    canManageTeam: false,
    canCreateWorkOrders: false,
    canEditWorkOrders: false,
    canDeleteWorkOrders: false,
    canCreateEquipment: false,
    canEditEquipment: false,
    canViewInsights: true,
    canManagePlans: false,
    canViewBilling: false,
    canAccessPortal: true,
  },
}

export interface TenantUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatar: string
  joinedAt: string
  lastActive: string
  status: "Active" | "Invited" | "Suspended"
}

export interface TenantWorkspace {
  id: string
  name: string
  slug: string
  planId: PlanId
  billingCycle: "monthly" | "annual"
  stripeCustomerId: string
  stripeSubscriptionId: string
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled"
  trialEndsAt: string
  currentPeriodEnd: string
  logoUrl: string          // white-label logo
  primaryColor: string     // white-label accent
  companyEmail: string
  companyPhone: string
  companyAddress: string
  timezone: string
  dateFormat: string
  seatCount: number        // used seats
  ownerId: string
  createdAt: string
}

// ─── Mock tenants ─────────────────────────────────────────────────────────────

export const MOCK_WORKSPACES: TenantWorkspace[] = [
  {
    id: "ws-acme",
    name: "Acme Field Services",
    slug: "acme",
    planId: "growth",
    billingCycle: "annual",
    stripeCustomerId: "cus_acme",
    stripeSubscriptionId: "sub_acme",
    subscriptionStatus: "active",
    trialEndsAt: "",
    currentPeriodEnd: "2026-12-31",
    logoUrl: "",
    primaryColor: "#2563eb",
    companyEmail: "admin@acme.com",
    companyPhone: "(614) 555-0100",
    companyAddress: "1200 Tech Park Dr, Columbus, OH 43215",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    seatCount: 4,
    ownerId: "u-01",
    createdAt: "2024-01-15T08:00:00Z",
  },
  {
    id: "ws-zephyr",
    name: "Zephyr Equipment Co.",
    slug: "zephyr",
    planId: "starter",
    billingCycle: "monthly",
    stripeCustomerId: "cus_zephyr",
    stripeSubscriptionId: "sub_zephyr",
    subscriptionStatus: "trialing",
    trialEndsAt: "2026-05-14",
    currentPeriodEnd: "2026-05-14",
    logoUrl: "",
    primaryColor: "#2563eb",
    companyEmail: "admin@zephyr.com",
    companyPhone: "(212) 555-0299",
    companyAddress: "400 Commerce Ave, New York, NY 10001",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    seatCount: 2,
    ownerId: "u-06",
    createdAt: "2026-04-14T10:00:00Z",
  },
]

export const MOCK_USERS: TenantUser[] = [
  // Acme workspace
  {
    id: "u-01", name: "Sarah Mitchell", email: "sarah@acme.com",
    role: "Admin", avatar: "", joinedAt: "2024-01-15", lastActive: "2026-04-30", status: "Active",
  },
  {
    id: "u-02", name: "Marcus Webb", email: "marcus@acme.com",
    role: "Tech", avatar: "", joinedAt: "2024-02-01", lastActive: "2026-04-30", status: "Active",
  },
  {
    id: "u-03", name: "Sandra Liu", email: "sandra@acme.com",
    role: "Tech", avatar: "", joinedAt: "2024-02-01", lastActive: "2026-04-29", status: "Active",
  },
  {
    id: "u-04", name: "Tyler Oakes", email: "tyler@acme.com",
    role: "Manager", avatar: "", joinedAt: "2024-03-15", lastActive: "2026-04-28", status: "Active",
  },
  {
    id: "u-05", name: "Jordan Kim", email: "jordan@acme.com",
    role: "Read Only", avatar: "", joinedAt: "2026-01-10", lastActive: "2026-04-25", status: "Invited",
  },
  // Zephyr workspace
  {
    id: "u-06", name: "Priya Mehta", email: "priya@zephyr.com",
    role: "Admin", avatar: "", joinedAt: "2026-04-14", lastActive: "2026-04-30", status: "Active",
  },
  {
    id: "u-07", name: "James Torres", email: "james@zephyr.com",
    role: "Tech", avatar: "", joinedAt: "2026-04-14", lastActive: "2026-04-30", status: "Active",
  },
]

export const INVOICE_HISTORY = [
  { id: "INV-S001", date: "2026-04-01", amount: 31900, status: "Paid", description: "Growth Plan — Annual (Apr 2026)" },
  { id: "INV-S002", date: "2026-03-01", amount: 31900, status: "Paid", description: "Growth Plan — Annual (Mar 2026)" },
  { id: "INV-S003", date: "2026-02-01", amount: 31900, status: "Paid", description: "Growth Plan — Annual (Feb 2026)" },
  { id: "INV-S004", date: "2026-01-01", amount: 31900, status: "Paid", description: "Growth Plan — Annual (Jan 2026)" },
]
