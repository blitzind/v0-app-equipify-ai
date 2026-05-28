/** Contextual action prioritization — elevates controls by mode, no auto-execution. */

import type {
  VoiceWorkspaceContextualAction,
  VoiceWorkspaceMode,
} from "@/lib/voice/workspace-context/types"

export function buildContextualActions(mode: VoiceWorkspaceMode): VoiceWorkspaceContextualAction[] {
  const actions: VoiceWorkspaceContextualAction[] = [
    { id: "dial", label: "Start call", elevated: mode === "idle", reason: "Primary idle action." },
    { id: "answer", label: "Answer", elevated: mode === "live_call", reason: "Incoming call handling." },
    { id: "transfer", label: "Transfer", elevated: mode === "escalation", reason: "Escalation routing visibility." },
    { id: "takeover", label: "Operator takeover", elevated: mode === "ai_handoff", reason: "AI handoff requires operator." },
    { id: "callback", label: "Schedule callback", elevated: mode === "callback_recovery", reason: "Callback workflow active." },
    { id: "resolve", label: "Resolve workflow", elevated: mode === "workflow_resolution", reason: "Unresolved workflow pending." },
    { id: "compliance_review", label: "Review compliance", elevated: mode === "compliance_attention", reason: "Compliance hold active." },
    { id: "supervise_outbound", label: "Supervise outbound", elevated: mode === "outbound_supervision", reason: "Outbound AI supervision." },
  ]

  return actions.filter((a) => a.elevated).concat(actions.filter((a) => !a.elevated)).slice(0, 6)
}

export function primaryElevatedAction(mode: VoiceWorkspaceMode): VoiceWorkspaceContextualAction | null {
  return buildContextualActions(mode).find((a) => a.elevated) ?? null
}
