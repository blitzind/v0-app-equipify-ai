/** Bounded workflow recommendations — Phase 5C. Evidence-backed, no auto-execution. */

import type {
  VoiceWorkflowOrchestrationPublicView,
  VoiceWorkflowOrchestrationType,
  VoiceWorkflowRecommendation,
} from "@/lib/voice/workflow-orchestration/types"
import {
  VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
} from "@/lib/voice/workflow-orchestration/types"

export function generateWorkflowRecommendation(
  orchestration: Pick<
    VoiceWorkflowOrchestrationPublicView,
    "orchestrationType" | "orchestrationStatus" | "escalationLevel" | "blockedReason" | "complianceState"
  >,
): VoiceWorkflowRecommendation {
  if (orchestration.orchestrationStatus === "compliance_hold" || orchestration.complianceState) {
    return {
      action: "Review compliance hold and resolve blocking reason before proceeding.",
      evidence: orchestration.blockedReason ?? orchestration.complianceState ?? "Compliance hold active.",
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
    }
  }

  if (orchestration.orchestrationStatus === "blocked") {
    return {
      action: "Review blocked reason and operator-override if appropriate.",
      evidence: orchestration.blockedReason ?? "Workflow blocked.",
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
    }
  }

  if (orchestration.orchestrationStatus === "escalated" || orchestration.escalationLevel >= 2) {
    return {
      action: "Assign escalation specialist or join workflow as operator.",
      evidence: `Escalation level ${orchestration.escalationLevel}.`,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
    }
  }

  if (orchestration.orchestrationStatus === "awaiting_operator") {
    return {
      action: "Assign operator or claim workflow.",
      evidence: "No operator assigned.",
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
    }
  }

  const typeAction = recommendationForType(orchestration.orchestrationType)
  return {
    action: typeAction.action,
    evidence: typeAction.evidence,
    requiresOperatorReview: true,
    autonomousExecutionDisabled: VOICE_WORKFLOW_AUTONOMOUS_EXECUTION_DISABLED,
  }
}

function recommendationForType(type: VoiceWorkflowOrchestrationType): { action: string; evidence: string } {
  switch (type) {
    case "missed_call_recovery":
      return { action: "Review missed-call context and initiate manual callback.", evidence: "Missed-call recovery workflow." }
    case "callback_followup":
      return { action: "Confirm callback window with customer.", evidence: "Callback follow-up pending." }
    case "appointment_coordination":
      return { action: "Coordinate scheduling with operator confirmation.", evidence: "No autonomous booking." }
    case "ai_receptionist_handoff":
      return { action: "Review AI handoff summary and join call if needed.", evidence: "Receptionist handoff pending." }
    case "outbound_followup":
      return { action: "Approve outbound session before initiation.", evidence: "Outbound approval required." }
    case "unresolved_objection":
      return { action: "Review objection evidence and plan follow-up.", evidence: "Unresolved objection tracked." }
    case "retention_recovery":
      return { action: "Review retention signals and operator outreach plan.", evidence: "Retention recovery workflow." }
    default:
      return { action: "Review workflow timeline and take next operator action.", evidence: `Workflow type: ${type}.` }
  }
}
