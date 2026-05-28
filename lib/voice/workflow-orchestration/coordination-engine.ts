/** Workflow coordination engine — Phase 5C. No autonomous execution. */

import type {
  VoiceWorkflowOrchestrationEventType,
  VoiceWorkflowOrchestrationPublicView,
  VoiceWorkflowOrchestrationStatus,
} from "@/lib/voice/workflow-orchestration/types"
import { generateWorkflowRecommendation } from "@/lib/voice/workflow-orchestration/recommendations"
import {
  isTerminalWorkflowStatus,
  transitionWorkflowStatus,
  type WorkflowTransitionInput,
} from "@/lib/voice/workflow-orchestration/state-machine"
import type { WorkflowOrchestrationAction } from "@/lib/voice/workflow-orchestration/types"

export type WorkflowCoordinationResult = {
  nextStatus: VoiceWorkflowOrchestrationStatus
  escalationLevelDelta: number
  eventType: VoiceWorkflowOrchestrationEventType
  evidenceText: string
  nextRecommendedAction: string | null
  blockedReason: string | null
  allowed: boolean
  reason: string | null
}

export function mapActionToTransition(
  action: WorkflowOrchestrationAction,
): WorkflowTransitionInput["action"] {
  switch (action) {
    case "assign_operator":
      return "assign_operator"
    case "escalate":
      return "escalate"
    case "resolve":
      return "resolve"
    case "cancel":
      return "cancel"
    case "compliance_hold":
      return "compliance_hold"
    case "operator_override":
      return "activate"
    case "recommend_followup":
      return "await_customer"
    default:
      return "activate"
  }
}

export function coordinateWorkflowAction(input: {
  orchestration: VoiceWorkflowOrchestrationPublicView
  action: WorkflowOrchestrationAction
  operatorId?: string | null
  blockedReason?: string | null
  complianceState?: string | null
}): WorkflowCoordinationResult {
  const { orchestration, action } = input

  if (isTerminalWorkflowStatus(orchestration.orchestrationStatus)) {
    return {
      nextStatus: orchestration.orchestrationStatus,
      escalationLevelDelta: 0,
      eventType: "operator_override",
      evidenceText: "Workflow already terminal — no transition applied.",
      nextRecommendedAction: null,
      blockedReason: null,
      allowed: false,
      reason: "Workflow already terminal.",
    }
  }

  const transitionAction = mapActionToTransition(action)
  const transition = transitionWorkflowStatus({
    currentStatus: orchestration.orchestrationStatus,
    action: transitionAction,
    complianceBlocked: action === "compliance_hold" || Boolean(input.complianceState),
    operatorAssigned: Boolean(input.operatorId ?? orchestration.assignedOperatorId),
  })

  if (!transition.allowed) {
    return {
      nextStatus: orchestration.orchestrationStatus,
      escalationLevelDelta: 0,
      eventType: "operator_override",
      evidenceText: transition.reason ?? "Transition not allowed.",
      nextRecommendedAction: orchestration.nextRecommendedAction,
      blockedReason: orchestration.blockedReason,
      allowed: false,
      reason: transition.reason,
    }
  }

  const recommendation = generateWorkflowRecommendation({
    orchestrationType: orchestration.orchestrationType,
    orchestrationStatus: transition.status,
    escalationLevel: orchestration.escalationLevel + transition.escalationLevelDelta,
    blockedReason: input.blockedReason ?? orchestration.blockedReason,
    complianceState: input.complianceState ?? orchestration.complianceState,
  })

  const eventType = eventTypeForAction(action, transition.status)
  const evidenceText = evidenceForAction(action, orchestration, input.operatorId)

  return {
    nextStatus: transition.status,
    escalationLevelDelta: transition.escalationLevelDelta,
    eventType,
    evidenceText,
    nextRecommendedAction: recommendation.action,
    blockedReason:
      action === "compliance_hold" || transition.status === "blocked"
        ? input.blockedReason ?? orchestration.blockedReason ?? "Operator hold."
        : null,
    allowed: true,
    reason: null,
  }
}

function eventTypeForAction(
  action: WorkflowOrchestrationAction,
  nextStatus: VoiceWorkflowOrchestrationStatus,
): VoiceWorkflowOrchestrationEventType {
  switch (action) {
    case "assign_operator":
      return "workflow_assigned"
    case "escalate":
      return "escalation_triggered"
    case "resolve":
      return "workflow_resolved"
    case "cancel":
      return "workflow_resolved"
    case "compliance_hold":
      return "compliance_hold_added"
    case "operator_override":
      return "operator_override"
    case "recommend_followup":
      return "followup_recommended"
    default:
      if (nextStatus === "expired") return "workflow_expired"
      if (nextStatus === "blocked") return "workflow_blocked"
      return "operator_override"
  }
}

function evidenceForAction(
  action: WorkflowOrchestrationAction,
  orchestration: VoiceWorkflowOrchestrationPublicView,
  operatorId?: string | null,
): string {
  switch (action) {
    case "assign_operator":
      return operatorId
        ? `Operator ${operatorId} assigned by operator action.`
        : "Operator assignment requested — awaiting operator claim."
    case "escalate":
      return `Escalation triggered — level ${orchestration.escalationLevel + 1}.`
    case "resolve":
      return "Workflow resolved by operator."
    case "cancel":
      return "Workflow canceled by operator."
    case "compliance_hold":
      return "Compliance hold applied — operator review required."
    case "recommend_followup":
      return "Follow-up recommended — no autonomous execution."
    default:
      return `Operator action: ${action}.`
  }
}

export function detectBlockedWorkflowDependencies(
  orchestrations: VoiceWorkflowOrchestrationPublicView[],
): Array<{ orchestrationId: string; blockedBy: string; reason: string }> {
  const complianceBlocked = orchestrations.filter((o) => o.orchestrationStatus === "compliance_hold")
  const deps: Array<{ orchestrationId: string; blockedBy: string; reason: string }> = []

  for (const o of orchestrations.filter((w) => w.orchestrationStatus === "blocked")) {
    const relatedCompliance = complianceBlocked.find(
      (c) =>
        c.relatedCustomerId === o.relatedCustomerId ||
        c.sourceCallId === o.sourceCallId ||
        c.sourceSessionId === o.sourceSessionId,
    )
    if (relatedCompliance) {
      deps.push({
        orchestrationId: o.id,
        blockedBy: relatedCompliance.id,
        reason: "Related compliance hold blocks progression.",
      })
    }
  }

  return deps
}

export function escalationProgressionLevel(currentLevel: number, delta: number): number {
  return Math.min(currentLevel + delta, 5)
}
