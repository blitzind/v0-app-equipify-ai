/** Progressive disclosure rules — UX only. */

import type { VoiceWorkspaceMode, VoiceWorkspacePanelId } from "@/lib/voice/workspace-context/types"

export function shouldShowDeepAnalytics(mode: VoiceWorkspaceMode, operatorExpanded: boolean): boolean {
  if (operatorExpanded) return true
  return mode === "escalation" || mode === "workflow_resolution"
}

export function shouldShowObservabilityDetails(mode: VoiceWorkspaceMode, operatorExpanded: boolean): boolean {
  if (operatorExpanded) return true
  return mode === "compliance_attention"
}

export function shouldDeferSecondaryIntelligence(mode: VoiceWorkspaceMode): boolean {
  return mode === "idle" || mode === "dialing" || mode === "live_call"
}

export function defaultExpandedSections(mode: VoiceWorkspaceMode): VoiceWorkspacePanelId[] {
  switch (mode) {
    case "escalation":
      return ["escalation_state", "next_best_action", "copilot_inline"]
    case "ai_handoff":
      return ["copilot_inline", "relationship_context"]
    case "callback_recovery":
      return ["workflow_status", "next_best_action"]
    case "compliance_attention":
      return ["workflow_status", "escalation_state"]
    case "live_call":
      return ["copilot_inline", "relationship_context", "next_best_action"]
    default:
      return ["next_best_action"]
  }
}

export function collapseRailByDefault(mode: VoiceWorkspaceMode): boolean {
  return mode === "idle"
}
