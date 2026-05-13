import type { OrgPermissions } from "@/lib/permissions/model"

/** Whether the signed-in user can meaningfully follow a deep link for screenshots / guided actions. */
export function isGoldenPathHrefApplicable(href: string, p: OrgPermissions): boolean {
  if (href.startsWith("/work-orders")) {
    return p.canViewAllWorkOrders || p.canEditWorkOrders || p.canManageDispatch || p.canViewAssignedWorkOrdersOnly
  }
  if (href.startsWith("/equipment")) {
    return p.canViewAllWorkOrders || p.canEditWorkOrders
  }
  if (href.startsWith("/customers")) {
    return p.canManageProspects || p.canViewAllWorkOrders
  }
  if (href.startsWith("/maintenance-plans")) {
    return p.canViewAllWorkOrders || p.canEditWorkOrders || p.canManageDispatch
  }
  if (href.startsWith("/service-schedule") || href.startsWith("/dispatch")) {
    return p.canViewDispatch || p.canManageDispatch || p.canViewAllWorkOrders
  }
  if (href.startsWith("/invoices")) {
    return p.canEditInvoices || p.canViewBilling || p.canViewFinancials
  }
  if (href.startsWith("/quotes")) {
    return p.canEditQuotes || p.canViewQuotes
  }
  if (href.startsWith("/reports")) {
    return p.canViewOperationalReports || p.canViewFinancialReports
  }
  if (href.startsWith("/ai-ops")) {
    return p.canViewInsights
  }
  if (href.startsWith("/settings/")) {
    return p.canManageWorkspaceSettings || p.canManagePortalSettings || p.canManageIntegrations
  }
  if (href.startsWith("/inventory") || href.startsWith("/purchase-orders")) {
    return p.canManageInventory || p.canViewAllWorkOrders
  }
  if (href.startsWith("/vendors")) {
    return p.canManageWorkspaceSettings || p.canViewAllWorkOrders
  }
  return true
}
