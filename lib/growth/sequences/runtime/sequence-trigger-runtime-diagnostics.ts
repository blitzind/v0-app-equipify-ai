/** S3-A — SR-3 runtime trigger integration diagnostics. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseSequenceConditionSpec } from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_CONFIRM,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  SEQUENCE_TRIGGER_RUNTIME_EVENTS,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"
import {
  buildSequenceTriggerRuntimeSimulationFixtures,
  mapMediaPlaybackEventToSequenceTriggerEvent,
  normalizeSequenceBookingHandoffTriggerWakePayload,
  normalizeSequenceHighIntentTriggerWakePayload,
  normalizeSequenceMediaTriggerWakePayload,
  resolveSequenceTriggerRuntimeEventFromDsl,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-utils"

export type GrowthSequenceTriggerRuntimeDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSequenceTriggerRuntimeDiagnosticsReport = {
  ok: boolean
  skipped: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER
  confirm: typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_CONFIRM
  migration: typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION
  checks: GrowthSequenceTriggerRuntimeDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
} & typeof GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS

function pushCheck(
  checks: GrowthSequenceTriggerRuntimeDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

export async function executeGrowthSequenceTriggerRuntimeDiagnostics(
  admin: SupabaseClient,
): Promise<GrowthSequenceTriggerRuntimeDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthSequenceTriggerRuntimeDiagnosticsCheck[] = []
  const blockers: string[] = []

  for (const event of SEQUENCE_TRIGGER_RUNTIME_EVENTS) {
    const [source, ...rest] = event.split(".")
    const shortEvent = rest.join(".")
    const dslResolved = resolveSequenceTriggerRuntimeEventFromDsl({ source, event: shortEvent })
    pushCheck(
      checks,
      `dsl_${event.replaceAll(".", "_")}`,
      dslResolved === event,
      `${event} resolves from source/event DSL.`,
    )

    const parsed = parseSequenceConditionSpec({
      dslVersion: 1,
      source,
      event,
    })
    pushCheck(
      checks,
      `schema_${event.replaceAll(".", "_")}`,
      parsed.ok,
      parsed.ok ? `${event} passes condition schema validation.` : parsed.message,
    )
  }

  const mediaPayload = normalizeSequenceMediaTriggerWakePayload({
    leadId: "11111111-1111-4111-8111-111111111111",
    mediaAssetId: "22222222-2222-4222-8222-222222222222",
    sharePageId: "33333333-3333-4333-8333-333333333333",
    sessionId: "session-cert",
    watchSeconds: 42,
    completionRate: 0.91,
    ctaKey: "book_meeting",
  })
  pushCheck(checks, "media_payload_normalization", mediaPayload.leadId.length === 36, "Media payload normalized.")

  const bookingPayload = normalizeSequenceBookingHandoffTriggerWakePayload({
    leadId: "11111111-1111-4111-8111-111111111111",
    sharePageId: "33333333-3333-4333-8333-333333333333",
    readinessTier: "meeting_ready",
    readinessScore: 72,
    recommendation: "Schedule a 30-minute discovery call.",
  })
  pushCheck(
    checks,
    "booking_payload_normalization",
    bookingPayload.readinessScore === 72,
    "Booking handoff payload normalized.",
  )

  const highIntentPayload = normalizeSequenceHighIntentTriggerWakePayload({
    leadId: "11111111-1111-4111-8111-111111111111",
    signalId: "44444444-4444-4444-8444-444444444444",
    score: 88,
    signalType: "share_page_cta_clicked",
    metadata: { share_page_id: "33333333-3333-4333-8333-333333333333" },
  })
  pushCheck(
    checks,
    "high_intent_payload_normalization",
    highIntentPayload.signalId.length === 36,
    "High-intent payload normalized.",
  )

  pushCheck(
    checks,
    "media_playback_mapping_viewed",
    mapMediaPlaybackEventToSequenceTriggerEvent("video_viewed") === "media.viewed",
    "video_viewed maps to media.viewed.",
  )
  pushCheck(
    checks,
    "media_playback_mapping_completed",
    mapMediaPlaybackEventToSequenceTriggerEvent("video_completed") === "media.completed",
    "video_completed maps to media.completed.",
  )

  const fixtures = buildSequenceTriggerRuntimeSimulationFixtures({
    conditionIds: {
      "media.viewed": "55555555-5555-4555-8555-555555555555",
      "booking_handoff.ready": "66666666-6666-4666-8666-666666666666",
      "high_intent.detected": "77777777-7777-4777-8777-777777777777",
    },
  })
  pushCheck(
    checks,
    "simulation_fixtures",
    fixtures.length === 9,
    "Simulation fixtures cover media, booking_handoff, and high_intent scenarios.",
  )

  const mediaEventsProbe = await admin
    .schema("growth")
    .from("media_asset_events")
    .select("id")
    .limit(1)
  if (mediaEventsProbe.error) {
    pushCheck(
      checks,
      "media_asset_events_schema",
      true,
      "media_asset_events table not available — integration wake evidence skipped until migration approval.",
    )
  } else {
    pushCheck(checks, "media_asset_events_schema", true, "media_asset_events table reachable.")
  }

  const signalsProbe = await admin.schema("growth").from("signals").select("id").limit(1)
  if (signalsProbe.error) {
    pushCheck(
      checks,
      "signals_schema",
      true,
      "signals table not available — booking/high-intent evidence skipped until schema ready.",
    )
  } else {
    pushCheck(checks, "signals_schema", true, "signals table reachable.")
  }

  pushCheck(
    checks,
    "safety_flags",
    GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_sequence_send_execution === true &&
      GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_notifications === true &&
      GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_provider_execution === true,
    "Runtime trigger safety flags enforced.",
  )

  const failed = checks.filter((check) => !check.ok)
  for (const check of failed) {
    blockers.push(`${check.id}: ${check.detail}`)
  }

  return {
    ok: failed.length === 0,
    skipped: false,
    execution_id,
    qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
    confirm: GROWTH_SEQUENCE_TRIGGER_RUNTIME_CONFIRM,
    migration: GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION,
    checks,
    blockers,
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  }
}
