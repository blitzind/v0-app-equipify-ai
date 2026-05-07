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

  /**
   * Phase 1 (Permissions): explicit "view financials" rollup. Currently
   * mirrors `canViewBilling` but exists as a separate key so we can split
   * subscription/Stripe billing from operational invoice totals later.
   */
  canViewFinancials: boolean
  /** Phase 1: create / edit / void / archive operational invoices. */
  canEditInvoices: boolean
  /** Phase 1: read quote drafts (separate so techs can be hidden from pricing). */
  canViewQuotes: boolean
  /** Phase 1: create / edit / send / convert quotes. */
  canEditQuotes: boolean
  /**
   * Phase 1: full edit access to work orders (status, schedule, line items,
   * notes). Conservative read-only access still requires only membership.
   */
  canEditWorkOrders: boolean
  /** Phase 1: upload external certificate attachments to a calibration record. */
  canUploadCertificateAttachments: boolean
  /** Phase 1: adjust on-hand inventory stock (counts, write-offs, manual edits). */
  canAdjustInventoryStock: boolean
  /**
   * Phase 1: aggregate "manage settings" capability used by API guards that
   * gate workspace-wide configuration (workspace profile, billing defaults,
   * portal defaults, integrations). Mirrors `canManageWorkspaceSettings ||
   * canEditOrgBilling || canManagePortalSettings`.
   */
  canManageSettings: boolean

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

  /**
   * Phase 1 (Leads): manage the prospects pipeline — create, edit, log
   * follow-ups, and convert prospects to customers. Granted to
   * owner/admin/manager only; techs and viewers see read-only access via
   * org membership but cannot mutate.
   */
  canManageProspects: boolean

  /**
   * Communications Center Phase 1: open the unified Communications page
   * and embedded "Recent communications" sections. Granted to all
   * non-tech roles plus techs (who only see operational/customer-facing
   * messages on jobs they're assigned to — financial messages stay
   * gated by `canViewBilling` at the API level).
   */
  canViewCommunications: boolean
  /**
   * Communications Center Phase 1: future-facing manage flag for
   * resend/retry/compose actions. Phase 1 ships read-only mutations so
   * this is granted to owner/admin/manager only and is currently a
   * passthrough for the Phase 2 "Resend / retry" controls.
   */
  canManageCommunications: boolean
}

export type OrgPermissionKey = keyof OrgPermissions

const NONE: OrgPermissions = {
  canViewBilling: false,
  canEditOrgBilling: false,
  canViewFinancialReports: false,
  canViewOperationalReports: false,
  canApproveInvoices: false,
  canViewFinancials: false,
  canEditInvoices: false,
  canViewQuotes: false,
  canEditQuotes: false,
  canEditWorkOrders: false,
  canUploadCertificateAttachments: false,
  canAdjustInventoryStock: false,
  canManageSettings: false,
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
  canManageProspects: false,
  canViewCommunications: false,
  canManageCommunications: false,
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
        canViewFinancials: true,
        canEditInvoices: true,
        canViewQuotes: true,
        canEditQuotes: true,
        canEditWorkOrders: true,
        canUploadCertificateAttachments: true,
        canAdjustInventoryStock: true,
        canManageSettings: true,
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
        canManageProspects: true,
        canViewCommunications: true,
        canManageCommunications: true,
      }
    case "manager":
      return {
        ...NONE,
        canViewBilling: true,
        canEditOrgBilling: false,
        canViewFinancialReports: true,
        canViewOperationalReports: true,
        canApproveInvoices: true,
        canViewFinancials: true,
        canEditInvoices: true,
        canViewQuotes: true,
        canEditQuotes: true,
        canEditWorkOrders: true,
        canUploadCertificateAttachments: true,
        canAdjustInventoryStock: true,
        canManageSettings: true,
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
        canManageProspects: true,
        canViewCommunications: true,
        canManageCommunications: true,
      }
    case "tech":
      return {
        ...NONE,
        canViewBilling: false,
        canEditOrgBilling: false,
        canViewFinancialReports: false,
        canViewOperationalReports: false,
        canApproveInvoices: false,
        canViewFinancials: false,
        canEditInvoices: false,
        canViewQuotes: false,
        canEditQuotes: false,
        canEditWorkOrders: true,
        canUploadCertificateAttachments: true,
        canAdjustInventoryStock: false,
        canManageSettings: false,
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
        canManageProspects: false,
        canViewCommunications: true,
        canManageCommunications: false,
      }
    case "viewer":
      return {
        ...NONE,
        canViewBilling: true,
        canEditOrgBilling: false,
        canViewFinancialReports: false,
        canViewOperationalReports: true,
        canApproveInvoices: false,
        canViewFinancials: true,
        canEditInvoices: false,
        canViewQuotes: true,
        canEditQuotes: false,
        canEditWorkOrders: false,
        canUploadCertificateAttachments: false,
        canAdjustInventoryStock: false,
        canManageSettings: false,
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
        canManageProspects: false,
        canViewCommunications: true,
        canManageCommunications: false,
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
