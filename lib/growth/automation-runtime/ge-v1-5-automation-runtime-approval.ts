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
  input?: { rejectedBy?: string | null; reason?: string | null; now?: Date },
): GeV15PreparedAction[] {
  const now = (input?.now ?? new Date()).toISOString()
  return actions.map((action) => {
    if (action.id !== actionId) return action
    const updated = transitionGeV15PreparedAction(action, "rejected", { now: input?.now })
    return {
      ...updated,
      rejectReason: input?.reason ?? null,
      rejectedBy: input?.rejectedBy ?? null,
      rejectedAt: now,
    }
  })
}

export function editGeV15PreparedAction(
  actions: GeV15PreparedAction[],
  actionId: string,
  input: {
    editedDraftContent?: string | null
    editedSubject?: string | null
    editedBy?: string | null
    now?: Date
  },
): GeV15PreparedAction[] {
  const now = (input.now ?? new Date()).toISOString()
  return actions.map((action) => {
    if (action.id !== actionId) return action
    if (action.status !== "pending_approval" && action.status !== "prepared") {
      throw new Error("Only pending prepared actions can be edited.")
    }
    return {
      ...action,
      originalDraftContent: action.originalDraftContent ?? action.draftContent ?? null,
      editedDraftContent: input.editedDraftContent ?? action.editedDraftContent ?? null,
      editedSubject: input.editedSubject ?? action.editedSubject ?? null,
      editedBy: input.editedBy ?? null,
      editedAt: now,
      updatedAt: now,
    }
  })
}

export function listGeV15ApprovedOutboundActions(
  actions: GeV15PreparedAction[],
): GeV15PreparedAction[] {
  return actions.filter(
    (action) =>
      action.status === "approved" &&
      (action.action === "prepare_email" ||
        action.action === "prepare_sms" ||
        action.action === "prepare_voice_drop"),
  )
}

export function listGeV15OperatorReviewActions(
  actions: GeV15PreparedAction[],
): GeV15PreparedAction[] {
  const seen = new Set<string>()
  const combined = [...listGeV15PendingApprovals(actions), ...listGeV15ApprovedOutboundActions(actions)]
  const result: GeV15PreparedAction[] = []
  for (const action of combined) {
    if (seen.has(action.id)) continue
    seen.add(action.id)
    result.push(action)
  }
  return result.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function markGeV15PreparedActionExecuted(
  actions: GeV15PreparedAction[],
  actionId: string,
): GeV15PreparedAction[] {
  const operatorExecuteEnabled = GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.operator_approved_send_execution_enabled
  const autonomousExecuteEnabled = GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled
  const policyGatedSendEnabled = GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.policy_gated_autonomous_send_enabled
  if (!operatorExecuteEnabled && !autonomousExecuteEnabled && !policyGatedSendEnabled) {
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

export function markGeV15PreparedActionFailed(
  actions: GeV15PreparedAction[],
  actionId: string,
  error: string,
): GeV15PreparedAction[] {
  return actions.map((action) => {
    if (action.id !== actionId) return action
    return {
      ...transitionGeV15PreparedAction(action, "failed"),
      executionError: error,
    }
  })
}
