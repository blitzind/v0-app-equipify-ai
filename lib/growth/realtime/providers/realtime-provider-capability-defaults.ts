/** Client-safe static provider capability defaults (Growth Engine slice 6.12F). */

import { providerSupportsBrowserAudioStreaming } from "@/lib/growth/realtime/browser-audio/browser-audio-stream-types"
import type {
  RealtimeProviderCapabilitySnapshot,
  RealtimeProviderId,
} from "@/lib/growth/realtime/providers/provider-types"

const LIVE_GUIDANCE_COMPATIBLE_PROVIDER_IDS: ReadonlySet<RealtimeProviderId> = new Set([
  "deepgram",
  "assemblyai",
  "openai_realtime",
  "custom",
])

export function resolveRealtimeProviderBrowserMicSupported(input: {
  providerId: string
  capabilitySnapshot: RealtimeProviderCapabilitySnapshot
}): boolean {
  if (input.capabilitySnapshot.browserAudioStreaming) return true
  return providerSupportsBrowserAudioStreaming(input.providerId)
}

export function resolveRealtimeProviderLiveTranscriptSupported(input: {
  providerId: string
  capabilitySnapshot: RealtimeProviderCapabilitySnapshot
}): boolean {
  if (input.capabilitySnapshot.liveTranscriptStreaming) return true
  return resolveRealtimeProviderBrowserMicSupported(input)
}

export function resolveRealtimeProviderLiveGuidanceCompatible(input: {
  providerId: string
  capabilitySnapshot: RealtimeProviderCapabilitySnapshot
}): boolean {
  if (input.capabilitySnapshot.liveGuidanceCompatible) return true
  return LIVE_GUIDANCE_COMPATIBLE_PROVIDER_IDS.has(input.providerId as RealtimeProviderId)
}
