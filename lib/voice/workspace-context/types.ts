/** Unified operator workspace context — UX refinement (client-safe). */

export const VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER = "voice-unified-operator-workspace-ux-v1" as const

export const VOICE_WORKSPACE_MODES = [
  "idle",
  "dialing",
  "live_call",
  "escalation",
  "callback_recovery",
  "ai_handoff",
  "outbound_supervision",
  "workflow_resolution",
  "compliance_attention",
] as const

export type VoiceWorkspaceMode = (typeof VOICE_WORKSPACE_MODES)[number]

export const VOICE_WORKSPACE_PANEL_IDS = [
  "relationship_context",
  "next_best_action",
  "communication_continuity",
  "escalation_state",
  "workflow_status",
  "copilot_inline",
  "deep_analytics",
  "observability",
  "orchestration_timeline",
  "revenue_intelligence",
  "retention_intelligence",
  "relationship_memory",
  "lead_search",
] as const

export type VoiceWorkspacePanelId = (typeof VOICE_WORKSPACE_PANEL_IDS)[number]

export type VoiceWorkspaceVisualPriority = "critical" | "active" | "awaiting" | "escalated" | "blocked" | "resolved"

export type VoiceWorkspacePanelVisibility = {
  panelId: VoiceWorkspacePanelId
  visible: boolean
  expanded: boolean
  priority: VoiceWorkspaceVisualPriority
}

export type VoiceWorkspaceContextualAction = {
  id: string
  label: string
  elevated: boolean
  reason: string
}

export type VoiceWorkspaceActiveWorkflowItem = {
  id: string
  label: string
  workflowType: string
  priority: VoiceWorkspaceVisualPriority
  statusLabel: string
}

export type VoiceWorkspaceTimelineGroup = {
  groupKey: string
  label: string
  eventCount: number
  summary: string
  latestAt: string
  collapsed: boolean
}

export type VoiceWorkspaceContextSnapshot = {
  qaMarker: typeof VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER
  mode: VoiceWorkspaceMode
  modeLabel: string
  contextRailExpanded: boolean
  focusSummary: string
  nextBestAction: string | null
  panels: VoiceWorkspacePanelVisibility[]
  contextualActions: VoiceWorkspaceContextualAction[]
  activeWorkflowItems: VoiceWorkspaceActiveWorkflowItem[]
  visualPriority: VoiceWorkspaceVisualPriority
  deferredAnalytics: boolean
  cappedRealtimeUpdates: boolean
  message: string
}

export const VOICE_WORKSPACE_REALTIME_UPDATE_CAP = 12 as const
export const VOICE_WORKSPACE_DEFERRED_ANALYTICS_MODES: VoiceWorkspaceMode[] = ["idle", "dialing"]

export type VoiceWorkspaceContextInput = {
  callPhase: "idle" | "incoming" | "bridge_pending" | "active" | "wrapup"
  startingCall?: boolean
  operatorAssistEscalationCount?: number
  hasAiReceptionistHandoff?: boolean
  hasMissedCallRecovery?: boolean
  hasOutboundAiSupervision?: boolean
  hasComplianceHold?: boolean
  unresolvedIssueCount?: number
  escalationLevel?: number
  preferredChannel?: string | null
  workflowStatusLabel?: string | null
  nextRecommendedAction?: string | null
  relationshipSummary?: string | null
  leadLinked?: boolean
}
