import "server-only"

import {
  clearBrowserAudioCaptureMetrics,
  clearBrowserAudioChunkSequence,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-service"
import { clearBrowserAudioStreamState } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-manager"
import { clearRealtimeProviderStreamState } from "@/lib/growth/realtime/providers/provider-stream-bridge"

/** Clears all in-memory live coaching session state (Growth Engine slice 6.14A). */
export function clearLiveCoachingSessionMemory(sessionId: string): void {
  clearBrowserAudioStreamState(sessionId)
  clearBrowserAudioCaptureMetrics(sessionId)
  clearBrowserAudioChunkSequence(sessionId)
  clearRealtimeProviderStreamState(sessionId)
}
