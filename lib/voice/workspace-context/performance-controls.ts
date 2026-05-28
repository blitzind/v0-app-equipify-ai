/** Performance safeguards for workspace UX — caps and deferral flags. */

import {
  VOICE_WORKSPACE_DEFERRED_ANALYTICS_MODES,
  VOICE_WORKSPACE_REALTIME_UPDATE_CAP,
  type VoiceWorkspaceMode,
} from "@/lib/voice/workspace-context/types"

export function shouldDeferAnalyticsRendering(mode: VoiceWorkspaceMode): boolean {
  return VOICE_WORKSPACE_DEFERRED_ANALYTICS_MODES.includes(mode)
}

export function shouldCapRealtimeUpdates(mode: VoiceWorkspaceMode): boolean {
  return mode === "live_call" || mode === "escalation" || mode === "ai_handoff"
}

export function realtimeUpdateCap(mode: VoiceWorkspaceMode): number {
  if (shouldCapRealtimeUpdates(mode)) return VOICE_WORKSPACE_REALTIME_UPDATE_CAP
  return VOICE_WORKSPACE_REALTIME_UPDATE_CAP * 2
}

export function shouldLazyLoadExpandedPanels(mode: VoiceWorkspaceMode): boolean {
  return mode === "idle" || mode === "dialing"
}
