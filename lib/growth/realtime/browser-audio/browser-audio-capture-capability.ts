import {
  GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE,
  GROWTH_BROWSER_AUDIO_PROVIDER_UNAVAILABLE_MESSAGE,
} from "@/lib/growth/realtime/browser-audio/browser-audio-capture-invariants"
import type { GrowthBrowserAudioCaptureCapability } from "@/lib/growth/realtime/browser-audio/browser-audio-capture-types"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"
import { REALTIME_PROVIDER_LABELS } from "@/lib/growth/realtime/browser-audio/provider-labels"
import { providerSupportsBrowserAudioStreaming } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"

type CapabilityInput = {
  session: GrowthRealtimeCallSession | null
  providerHealthy?: boolean
}

export function evaluateBrowserAudioCaptureCapability(input: CapabilityInput): GrowthBrowserAudioCaptureCapability {
  const session = input.session
  if (!session) {
    return {
      canStart: false,
      disabledReason: "Start a realtime coaching session first.",
      providerLabel: null,
      providerHealthy: false,
    }
  }

  if (!["active", "paused"].includes(session.status)) {
    return {
      canStart: false,
      disabledReason: "Go live on the realtime session before starting mic capture.",
      providerLabel: null,
      providerHealthy: false,
    }
  }

  if (session.transcriptSource === "manual" || session.transcriptSource === "stub") {
    return {
      canStart: false,
      disabledReason: GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE,
      providerLabel: session.providerId ? REALTIME_PROVIDER_LABELS[session.providerId] ?? session.providerId : null,
      providerHealthy: false,
    }
  }

  if (session.transcriptSource !== "provider" && session.transcriptSource !== "browser_mic") {
    return {
      canStart: false,
      disabledReason: GROWTH_BROWSER_AUDIO_PROVIDER_UNAVAILABLE_MESSAGE,
      providerLabel: null,
      providerHealthy: false,
    }
  }

  const providerLabel = session.providerId
    ? REALTIME_PROVIDER_LABELS[session.providerId] ?? session.providerId
    : null

  if (session.providerId === "stub" || !session.providerId) {
    return {
      canStart: false,
      disabledReason: GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE,
      providerLabel,
      providerHealthy: false,
    }
  }

  if (!providerSupportsBrowserAudioStreaming(session.providerId)) {
    return {
      canStart: false,
      disabledReason: GROWTH_BROWSER_AUDIO_PROVIDER_UNAVAILABLE_MESSAGE,
      providerLabel,
      providerHealthy: false,
    }
  }

  const providerHealthy = input.providerHealthy ?? session.transcriptStatus === "live"

  if (!providerHealthy) {
    return {
      canStart: false,
      disabledReason: GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE,
      providerLabel,
      providerHealthy: false,
    }
  }

  return {
    canStart: true,
    disabledReason: null,
    providerLabel,
    providerHealthy: true,
  }
}

const MIC_CAPTURE_PROVIDER_IDS = new Set(["deepgram", "assemblyai", "openai_realtime", "custom"])

/** Call Action Sheet hint when a dial session exists — does not require an active realtime session. */
export function resolveCallSheetMicCaptureHint(input: {
  activeProviderConnectionId: string | null
  fallbackProvider: string | null | undefined
}): "start_mic_capture" | "manual_transcript_mode" {
  if (input.activeProviderConnectionId) return "start_mic_capture"
  if (input.fallbackProvider && MIC_CAPTURE_PROVIDER_IDS.has(input.fallbackProvider)) {
    return "start_mic_capture"
  }
  return "manual_transcript_mode"
}
