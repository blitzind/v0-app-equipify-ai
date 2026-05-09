import type { OrgPermissions } from "@/lib/permissions/model"

/** Invoice follow-ups may surface amounts-adjacent context — align with billing/financial visibility. */
export function canAccessInvoiceFollowUpTasks(permissions: OrgPermissions): boolean {
  return permissions.canViewFinancials || permissions.canViewBilling
}
