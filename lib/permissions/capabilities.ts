/**
 * Role-based Permissions — Phase 1
 *
 * Per-capability metadata used by:
 *   - the <RestrictedNotice> empty-state component (lookup by key)
 *   - server-side guards (`requireOrgPermission`)
 *   - documentation generators
 *
 * NOTE: The capability map itself lives in `lib/permissions/model.ts`. This
 * file is purely presentational — it never grants or denies access on its
 * own.
 */

import type { OrgPermissionKey } from "@/lib/permissions/model"

export type CapabilityMetadata = {
  /** Human-readable label suitable for buttons / menus. */
  label: string
  /** Long description shown in restricted-access empty states + docs. */
  description: string
  /**
   * Default product surface where the capability is enforced. Used by the
   * restricted notice to show a helpful "ask an admin" hint.
   */
  surface:
    | "billing"
    | "invoices"
    | "quotes"
    | "work-orders"
    | "dispatch"
    | "inventory"
    | "certificates"
    | "settings"
    | "technicians"
    | "reports"
    | "automations"
    | "prospects"
    | "communications"
    | "general"
}

/**
 * Phase 1 capability dictionary. Keep keys in sync with `OrgPermissions` in
 * `lib/permissions/model.ts`. Missing entries fall back to a generic notice
 * (see `getCapabilityMetadata` below).
 */
