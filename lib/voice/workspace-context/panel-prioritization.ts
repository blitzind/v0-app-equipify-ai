/** Panel prioritization — visibility and emphasis by workspace mode. */

import type {
  VoiceWorkspaceMode,
  VoiceWorkspacePanelId,
  VoiceWorkspacePanelVisibility,
  VoiceWorkspaceVisualPriority,
} from "@/lib/voice/workspace-context/types"

function panel(
  panelId: VoiceWorkspacePanelId,
  visible: boolean,
  expanded: boolean,
  priority: VoiceWorkspaceVisualPriority,
): VoiceWorkspacePanelVisibility {
  return { panelId, visible, expanded, priority }
}

export function prioritizeWorkspacePanels(mode: VoiceWorkspaceMode): VoiceWorkspacePanelVisibility[] {
  const base: VoiceWorkspacePanelVisibility[] = [
    panel("relationship_context", true, false, "active"),
    panel("next_best_action", true, false, "active"),
    panel("communication_continuity", true, false, "awaiting"),
    panel("escalation_state", false, false, "awaiting"),
    panel("workflow_status", true, false, "awaiting"),
    panel("copilot_inline", true, false, "active"),
    panel("deep_analytics", false, false, "awaiting"),
    panel("observability", false, false, "awaiting"),
    panel("orchestration_timeline", false, false, "awaiting"),
    panel("revenue_intelligence", false, false, "awaiting"),
    panel("retention_intelligence", false, false, "awaiting"),
    panel("relationship_memory", false, false, "awaiting"),
    panel("lead_search", true, false, "active"),
  ]

  switch (mode) {
    case "escalation":
      return applyMode(base, {
        escalation_state: { visible: true, expanded: true, priority: "escalated" },
        next_best_action: { expanded: true, priority: "critical" },
        copilot_inline: { expanded: true, priority: "active" },
        deep_analytics: { visible: false },
      })
    case "ai_handoff":
      return applyMode(base, {
        copilot_inline: { visible: true, expanded: true, priority: "critical" },
        relationship_context: { expanded: true, priority: "active" },
        workflow_status: { expanded: true, priority: "active" },
      })
    case "callback_recovery":
      return applyMode(base, {
        workflow_status: { visible: true, expanded: true, priority: "active" },
        next_best_action: { expanded: true, priority: "active" },
        communication_continuity: { expanded: true, priority: "active" },
      })
    case "outbound_supervision":
      return applyMode(base, {
        copilot_inline: { visible: true, expanded: true, priority: "active" },
        workflow_status: { expanded: true, priority: "awaiting" },
      })
    case "compliance_attention":
      return applyMode(base, {
        workflow_status: { visible: true, expanded: true, priority: "blocked" },
        escalation_state: { visible: true, expanded: true, priority: "blocked" },
        deep_analytics: { visible: false },
        observability: { visible: false },
      })
    case "workflow_resolution":
      return applyMode(base, {
        next_best_action: { expanded: true, priority: "critical" },
        workflow_status: { expanded: true, priority: "active" },
        relationship_memory: { visible: true, expanded: false, priority: "awaiting" },
      })
    case "live_call":
      return applyMode(base, {
        relationship_context: { expanded: true, priority: "active" },
        copilot_inline: { visible: true, expanded: true, priority: "active" },
        next_best_action: { expanded: true, priority: "active" },
        relationship_memory: { visible: true, expanded: false, priority: "awaiting" },
      })
    case "dialing":
      return applyMode(base, {
        lead_search: { visible: true, expanded: true, priority: "active" },
        relationship_context: { visible: false },
        deep_analytics: { visible: false },
      })
    case "idle":
    default:
      return applyMode(base, {
        lead_search: { visible: true, expanded: false, priority: "awaiting" },
        deep_analytics: { visible: false },
        observability: { visible: false },
        orchestration_timeline: { visible: false },
        revenue_intelligence: { visible: false },
        retention_intelligence: { visible: false },
        relationship_memory: { visible: false },
      })
  }
}

function applyMode(
  panels: VoiceWorkspacePanelVisibility[],
  overrides: Partial<
    Record<VoiceWorkspacePanelId, Partial<Pick<VoiceWorkspacePanelVisibility, "visible" | "expanded" | "priority">>>
  >,
): VoiceWorkspacePanelVisibility[] {
  return panels.map((p) => {
    const override = overrides[p.panelId]
    if (!override) return p
    return {
      ...p,
      ...override,
    }
  })
}

export function isPanelExpanded(
  panels: VoiceWorkspacePanelVisibility[],
  panelId: VoiceWorkspacePanelId,
): boolean {
  return panels.find((p) => p.panelId === panelId)?.expanded ?? false
}

export function isPanelVisible(
  panels: VoiceWorkspacePanelVisibility[],
  panelId: VoiceWorkspacePanelId,
): boolean {
  return panels.find((p) => p.panelId === panelId)?.visible ?? false
}
