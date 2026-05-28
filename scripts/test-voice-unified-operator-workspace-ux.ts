/**
 * Unified operator workspace UX refinement — regression checks.
 * Run: pnpm test:voice-unified-operator-workspace-ux
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildContextualActions, primaryElevatedAction } from "../lib/voice/workspace-context/action-prioritization"
import { detectWorkspaceMode, shouldExpandContextRail, workspaceModeLabel } from "../lib/voice/workspace-context/mode-detector"
import {
  isPanelExpanded,
  isPanelVisible,
  prioritizeWorkspacePanels,
} from "../lib/voice/workspace-context/panel-prioritization"
import {
  collapseRailByDefault,
  shouldDeferSecondaryIntelligence,
  shouldShowDeepAnalytics,
} from "../lib/voice/workspace-context/progressive-disclosure"
import {
  capTimelineEvents,
  groupTimelineEvents,
} from "../lib/voice/workspace-context/timeline-simplification"
import {
  realtimeUpdateCap,
  shouldCapRealtimeUpdates,
  shouldDeferAnalyticsRendering,
  shouldLazyLoadExpandedPanels,
} from "../lib/voice/workspace-context/performance-controls"
import { buildWorkspaceContextInputFromVoiceSnapshot } from "../lib/voice/workspace-context/snapshot-input-mapper"
import {
  VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER,
  VOICE_WORKSPACE_MODES,
  VOICE_WORKSPACE_REALTIME_UPDATE_CAP,
} from "../lib/voice/workspace-context/types"
import {
  buildActiveWorkflowItems,
  buildWorkspaceContextSnapshot,
} from "../lib/voice/workspace-context/workspace-context-builder"
import { growthBadgeToneForPriority, visualPriorityForMode } from "../lib/voice/workspace-context/visual-priority"

assert.equal(VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER, "voice-unified-operator-workspace-ux-v1")
assert.equal(VOICE_WORKSPACE_MODES.length, 9)
assert.equal(VOICE_WORKSPACE_REALTIME_UPDATE_CAP, 12)

assert.equal(detectWorkspaceMode({ callPhase: "idle" }), "idle")
assert.equal(detectWorkspaceMode({ callPhase: "idle", startingCall: true }), "dialing")
assert.equal(detectWorkspaceMode({ callPhase: "active" }), "live_call")
assert.equal(detectWorkspaceMode({ callPhase: "active", operatorAssistEscalationCount: 2 }), "escalation")
assert.equal(detectWorkspaceMode({ callPhase: "idle", hasAiReceptionistHandoff: true }), "ai_handoff")
assert.equal(detectWorkspaceMode({ callPhase: "idle", hasMissedCallRecovery: true }), "callback_recovery")
assert.equal(detectWorkspaceMode({ callPhase: "idle", hasComplianceHold: true }), "compliance_attention")

assert.equal(workspaceModeLabel("escalation"), "Escalation active")
assert.equal(shouldExpandContextRail("idle"), false)
assert.equal(shouldExpandContextRail("live_call"), true)

const escalationPanels = prioritizeWorkspacePanels("escalation")
assert.equal(isPanelVisible(escalationPanels, "escalation_state"), true)
assert.equal(isPanelExpanded(escalationPanels, "escalation_state"), true)
assert.equal(isPanelVisible(escalationPanels, "revenue_intelligence"), false)

const idlePanels = prioritizeWorkspacePanels("idle")
assert.equal(isPanelVisible(idlePanels, "revenue_intelligence"), false)
assert.equal(isPanelVisible(idlePanels, "lead_search"), true)

assert.equal(collapseRailByDefault("idle"), true)
assert.equal(shouldDeferSecondaryIntelligence("idle"), true)
assert.equal(shouldDeferSecondaryIntelligence("escalation"), false)
assert.equal(shouldShowDeepAnalytics("idle", false), false)
assert.equal(shouldShowDeepAnalytics("idle", true), true)

const escalationAction = primaryElevatedAction("escalation")
assert.ok(escalationAction)
assert.equal(escalationAction.id, "transfer")
assert.ok(buildContextualActions("callback_recovery").some((action) => action.id === "callback"))

assert.equal(visualPriorityForMode("escalation"), "escalated")
assert.equal(visualPriorityForMode("compliance_attention"), "blocked")
assert.equal(growthBadgeToneForPriority("escalated"), "attention")

const grouped = groupTimelineEvents([
  { id: "1", label: "Transfer started", eventTimestamp: "2026-05-28T10:00:00.000Z" },
  { id: "2", label: "Transfer completed", eventTimestamp: "2026-05-28T10:01:00.000Z" },
  { id: "3", label: "Call connected", eventTimestamp: "2026-05-28T09:59:00.000Z" },
])
assert.equal(grouped.length, 2)
assert.equal(grouped.find((group) => group.groupKey === "transfer")?.eventCount, 2)
assert.equal(capTimelineEvents([1, 2, 3, 4, 5], 3).length, 3)

assert.equal(shouldDeferAnalyticsRendering("idle"), true)
assert.equal(shouldDeferAnalyticsRendering("live_call"), false)
assert.equal(shouldCapRealtimeUpdates("live_call"), true)
assert.equal(realtimeUpdateCap("idle"), VOICE_WORKSPACE_REALTIME_UPDATE_CAP * 2)
assert.equal(shouldLazyLoadExpandedPanels("idle"), true)

const snapshotInput = buildWorkspaceContextInputFromVoiceSnapshot({
  callPhase: "active",
  leadLinked: true,
  operatorAssist: {
    feed: [{ lifecycleStatus: "escalated", severity: "critical", category: "risk" } as never],
    nextBestAction: { primary: { prompt: "Escalate to supervisor" } as never, supporting: [] },
  } as never,
})
assert.equal(snapshotInput.operatorAssistEscalationCount, 1)

const snapshot = buildWorkspaceContextSnapshot({
  callPhase: "active",
  operatorAssistEscalationCount: 1,
  escalationLevel: 1,
  nextRecommendedAction: "Review escalation path",
  leadLinked: true,
})
assert.equal(snapshot.mode, "escalation")
assert.equal(snapshot.qaMarker, VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER)
assert.ok(snapshot.contextualActions.length > 0)

const workflowItems = buildActiveWorkflowItems({
  callPhase: "idle",
  hasMissedCallRecovery: true,
  hasAiReceptionistHandoff: true,
  operatorAssistEscalationCount: 1,
})
assert.equal(workflowItems.length, 3)

const workspaceTsx = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceTsx, /GrowthCallWorkspaceUnifiedContextRail/)
assert.match(workspaceTsx, /GrowthCallWorkspaceActiveWorkflowStrip/)
assert.match(workspaceTsx, /GrowthCallWorkspaceMobileActionBar/)
assert.match(workspaceTsx, /VOICE_UNIFIED_OPERATOR_WORKSPACE_UX_QA_MARKER/)
assert.match(workspaceTsx, /data-voice-unified-operator-workspace-ux-qa-marker/)

const railTsx = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-unified-context-rail.tsx"),
  "utf8",
)
assert.match(railTsx, /Relationship Context/)

console.log("voice-unified-operator-workspace-ux: all checks passed")
