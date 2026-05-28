/** Unified communication timeline builder — Phase 6A. */

import type {
  VoiceCommunicationTimelineEntry,
  VoiceUnifiedCommunicationEventPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"
import { VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS } from "@/lib/voice/multi-channel-intelligence/types"

export function buildUnifiedCommunicationTimeline(
  events: VoiceUnifiedCommunicationEventPublicView[],
  limit: number = VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS,
): VoiceCommunicationTimelineEntry[] {
  return [...events]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-limit)
    .map((e) => ({
      eventType: e.eventType,
      channel: e.channel,
      evidenceText: e.evidenceText,
      sourceSystem: e.sourceSystem,
      createdAt: e.createdAt,
    }))
}

export function capTimelineEvents<T>(events: T[], limit: number = VOICE_MULTICHANNEL_MAX_TIMELINE_EVENTS): T[] {
  return events.slice(0, limit)
}

export function multichannelRetentionCutoffIso(retentionDays: number): string {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  return cutoff.toISOString()
}

export function staleThreadCutoffIso(staleHours: number): string {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - staleHours)
  return cutoff.toISOString()
}
