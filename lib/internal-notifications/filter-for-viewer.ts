import type { OrgPermissions } from "@/lib/permissions/model"
import type { AssignedWorkScope } from "@/lib/permissions/technician-scope"
import type { InternalEscalationRuleRow, InternalNotificationCandidate } from "@/lib/internal-notifications/types"

function includesId(list: string[] | undefined, id: string | null | undefined): boolean {
  if (!id || !list?.length) return false
  return list.includes(id)
}

function candidateInAssignedScope(c: InternalNotificationCandidate, scope: AssignedWorkScope | null): boolean {
  if (!scope?.workOrderIds?.length) return false
  const woIds = new Set(scope.workOrderIds)
  if (c.entityType === "work_order" && c.entityId && woIds.has(c.entityId)) return true
  if (c.workOrderId && woIds.has(c.workOrderId)) return true
  if (c.entityType === "equipment" && includesId(scope.equipmentIds, c.entityId ?? c.equipmentId)) return true
  if (c.equipmentId && includesId(scope.equipmentIds, c.equipmentId)) return true
  if (c.entityType === "service_request" && includesId(scope.customerIds, c.customerId)) return true
  if (c.entityType === "quote" && includesId(scope.customerIds, c.customerId)) return true
  if (c.entityType === "invoice" && includesId(scope.customerIds, c.customerId)) return true
  return false
}

function roleMatchesTarget(userRawRole: string | null, targetRoles: string[] | null): boolean {
  if (!targetRoles?.length) return true
  const r = userRawRole?.trim().toLowerCase() ?? ""
  return targetRoles.some((t) => {
    const x = t.trim().toLowerCase()
    if (x === r) return true
    // DB uses `operations_manager`; UI may use `manager`.
    if (x === "manager" && r === "operations_manager") return true
    if (x === "operations_manager" && r === "operations_manager") return true
    return false
  })
}

function recipientMatchesRule(
  rule: Pick<InternalEscalationRuleRow, "target_roles" | "target_user_ids">,
  userId: string,
  userRawRole: string | null,
): boolean {
  if (rule.target_user_ids?.length && rule.target_user_ids.includes(userId)) return true
  if (!rule.target_roles?.length && !rule.target_user_ids?.length) return true
  if (rule.target_roles?.length && roleMatchesTarget(userRawRole, rule.target_roles)) return true
  return false
}

export function applyInternalNotificationViewerGates(args: {
  items: InternalNotificationCandidate[]
  rules: InternalEscalationRuleRow[]
  permissions: OrgPermissions
  assignedWorkOnly: boolean
  assignedScope: AssignedWorkScope | null
  userId: string
  userRawRole: string | null
}): InternalNotificationCandidate[] {
  const { items, rules, permissions, assignedWorkOnly, assignedScope, userId, userRawRole } = args
  const financialOk = Boolean(permissions.canViewFinancials || permissions.canViewBilling)
  const ruleById = new Map(rules.map((r) => [r.id, r]))

  return items.filter((c) => {
    const rule = ruleById.get(c.ruleId)
    if (rule && !recipientMatchesRule(rule, userId, userRawRole)) return false
    if (c.eventType === "invoice_overdue" && !financialOk) return false
    if (assignedWorkOnly) {
      if (!candidateInAssignedScope(c, assignedScope)) return false
    }
    return true
  })
}