export const CAPABILITY_METADATA: Partial<Record<OrgPermissionKey, CapabilityMetadata>> = {
  canUseTechnicianWorkspace: {
    label: "Use technician workspace",
    description: "Open the focused technician experience for assigned jobs, schedule, and field actions.",
    surface: "work-orders",
  },
  canViewAllWorkOrders: {
    label: "View all work orders",
    description: "See organization-wide work order lists instead of only personal assignments.",
    surface: "work-orders",
  },
  canViewAssignedWorkOrdersOnly: {
    label: "View assigned work orders only",
    description: "Limit work-order lists and technician views to jobs assigned to the signed-in user.",
    surface: "work-orders",
  },
  canViewBilling: {
    label: "View billing",
    description: "View invoice totals, balances, and billing-aware reports.",
    surface: "billing",
  },
  canEditOrgBilling: {
    label: "Manage workspace billing",
    description: "Update subscription, payment methods, and billing defaults.",
    surface: "settings",
  },
  canViewFinancials: {
    label: "View financials",
    description: "Read invoice totals, paid amounts, balances, and revenue reports.",
    surface: "billing",
  },
  canEditInvoices: {
    label: "Edit invoices",
    description: "Create, edit, void, archive, or send operational invoices.",
    surface: "invoices",
  },
  canViewQuotes: {
    label: "View quotes",
    description: "Read quote drafts and customer-facing quote pricing.",
    surface: "quotes",
  },
  canEditQuotes: {
    label: "Edit quotes",
    description: "Create, send, and convert quotes to invoices or work orders.",
    surface: "quotes",
  },
  canEditWorkOrders: {
    label: "Edit work orders",
    description: "Edit work order details, status, schedule, line items, and notes.",
    surface: "work-orders",
  },
  canUploadCertificateAttachments: {
    label: "Upload certificate attachments",
    description: "Attach external calibration PDFs and supporting files to certificates.",
    surface: "certificates",
  },
  canAdjustInventoryStock: {
    label: "Adjust inventory stock",
    description: "Manually correct on-hand counts, write-offs, and stock transfers.",
    surface: "inventory",
  },
  canManageSettings: {
    label: "Manage workspace settings",
    description: "Update workspace, billing, portal, and integration settings.",
    surface: "settings",
  },
  canManageDispatch: {
    label: "Manage dispatch",
    description: "Schedule, reassign, and reroute work orders across technicians.",
    surface: "dispatch",
  },
  canViewDispatch: {
    label: "View dispatch board",
    description: "See assigned work orders and crew schedule.",
    surface: "dispatch",
  },
  canManageInventory: {
    label: "Manage inventory",
    description: "Create catalog items, manage locations, and configure stock thresholds.",
    surface: "inventory",
  },
  canConsumePartsOnWorkOrders: {
    label: "Consume parts on work orders",
    description: "Record parts used on a work order in the field.",
    surface: "work-orders",
  },
  canManageCertificateTemplates: {
    label: "Manage certificate templates",
    description: "Edit calibration templates and certificate output content.",
    surface: "certificates",
  },
  canReleaseCertificatesToPortal: {
    label: "Release certificates",
    description: "Manually release certificates to the customer portal.",
    surface: "certificates",
  },
  canManagePortalSettings: {
    label: "Manage portal settings",
    description: "Edit portal defaults, including certificate release rules.",
    surface: "settings",
  },
  canApproveInvoices: {
    label: "Approve invoices",
    description: "Approve, send, and authorize invoice issuance.",
    surface: "invoices",
  },
  canViewFinancialReports: {
    label: "View financial reports",
    description: "Open revenue, AR aging, and profitability reports.",
    surface: "reports",
  },
  canViewOperationalReports: {
    label: "View operational reports",
    description: "Open dispatch, technician, and equipment reports.",
    surface: "reports",
  },
  canManageTechnicians: {
    label: "Manage technicians",
    description: "Edit technician profiles, schedules, and certifications.",
    surface: "technicians",
  },
  canViewTechnicians: {
    label: "View technicians",
    description: "See the technician roster and assignment history.",
    surface: "technicians",
  },
  canManageWorkspaceSettings: {
    label: "Manage workspace",
    description: "Edit workspace profile, equipment types, and team invitations.",
    surface: "settings",
  },
  canManageHistoricalImports: {
    label: "Manage data imports",
    description: "Run CSV / migration imports and manage import jobs.",
    surface: "settings",
  },
  canManageSecuritySettings: {
    label: "Manage security",
    description: "Edit organization security policies and audit retention.",
    surface: "settings",
  },
  canManageIntegrations: {
    label: "Manage integrations",
    description: "Connect external services such as QuickBooks.",
    surface: "settings",
  },
  canManageApiKeys: {
    label: "Manage API keys",
    description: "Issue, rotate, or revoke workspace API keys.",
    surface: "settings",
  },
  canManageAutomations: {
    label: "Manage automations",
    description: "Edit workflow automations and AI assistants.",
    surface: "automations",
  },
  canViewInsights: {
    label: "View insights",
    description: "Open AI insights and operational intelligence dashboards.",
    surface: "reports",
  },
  canArchiveRecords: {
    label: "Archive records",
    description: "Archive customers, equipment, work orders, and invoices.",
    surface: "general",
  },
  canManageProspects: {
    label: "Manage prospects",
    description:
      "Create and edit prospects, log follow-ups, and convert prospects into customers.",
    surface: "prospects",
  },
  canViewCommunications: {
    label: "View communications",
    description:
      "Open the Communications Center and embedded recent-communications sections.",
    surface: "communications",
  },
  canManageCommunications: {
    label: "Manage communications",
    description:
      "Resend, retry, or compose customer communications (Phase 2 mutations land here).",
    surface: "communications",
  },
}

export function getCapabilityMetadata(key: OrgPermissionKey): CapabilityMetadata {
  return (
    CAPABILITY_METADATA[key] ?? {
      label: humanizeCapabilityKey(key),
      description: "This action is restricted to other roles in your workspace.",
      surface: "general",
    }
  )
}

function humanizeCapabilityKey(key: string): string {
  return key.replace(/^can/, "").replace(/([A-Z])/g, " $1").trim()
}

/**
 * Phase 1 role behavior summary used by the docs page and restricted notices.
 * Each entry is a one-line description of the role's typical scope.
 */
export const ROLE_BEHAVIOR_SUMMARY: Record<
  "owner" | "admin" | "manager" | "tech" | "viewer",
  string
> = {
  owner: "Full access — workspace, billing, settings, and every operational module.",
  admin: "Full access except for transferring ownership.",
  manager:
    "Operations Manager default: dispatch, technicians, quotes, invoices, certificates, and inventory. Cannot edit subscription billing or security policies.",
  tech: "Technician default: assigned field work, service updates, parts usage, signatures/photos/docs, and certificate uploads where permitted. Cannot see invoice or quote pricing.",
  viewer:
    "Limited viewer default: read-only workspace access with no invoice, quote, or settings mutations. Billing and Sales profiles can be layered on this DB role.",
}
