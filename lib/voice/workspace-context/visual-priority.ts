/** Visual priority mapping — consistent badge hierarchy. */

import type { VoiceWorkspaceMode, VoiceWorkspaceVisualPriority } from "@/lib/voice/workspace-context/types"

export function visualPriorityForMode(mode: VoiceWorkspaceMode): VoiceWorkspaceVisualPriority {
  switch (mode) {
    case "compliance_attention":
      return "blocked"
    case "escalation":
      return "escalated"
    case "workflow_resolution":
      return "awaiting"
    case "live_call":
    case "ai_handoff":
    case "outbound_supervision":
      return "active"
    case "callback_recovery":
      return "awaiting"
    case "dialing":
      return "active"
    case "idle":
    default:
      return "resolved"
  }
}

export function growthBadgeToneForPriority(
  priority: VoiceWorkspaceVisualPriority,
): "healthy" | "attention" | "neutral" | "medium" {
  switch (priority) {
    case "critical":
    case "escalated":
      return "attention"
    case "active":
      return "healthy"
    case "blocked":
      return "attention"
    case "awaiting":
      return "medium"
    case "resolved":
    default:
      return "neutral"
  }
}

export function priorityLabel(priority: VoiceWorkspaceVisualPriority): string {
  switch (priority) {
    case "critical":
      return "Critical"
    case "escalated":
      return "Escalated"
    case "blocked":
      return "Blocked"
    case "active":
      return "Active"
    case "awaiting":
      return "Awaiting"
    case "resolved":
      return "Ready"
    default:
      return priority
  }
}
