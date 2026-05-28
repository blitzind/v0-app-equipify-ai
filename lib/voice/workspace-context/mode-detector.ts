/** Workspace mode detection — UX context only, no autonomous mutation. */

import type { VoiceWorkspaceContextInput, VoiceWorkspaceMode } from "@/lib/voice/workspace-context/types"

export function detectWorkspaceMode(input: VoiceWorkspaceContextInput): VoiceWorkspaceMode {
  if (input.hasComplianceHold) return "compliance_attention"
  if ((input.escalationLevel ?? 0) >= 1 || (input.operatorAssistEscalationCount ?? 0) > 0) {
    return "escalation"
  }
  if (input.hasAiReceptionistHandoff) return "ai_handoff"
  if (input.hasMissedCallRecovery) return "callback_recovery"
  if (input.hasOutboundAiSupervision) return "outbound_supervision"
  if ((input.unresolvedIssueCount ?? 0) > 0 && input.callPhase === "wrapup") return "workflow_resolution"
  if (input.startingCall) return "dialing"
  if (input.callPhase === "active" || input.callPhase === "bridge_pending" || input.callPhase === "incoming") {
    return "live_call"
  }
  return "idle"
}

export function workspaceModeLabel(mode: VoiceWorkspaceMode): string {
  switch (mode) {
    case "idle":
      return "Ready"
    case "dialing":
      return "Dialing"
    case "live_call":
      return "Live call"
    case "escalation":
      return "Escalation active"
    case "callback_recovery":
      return "Callback recovery"
    case "ai_handoff":
      return "AI handoff"
    case "outbound_supervision":
      return "Outbound supervision"
    case "workflow_resolution":
      return "Workflow resolution"
    case "compliance_attention":
      return "Compliance attention"
    default:
      return mode
  }
}

export function shouldExpandContextRail(mode: VoiceWorkspaceMode): boolean {
  return mode !== "idle" && mode !== "dialing"
}
