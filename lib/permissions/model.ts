/**
 * System-managed operational permissions derived from `organization_members.role`.
 * Custom per-user ACLs are out of scope for Phase 1.
 */

export type OrgMemberRole = "owner" | "admin" | "manager" | "tech" | "viewer"

/** Typed capability flags used across UI + API helpers. */
export type OrgPermissions = {
  canViewBilling: boolean
  canEditOrgBilling: boolean
  canViewFinancialReports: boolean
  canViewOperationalReports: boolean
  canApproveInvoices: boolean

  canManageDispatch: boolean
  canViewDispatch: boolean

  canManageInventory: boolean
  canConsumePartsOnWorkOrders: boolean

  canManageCertificateTemplates: boolean
  canReleaseCertificatesToPortal: boolean
  canManagePortalSettings: boolean

  canViewInsights: boolean
  canManageIntegrations: boolean
  canManageApiKeys: boolean
  canManageAutomations: boolean

  /** General, workspace profile fields, team invites, notifications, imports, sample data, equipment types */
  canManageWorkspaceSettings: boolean
  /** Historical CSV / migration center — owner & admin only (see RLS on organization_import_jobs). */
  canManageHistoricalImports: boolean
  canManageSecuritySettings: boolean

  canManageTechnicians: boolean
  canViewTechnicians: boolean

  canArchiveRecords: boolean
}

export type OrgPermissionKey = keyof OrgPermissions

const NONE: OrgPermissions = {
  canViewBilling: false,
  canEditOrgBilling: false,
  canViewFinancialReports: false,
  canViewOperationalReports: false,
  canApproveInvoices: false,
  canManageDispatch: false,
  canViewDispatch: false,
  canManageInventory: false,
  canConsumePartsOnWorkOrders: false,
  canManageCertificateTemplates: false,
  canReleaseCertificatesToPortal: false,
  canManagePortalSettings: false,
  canViewInsights: false,
  canManageIntegrations: false,
  canManageApiKeys: false,
  canManageAutomations: false,
  canManageWorkspaceSettings: false,
  canManageHistoricalImports: false,
  canManageSecuritySettings: false,
  canManageTechnicians: false,
  canViewTechnicians: false,
  canArchiveRecords: false,
}

export function normalizeOrgMemberRole(raw: string | null | undefined): OrgMemberRole | null {
  const r = raw?.trim().toLowerCase()
  if (r === "owner" || r === "admin" || r === "manager" || r === "tech" || r === "viewer") {
    return r
  }
  return null
}

export function getOrgPermissionsForRole(role: OrgMemberRole | null): OrgPermissions {
  if (!role) return NONE

  switch (role) {
    case "owner":
    case "admin":
      return {
        ...NONE,
        canViewBilling: true,
        canEditOrgBilling: true,
        canViewFinancialReports: true,
        canViewOperationalReports: true,
        canApproveInvoices: true,
        canManageDispatch: true,
        canViewDispatch: true,
        canManageInventory: true,
        canConsumePartsOnWorkOrders: true,
        canManageCertificateTemplates: true,
        canReleaseCertificatesToPortal: true,
        canManagePortalSettings: true,
        canViewInsights: true,
        canManageIntegrations: true,
        canManageApiKeys: true,
        canManageAutomations: true,
        canManageWorkspaceSettings: true,
        canManageHistoricalImports: true,
        canManageSecuritySettings: true,
        canManageTechnicians: true,
        canViewTechnicians: true,
        canArchiveRecords: true,
      }
    case "manager":
      return {
        ...NONE,
        canViewBilling: true,
        canEditOrgBilling: false,
        canViewFinancialReports: true,
        canViewOperationalReports: true,
        canApproveInvoices: true,
        canManageDispatch: true,
        canViewDispatch: true,
        canManageInventory: true,
        canConsumePartsOnWorkOrders: true,
        canManageCertificateTemplates: true,
        canReleaseCertificatesToPortal: true,
        canManagePortalSettings: false,
        canViewInsights: true,
        canManageIntegrations: false,
        canManageApiKeys: false,
        canManageAutomations: false,
        canManageWorkspaceSettings: true,
        canManageHistoricalImports: false,
        canManageSecuritySettings: false,
        canManageTechnicians: true,
        canViewTechnicians: true,
        canArchiveRecords: true,
      }
    case "tech":
      return {
        ...NONE,
        canViewBilling: false,
        canEditOrgBilling: false,
        canViewFinancialReports: false,
        canViewOperationalReports: false,
        canApproveInvoices: false,
        canManageDispatch: false,
        canViewDispatch: true,
        canManageInventory: false,
        canConsumePartsOnWorkOrders: true,
        canManageCertificateTemplates: false,
        canReleaseCertificatesToPortal: false,
        canManagePortalSettings: false,
        canViewInsights: false,
        canManageIntegrations: false,
        canManageApiKeys: false,
        canManageAutomations: false,
        canManageWorkspaceSettings: false,
        canManageSecuritySettings: false,
        canManageTechnicians: false,
        canViewTechnicians: true,
        canArchiveRecords: false,
      }
    case "viewer":
      return {
        ...NONE,
        canViewBilling: true,
        canEditOrgBilling: false,
        canViewFinancialReports: false,
        canViewOperationalReports: true,
        canApproveInvoices: false,
        canManageDispatch: false,
        canViewDispatch: true,
        canManageInventory: false,
        canConsumePartsOnWorkOrders: false,
        canManageCertificateTemplates: false,
        canReleaseCertificatesToPortal: false,
        canManagePortalSettings: false,
        canViewInsights: false,
        canManageIntegrations: false,
        canManageApiKeys: false,
        canManageAutomations: false,
        canManageWorkspaceSettings: false,
        canManageSecuritySettings: false,
        canManageTechnicians: false,
        canViewTechnicians: true,
        canArchiveRecords: false,
      }
    default:
      return NONE
  }
}

export function hasOrgPermission(
  perms: OrgPermissions,
  key: keyof OrgPermissions,
): boolean {
  return Boolean(perms[key])
}
