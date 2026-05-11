import type { OrgPermissions } from "@/lib/permissions/model"
import type { FirstRunStepId } from "@/lib/first-run/types"

/** Steps hidden when the user cannot realistically complete the underlying action in-app. */
export function isLaunchpadStepApplicable(id: FirstRunStepId, p: OrgPermissions): boolean {
  switch (id) {
    case "customer":
      return p.canManageProspects || p.canViewAllWorkOrders
    case "equipment":
      return p.canViewAllWorkOrders || p.canEditWorkOrders
    case "work_order":
      return p.canEditWorkOrders || p.canManageDispatch
    case "quote":
      return p.canEditQuotes
    case "invoice_sent":
      return p.canEditInvoices
    case "blitzpay":
      return p.canViewBilling || p.canManageWorkspaceSettings
    case "team_invite":
      return p.canManageWorkspaceSettings
    case "quickbooks":
      return p.canManageIntegrations
    default:
      return true
  }
}
