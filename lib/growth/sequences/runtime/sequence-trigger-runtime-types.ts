/** S3-A — SR-3 runtime trigger extensions (client-safe). */

import type { GrowthMediaMeetingReadinessTier } from "@/lib/growth/media/media-meeting-readiness-types"
import type { GrowthMediaPlaybackAnalyticsEventType } from "@/lib/growth/media/media-asset-analytics-types"
import type {
  SequenceConditionEvent,
  SequenceConditionSource,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"
import type { SequenceBranchSimulationScenario } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER =
  "growth-sequence-trigger-runtime-s3a-v1" as const

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION =
  "20270827120900_growth_sequence_trigger_runtime_s3a.sql" as const

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_CONFIRM =
  "RUN_GROWTH_SEQUENCE_TRIGGER_RUNTIME_CERTIFICATION" as const

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS = {
  read_only: true,
  no_notifications: true,
  no_provider_execution: true,
  no_sequence_send_execution: true,
  no_background_jobs: true,
} as const

export type GrowthSequenceTriggerRuntimeSafetyFlags =
  typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS

export const SEQUENCE_TRIGGER_RUNTIME_SOURCES = [
  "media",
  "booking_handoff",
  "high_intent",
] as const

export type SequenceTriggerRuntimeSource = (typeof SEQUENCE_TRIGGER_RUNTIME_SOURCES)[number]

export const SEQUENCE_TRIGGER_RUNTIME_EVENTS = [
  "media.viewed",
  "media.play_started",
  "media.completed",
  "media.cta_clicked",
  "booking_handoff.ready",
  "high_intent.detected",
] as const

export type SequenceTriggerRuntimeEvent = (typeof SEQUENCE_TRIGGER_RUNTIME_EVENTS)[number]

export const SEQUENCE_TRIGGER_RUNTIME_EVENT_TO_SOURCE: Record<
  SequenceTriggerRuntimeEvent,
  SequenceTriggerRuntimeSource
> = {
  "media.viewed": "media",
  "media.play_started": "media",
  "media.completed": "media",
  "media.cta_clicked": "media",
  "booking_handoff.ready": "booking_handoff",
  "high_intent.detected": "high_intent",
}

export type SequenceMediaTriggerWakePayload = {
  leadId: string
  mediaAssetId: string
  sharePageId?: string | null
  sessionId: string
  watchSeconds?: number | null
  completionRate?: number | null
  ctaKey?: string | null
  occurredAt?: string
  evidenceRef?: string | null
}

export type SequenceBookingHandoffTriggerWakePayload = {
  leadId: string
  sharePageId?: string | null
  readinessTier: GrowthMediaMeetingReadinessTier | string
  readinessScore: number
  recommendation: string
  occurredAt?: string
  evidenceRef?: string | null
}

export type SequenceHighIntentTriggerWakePayload = {
  leadId: string
  signalId: string
  score?: number | null
  signalType: string
  metadata?: Record<string, unknown>
  occurredAt?: string
  evidenceRef?: string | null
}

export type SequenceTriggerRuntimeSimulationFixture = {
  source: SequenceTriggerRuntimeSource
  event: SequenceTriggerRuntimeEvent
  scenario: SequenceBranchSimulationScenario
  conditionId: string
  matched: boolean
}

export type SequenceTriggerRuntimeWakeDispatchSummary = {
  source: SequenceConditionSource
  event: SequenceConditionEvent
  leadId: string
  evidenceRef: string | null
  occurredAt: string
}
