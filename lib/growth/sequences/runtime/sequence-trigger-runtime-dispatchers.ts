import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { dispatchSequenceWakeForLeadEvent } from "@/lib/growth/sequences/conditions/sequence-event-wake-engine"
import {
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  type SequenceBookingHandoffTriggerWakePayload,
  type SequenceHighIntentTriggerWakePayload,
  type SequenceMediaTriggerWakePayload,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"
import {
  buildSequenceTriggerRuntimeWakeSummary,
  mapMediaPlaybackEventToSequenceTriggerEvent,
  normalizeSequenceBookingHandoffTriggerWakePayload,
  normalizeSequenceHighIntentTriggerWakePayload,
  normalizeSequenceMediaTriggerWakePayload,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-utils"
import type { GrowthMediaPlaybackAnalyticsEventType } from "@/lib/growth/media/media-asset-analytics-types"

export function dispatchMediaSequenceWakeSafely(
  admin: SupabaseClient,
  input: SequenceMediaTriggerWakePayload & {
    playbackEventType: GrowthMediaPlaybackAnalyticsEventType
  },
): void {
  const normalized = normalizeSequenceMediaTriggerWakePayload(input)
  if (!normalized.leadId) return

  const event = mapMediaPlaybackEventToSequenceTriggerEvent(input.playbackEventType)
  if (!event) return

  const summary = buildSequenceTriggerRuntimeWakeSummary({
    source: "media",
    event,
    leadId: normalized.leadId,
    evidenceRef: normalized.evidenceRef ?? normalized.mediaAssetId,
    occurredAt: normalized.occurredAt,
  })

  dispatchSequenceWakeForLeadEvent(admin, {
    leadId: summary.leadId,
    source: summary.source,
    event: summary.event,
    occurredAt: summary.occurredAt,
  })

  void GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS
}

export function dispatchBookingHandoffSequenceWakeSafely(
  admin: SupabaseClient,
  input: SequenceBookingHandoffTriggerWakePayload,
): void {
  const normalized = normalizeSequenceBookingHandoffTriggerWakePayload(input)
  if (!normalized.leadId) return

  const summary = buildSequenceTriggerRuntimeWakeSummary({
    source: "booking_handoff",
    event: "booking_handoff.ready",
    leadId: normalized.leadId,
    evidenceRef: normalized.evidenceRef,
    occurredAt: normalized.occurredAt,
  })

  dispatchSequenceWakeForLeadEvent(admin, {
    leadId: summary.leadId,
    source: summary.source,
    event: summary.event,
    occurredAt: summary.occurredAt,
  })

  void GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS
}

export function dispatchHighIntentSequenceWakeSafely(
  admin: SupabaseClient,
  input: SequenceHighIntentTriggerWakePayload,
): void {
  const normalized = normalizeSequenceHighIntentTriggerWakePayload(input)
  if (!normalized.leadId || !normalized.signalId) return

  const summary = buildSequenceTriggerRuntimeWakeSummary({
    source: "high_intent",
    event: "high_intent.detected",
    leadId: normalized.leadId,
    evidenceRef: normalized.evidenceRef,
    occurredAt: normalized.occurredAt,
  })

  dispatchSequenceWakeForLeadEvent(admin, {
    leadId: summary.leadId,
    source: summary.source,
    event: summary.event,
    occurredAt: summary.occurredAt,
  })

  void GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS
}
