import type {
  GrowthBrowserAudioCaptureState,
  GrowthBrowserAudioCaptureStatus,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import { initialBrowserAudioCaptureState } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"

export type BrowserAudioCaptureAction =
  | { type: "reset" }
  | { type: "request_permission" }
  | { type: "capture_active" }
  | { type: "capture_paused" }
  | { type: "capture_stopped" }
  | { type: "capture_failed"; error: string }
  | { type: "set_muted"; muted: boolean }
  | {
      type: "set_capture_source"
      captureSourceMode: GrowthBrowserAudioCaptureState["captureSourceMode"]
      mixedAudioEnabled?: boolean
    }
  | {
      type: "meeting_context"
      meetingProvider: GrowthBrowserAudioCaptureState["meetingProvider"]
      meetingAudioActive: boolean
      microphoneActive: boolean
      mixedAudioActive: boolean
    }
  | {
      type: "chunk_sent"
      latencyMs: number
      providerTranscriptLatencyMs?: number
    }
  | { type: "chunk_failed" }

export function browserAudioCaptureReducer(
  state: GrowthBrowserAudioCaptureState,
  action: BrowserAudioCaptureAction,
): GrowthBrowserAudioCaptureState {
  switch (action.type) {
    case "reset":
      return initialBrowserAudioCaptureState()
    case "request_permission":
      return { ...state, status: "requesting", error: null }
    case "capture_active":
      return { ...state, status: "active", error: null }
    case "capture_paused":
      return state.status === "active" || state.status === "paused"
        ? { ...state, status: "paused" }
        : state
    case "capture_stopped":
      return { ...state, status: "stopped", muted: false }
    case "capture_failed":
      return { ...state, status: "failed", error: action.error }
    case "set_muted":
      return { ...state, muted: action.muted }
    case "set_capture_source":
      return {
        ...state,
        captureSourceMode: action.captureSourceMode,
        mixedAudioEnabled: action.mixedAudioEnabled ?? state.mixedAudioEnabled,
      }
    case "meeting_context":
      return {
        ...state,
        meetingProvider: action.meetingProvider,
        meetingAudioActive: action.meetingAudioActive,
        microphoneActive: action.microphoneActive,
        mixedAudioActive: action.mixedAudioActive,
      }
    case "chunk_sent": {
      const nextCount = state.metrics.chunkCount + 1
      const prevTotal = state.metrics.averageChunkSendLatencyMs * state.metrics.chunkCount
      return {
        ...state,
        metrics: {
          ...state.metrics,
          chunkCount: nextCount,
          averageChunkSendLatencyMs: Math.round((prevTotal + action.latencyMs) / nextCount),
          providerTranscriptLatencyMs:
            action.providerTranscriptLatencyMs ?? state.metrics.providerTranscriptLatencyMs,
          lastChunkAt: new Date().toISOString(),
        },
      }
    }
    case "chunk_failed":
      return {
        ...state,
        metrics: {
          ...state.metrics,
          failedChunkCount: state.metrics.failedChunkCount + 1,
        },
      }
    default:
      return state
  }
}

export function browserAudioCaptureStatusLabel(status: GrowthBrowserAudioCaptureStatus): string {
  return status.replace(/_/g, " ")
}
