import type { RealtimeTranscriptProvider } from "@/lib/growth/realtime/providers/provider-types"
import { createRealtimeProviderInstance } from "@/lib/growth/realtime/providers/provider-registry"
import { REALTIME_PROVIDER_IDS } from "@/lib/growth/realtime/providers/provider-types"

export type { RealtimeTranscriptChunk, RealtimeTranscriptProviderHealth } from "@/lib/growth/realtime/realtime-transcript-provider-types"

export const REALTIME_TRANSCRIPT_PROVIDER_IDS = REALTIME_PROVIDER_IDS

export function createRealtimeTranscriptProvider(providerId: string): RealtimeTranscriptProvider {
  return createRealtimeProviderInstance(providerId)
}
