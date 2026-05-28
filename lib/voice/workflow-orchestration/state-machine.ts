/** Workflow orchestration state machine — Phase 5C. */

import type {
  VoiceWorkflowOrchestrationStatus,
  VoiceWorkflowOrchestrationType,
} from "@/lib/voice/workflow-orchestration/types"

export type WorkflowTransitionInput = {
  currentStatus: VoiceWorkflowOrchestrationStatus
  action:
    | "activate"
    | "assign_operator"
    | "await_customer"
    | "compliance_hold"
    | "escalate"
    | "block"
    | "resolve"
    | "cancel"
    | "expire"
  complianceBlocked?: boolean
  operatorAssigned?: boolean
  customerResponded?: boolean
}

export type WorkflowTransitionResult = {
  status: VoiceWorkflowOrchestrationStatus
  escalationLevelDelta: number
  allowed: boolean
  reason: string | null
}

const TERMINAL: VoiceWorkflowOrchestrationStatus[] = ["completed", "canceled", "expired"]

export function isTerminalWorkflowStatus(status: VoiceWorkflowOrchestrationStatus): boolean {
  return TERMINAL.includes(status)
}

export function transitionWorkflowStatus(input: WorkflowTransitionInput): WorkflowTransitionResult {
  if (isTerminalWorkflowStatus(input.currentStatus)) {
    return { status: input.currentStatus, escalationLevelDelta: 0, allowed: false, reason: "Workflow already terminal." }
  }

  if (input.complianceBlocked || input.action === "compliance_hold") {
    return {
      status: "compliance_hold",
      escalationLevelDelta: 0,
      allowed: true,
      reason: null,
    }
  }

  switch (input.action) {
    case "activate":
      if (input.currentStatus === "pending") {
        return { status: "active", escalationLevelDelta: 0, allowed: true, reason: null }
      }
      break
    case "assign_operator":
      return {
        status: input.operatorAssigned ? "active" : "awaiting_operator",
        escalationLevelDelta: 0,
        allowed: true,
        reason: null,
      }
    case "await_customer":
      return { status: "awaiting_customer", escalationLevelDelta: 0, allowed: true, reason: null }
    case "escalate":
      return { status: "escalated", escalationLevelDelta: 1, allowed: true, reason: null }
    case "block":
      return { status: "blocked", escalationLevelDelta: 0, allowed: true, reason: null }
    case "resolve":
      return { status: "completed", escalationLevelDelta: 0, allowed: true, reason: null }
    case "cancel":
      return { status: "canceled", escalationLevelDelta: 0, allowed: true, reason: null }
    case "expire":
      return { status: "expired", escalationLevelDelta: 0, allowed: true, reason: null }
    default:
      break
  }

  return {
    status: input.currentStatus,
    escalationLevelDelta: 0,
    allowed: false,
    reason: `Transition ${input.action} not allowed from ${input.currentStatus}.`,
  }
}

export function defaultPriorityForType(type: VoiceWorkflowOrchestrationType): number {
  switch (type) {
    case "escalation_recovery":
    case "compliance_hold":
    case "operator_takeover":
      return 90
    case "missed_call_recovery":
    case "callback_followup":
      return 75
    case "unresolved_objection":
    case "retention_recovery":
      return 70
    case "appointment_coordination":
    case "scheduling_followup":
      return 60
    default:
      return 50
  }
}

export function defaultSummaryForType(type: VoiceWorkflowOrchestrationType): string {
  switch (type) {
    case "missed_call_recovery":
      return "Missed-call recovery orchestration — operator callback coordination."
    case "callback_followup":
      return "Callback follow-up orchestration — awaiting operator action."
    case "appointment_coordination":
      return "Appointment coordination — scheduling assistance only."
    case "escalation_recovery":
      return "Escalation recovery — operator supervision required."
    case "ai_receptionist_handoff":
      return "AI receptionist handoff — operator review recommended."
    case "outbound_followup":
      return "Outbound follow-up — approval-gated coordination."
    case "compliance_hold":
      return "Compliance hold — workflow paused pending review."
    default:
      return `Workflow orchestration: ${type.replace(/_/g, " ")}.`
  }
}
