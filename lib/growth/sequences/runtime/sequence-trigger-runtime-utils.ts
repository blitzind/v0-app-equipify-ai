/** S3-A — SR-3 runtime trigger normalization + simulation fixtures (client-safe). */

import type { GrowthMediaPlaybackAnalyticsEventType } from "@/lib/growth/media/media-asset-analytics-types"
import type { SequenceBranchSimulationScenario } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"
import type {
  SequenceConditionEvent,
  SequenceConditionSource,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  SEQUENCE_TRIGGER_RUNTIME_EVENT_TO_SOURCE,
  SEQUENCE_TRIGGER_RUNTIME_EVENTS,
  type SequenceBookingHandoffTriggerWakePayload,
  type SequenceHighIntentTriggerWakePayload,
  type SequenceMediaTriggerWakePayload,
  type SequenceTriggerRuntimeEvent,
  type SequenceTriggerRuntimeSimulationFixture,
  type SequenceTriggerRuntimeWakeDispatchSummary,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"

export { GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER, GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS }

const MEDIA_PLAYBACK_TO_SEQUENCE_EVENT: Partial<
  Record<GrowthMediaPlaybackAnalyticsEventType, SequenceTriggerRuntimeEvent>
> = {
  video_viewed: "media.viewed",
  video_play_started: "media.play_started",
  video_completed: "media.completed",
  video_cta_clicked: "media.cta_clicked",
}

export function mapMediaPlaybackEventToSequenceTriggerEvent(
  eventType: GrowthMediaPlaybackAnalyticsEventType,
): SequenceTriggerRuntimeEvent | null {
  return MEDIA_PLAYBACK_TO_SEQUENCE_EVENT[eventType] ?? null
}

export function isSequenceTriggerRuntimeEvent(
  event: SequenceConditionEvent,
): event is SequenceTriggerRuntimeEvent {
  return (SEQUENCE_TRIGGER_RUNTIME_EVENTS as readonly string[]).includes(event)
}

export function normalizeSequenceMediaTriggerWakePayload(
  input: SequenceMediaTriggerWakePayload,
): SequenceMediaTriggerWakePayload {
  return {
    leadId: input.leadId.trim(),
    mediaAssetId: input.mediaAssetId.trim(),
    sharePageId: input.sharePageId?.trim() || null,
    sessionId: input.sessionId.trim(),
    watchSeconds: input.watchSeconds ?? null,
    completionRate: input.completionRate ?? null,
    ctaKey: input.ctaKey?.trim() || null,
    occurredAt: input.occurredAt,
    evidenceRef: input.evidenceRef?.trim() || null,
  }
}

export function normalizeSequenceBookingHandoffTriggerWakePayload(
  input: SequenceBookingHandoffTriggerWakePayload,
): SequenceBookingHandoffTriggerWakePayload {
  return {
    leadId: input.leadId.trim(),
    sharePageId: input.sharePageId?.trim() || null,
    readinessTier: input.readinessTier,
    readinessScore: input.readinessScore,
    recommendation: input.recommendation.trim(),
    occurredAt: input.occurredAt,
    evidenceRef: input.evidenceRef?.trim() || null,
  }
}

export function normalizeSequenceHighIntentTriggerWakePayload(
  input: SequenceHighIntentTriggerWakePayload,
): SequenceHighIntentTriggerWakePayload {
  return {
    leadId: input.leadId.trim(),
    signalId: input.signalId.trim(),
    score: input.score ?? null,
    signalType: input.signalType.trim(),
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt,
    evidenceRef: input.evidenceRef?.trim() || input.signalId.trim(),
  }
}

export function buildSequenceTriggerRuntimeWakeSummary(input: {
  source: SequenceConditionSource
  event: SequenceConditionEvent
  leadId: string
  evidenceRef?: string | null
  occurredAt?: string
}): SequenceTriggerRuntimeWakeDispatchSummary {
  return {
    source: input.source,
    event: input.event,
    leadId: input.leadId.trim(),
    evidenceRef: input.evidenceRef?.trim() || null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  }
}

export function resolveSequenceTriggerRuntimeEventFromDsl(input: {
  source: string
  event: string
}): SequenceTriggerRuntimeEvent | null {
  const candidate = `${input.source}.${input.event}` as SequenceTriggerRuntimeEvent
  if ((SEQUENCE_TRIGGER_RUNTIME_EVENTS as readonly string[]).includes(candidate)) {
    return candidate
  }
  return null
}

export function buildSequenceTriggerSimulationConditionOverrides(
  fixtures: SequenceTriggerRuntimeSimulationFixture[],
): Record<string, boolean> {
  const overrides: Record<string, boolean> = {}
  for (const fixture of fixtures) {
    if (SEQUENCE_TRIGGER_RUNTIME_EVENT_TO_SOURCE[fixture.event] !== fixture.source) continue
    overrides[fixture.conditionId] = fixture.matched
  }
  return overrides
}

export function buildSequenceTriggerRuntimeSimulationFixtures(input: {
  conditionIds: Partial<Record<SequenceTriggerRuntimeEvent, string>>
}): SequenceTriggerRuntimeSimulationFixture[] {
  const scenarios: SequenceBranchSimulationScenario[] = ["immediate", "wait_matched", "wait_timeout"]
  const fixtures: SequenceTriggerRuntimeSimulationFixture[] = []

  for (const event of SEQUENCE_TRIGGER_RUNTIME_EVENTS) {
    const conditionId = input.conditionIds[event]
    if (!conditionId) continue

    for (const scenario of scenarios) {
      fixtures.push({
        source: SEQUENCE_TRIGGER_RUNTIME_EVENT_TO_SOURCE[event],
        event,
        scenario,
        conditionId,
        matched: scenario === "wait_matched" || scenario === "immediate",
      })
    }
  }

  return fixtures
}

export function resolveSequenceTriggerSimulationConditionOverrides(input?: {
  fixtures?: SequenceTriggerRuntimeSimulationFixture[]
  scenario?: SequenceBranchSimulationScenario
  conditionOverrides?: Record<string, boolean>
}): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...(input?.conditionOverrides ?? {}) }
  const scenario = input?.scenario
  const fixtures = input?.fixtures ?? []

  for (const fixture of fixtures) {
    if (scenario && fixture.scenario !== scenario) continue
    merged[fixture.conditionId] = fixture.matched
  }

  return merged
}
