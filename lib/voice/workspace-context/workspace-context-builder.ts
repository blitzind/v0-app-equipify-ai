/** Workspace context snapshot builder — UX coordination only. */

import { buildContextualActions } from "@/lib/voice/workspace-context/action-prioritization"
import { detectWorkspaceMode, shouldExpandContextRail, workspaceModeLabel } from "@/lib/voice/workspace-context/mode-detector"
import { prioritizeWorkspacePanels } from "@/lib/voice/workspace-context/panel-prioritization"
import {
  shouldDeferAnalyticsRendering,
  shouldCapRealtimeUpdates,
} from "@/lib/voice/workspace-context/performance-controls"
import { collapseRailByDefault } from "@/lib/voice/workspace-context/progressive-disclosure"
import {
  VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER,
  type VoiceWorkspaceActiveWorkflowItem,
  type VoiceWorkspaceContextInput,
  type VoiceWorkspaceContextSnapshot,
  type VoiceWorkspaceVisualPriority,
} from "@/lib/voice/workspace-context/types"
import { visualPriorityForMode } from "@/lib/voice/workspace-context/visual-priority"

export function buildActiveWorkflowItems(input: VoiceWorkspaceContextInput): VoiceWorkspaceActiveWorkflowItem[] {
  const items: VoiceWorkspaceActiveWorkflowItem[] = []

  if (input.hasMissedCallRecovery) {
    items.push({
      id: "callback_recovery",
      label: "Callback recovery",
      workflowType: "callback_recovery",
      priority: "awaiting",
      statusLabel: "Pending operator",
    })
  }
  if (input.hasAiReceptionistHandoff) {
    items.push({
      id: "ai_handoff",
      label: "AI receptionist handoff",
      workflowType: "ai_receptionist_handoff",
      priority: "active",
      statusLabel: "Review handoff",
    })
  }
  if ((input.operatorAssistEscalationCount ?? 0) > 0 || (input.escalationLevel ?? 0) >= 1) {
    items.push({
      id: "escalation",
      label: "Escalation active",
      workflowType: "escalation_recovery",
      priority: "escalated",
      statusLabel: `Level ${input.escalationLevel ?? 1}`,
    })
  }
  if (input.hasComplianceHold) {
    items.push({
      id: "compliance_hold",
      label: "Compliance hold",
      workflowType: "compliance_hold",
      priority: "blocked",
      statusLabel: "Review required",
    })
  }
  if (input.hasOutboundAiSupervision) {
    items.push({
      id: "outbound_supervision",
      label: "Outbound AI supervision",
      workflowType: "outbound_followup",
      priority: "active",
      statusLabel: "Operator review",
    })
  }
  if ((input.unresolvedIssueCount ?? 0) > 0) {
    items.push({
      id: "unresolved_issues",
      label: "Unresolved issues",
      workflowType: "unresolved_issue",
      priority: "awaiting",
      statusLabel: String(input.unresolvedIssueCount),
    })
  }

  return items.slice(0, 6)
}

export function buildWorkspaceContextSnapshot(input: VoiceWorkspaceContextInput): VoiceWorkspaceContextSnapshot {
  const mode = detectWorkspaceMode(input)
  const visualPriority: VoiceWorkspaceVisualPriority = visualPriorityForMode(mode)
  const panels = prioritizeWorkspacePanels(mode)
  const contextRailExpanded = shouldExpandContextRail(mode) && !collapseRailByDefault(mode)

  const focusSummary =
    input.relationshipSummary ??
    (input.leadLinked ? "Relationship workflow active — review continuity before next action." : "No lead linked — attach context to reduce switching.")

  return {
    qaMarker: VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER,
    mode,
    modeLabel: workspaceModeLabel(mode),
    contextRailExpanded,
    focusSummary,
    nextBestAction: input.nextRecommendedAction ?? null,
    panels,
    contextualActions: buildContextualActions(mode),
    activeWorkflowItems: buildActiveWorkflowItems(input),
    visualPriority,
    deferredAnalytics: shouldDeferAnalyticsRendering(mode),
    cappedRealtimeUpdates: shouldCapRealtimeUpdates(mode),
    message: "Unified operator workspace — contextual layout only, operator-controlled.",
  }
}
