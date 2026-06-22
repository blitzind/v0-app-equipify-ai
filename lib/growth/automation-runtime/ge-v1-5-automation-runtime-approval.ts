/** GE-v1-5 — Human approval runtime (client-safe). */

import {
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  isGeV15OutboundCapableAction,
  type GeV15ApprovalStatus,
  type GeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export function resolveGeV15InitialApprovalStatus(
  action: GeV15PreparedAction["action"],
): GeV15ApprovalStatus {
  if (isGeV15OutboundCapableAction(action)) {
    return "pending_approval"
  }
  if (action === "queue_approval_item" || action === "prepare_email" || action === "prepare_sms" || action === "prepare_voice_drop") {
    return "pending_approval"
  }
  return "prepared"
}

export function canGeV15TransitionApproval(
  from: GeV15ApprovalStatus,
  to: GeV15ApprovalStatus,
): boolean {
  const allowed: Record<GeV15ApprovalStatus, GeV15ApprovalStatus[]> = {
    prepared: ["pending_approval", "approved", "rejected"],
    pending_approval: ["approved", "rejected"],
    approved: ["executed", "failed"],
    executed: [],
    rejected: [],
    failed: ["pending_approval"],
  }
  return allowed[from]?.includes(to) ?? false
}

export function transitionGeV15PreparedAction(
  action: GeV15PreparedAction,
  toStatus: GeV15ApprovalStatus,
  input?: { approvedBy?: string | null; now?: Date },
): GeV15PreparedAction {
  const now = (input?.now ?? new Date()).toISOString()
  if (!canGeV15TransitionApproval(action.status, toStatus)) {
    throw new Error(`Invalid approval transition: ${action.status} → ${toStatus}`)
  }

  const updated: GeV15PreparedAction = {
    ...action,
    status: toStatus,
    updatedAt: now,
  }

  if (toStatus === "approved") {
    updated.approvedAt = now
    updated.approvedBy = input?.approvedBy ?? null
  }
  if (toStatus === "executed") {
    updated.executedAt = now
  }

  return updated
}

export function assertGeV15NoApprovalBypass(action: GeV15PreparedAction): void {
  if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.human_approval_required) return
  if (!isGeV15OutboundCapableAction(action.action)) return
  if (action.status === "executed" && !action.approvedAt) {
    throw new Error("Outbound-capable actions cannot execute without approval")
  }
}

export function listGeV15PendingApprovals(
  actions: GeV15PreparedAction[],
): GeV15PreparedAction[] {
  return actions.filter(
    (a) => a.status === "pending_approval" || a.status === "prepared",
  )
}

export function approveGeV15PreparedAction(
  actions: GeV15PreparedAction[],
  actionId: string,
  approvedBy?: string | null,
): GeV15PreparedAction[] {
  return actions.map((action) => {
    if (action.id !== actionId) return action
    return transitionGeV15PreparedAction(action, "approved", { approvedBy })
  })
}

export function rejectGeV15PreparedAction(
  actions: GeV15PreparedAction[],
  actionId: string,
): GeV15PreparedAction[] {
  return actions.map((action) => {
    if (action.id !== actionId) return action
    return transitionGeV15PreparedAction(action, "rejected")
  })
}

export function markGeV15PreparedActionExecuted(
  actions: GeV15PreparedAction[],
  actionId: string,
): GeV15PreparedAction[] {
  if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled) {
    return actions
  }
  return actions.map((action) => {
    if (action.id !== actionId) return action
    assertGeV15NoApprovalBypass(action)
    if (action.status !== "approved") {
      throw new Error("Cannot execute action that is not approved")
    }
    return transitionGeV15PreparedAction(action, "executed")
  })
}
