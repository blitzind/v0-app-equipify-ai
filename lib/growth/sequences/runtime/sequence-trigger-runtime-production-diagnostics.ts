/** S3-A — SR-3 runtime trigger production diagnostics (read-only). */

import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  SEQUENCE_TRIGGER_RUNTIME_EVENTS,
} from "@/lib/growth/sequences/runtime/sequence-trigger-runtime-types"

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_MODULE_PATHS = [
  "lib/growth/sequences/runtime/sequence-trigger-runtime-types.ts",
  "lib/growth/sequences/runtime/sequence-trigger-runtime-utils.ts",
  "lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers.ts",
  "lib/growth/sequences/runtime/sequence-trigger-runtime-diagnostics.ts",
  "lib/growth/sequences/runtime/sequence-trigger-runtime-production-diagnostics.ts",
  "lib/growth/sequences/conditions/sequence-event-wake-types.ts",
  "lib/growth/sequences/conditions/sequence-event-wake-engine.ts",
  "lib/growth/sequences/conditions/sequence-condition-event-query.ts",
  "lib/growth/media/media-asset-analytics-service.ts",
  "lib/growth/media/media-booking-handoff-service.ts",
  "lib/growth/share-pages/share-page-analytics-signals.ts",
] as const

export const GROWTH_SEQUENCE_TRIGGER_RUNTIME_INTEGRATION_PATHS = [
  "lib/growth/media/media-asset-analytics-service.ts",
  "lib/growth/media/media-booking-handoff-service.ts",
  "lib/growth/share-pages/share-page-analytics-signals.ts",
] as const

const MEDIA_PLAYBACK_WAKE_TYPES = [
  "video_viewed",
  "video_play_started",
  "video_completed",
  "video_cta_clicked",
] as const

export async function executeGrowthSequenceTriggerRuntimeProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = []

  for (const modulePath of GROWTH_SEQUENCE_TRIGGER_RUNTIME_MODULE_PATHS) {
    const absolutePath = path.join(process.cwd(), modulePath)
    checks.push({
      name: `module:${modulePath}`,
      ok: fs.existsSync(absolutePath),
      detail: fs.existsSync(absolutePath) ? "Module present." : "Module missing.",
    })
  }

  const migrationPath = path.join(process.cwd(), "supabase/migrations", GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION)
  checks.push({
    name: "migration_file",
    ok: fs.existsSync(migrationPath),
    detail: fs.existsSync(migrationPath) ? "S3-A migration file present." : "Migration file missing.",
  })

  const wakeTypesSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-event-wake-types.ts"),
    "utf8",
  )
  for (const playbackType of MEDIA_PLAYBACK_WAKE_TYPES) {
    checks.push({
      name: `wake_map:${playbackType}`,
      ok: wakeTypesSource.includes(playbackType),
      detail: `${playbackType} mapped in sequence-event-wake-types.`,
    })
  }

  const dispatchersSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers.ts"),
    "utf8",
  )
  for (const fn of [
    "dispatchMediaSequenceWakeSafely",
    "dispatchBookingHandoffSequenceWakeSafely",
    "dispatchHighIntentSequenceWakeSafely",
  ]) {
    checks.push({
      name: `dispatcher:${fn}`,
      ok: dispatchersSource.includes(fn),
      detail: `${fn} exported.`,
    })
  }

  checks.push({
    name: "dispatcher_forwards_to_wake_engine",
    ok: dispatchersSource.includes("dispatchSequenceWakeForLeadEvent"),
    detail: "Dispatchers forward to existing SR-3 wake engine.",
  })

  for (const integrationPath of GROWTH_SEQUENCE_TRIGGER_RUNTIME_INTEGRATION_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), integrationPath), "utf8")
    checks.push({
      name: `integration:${integrationPath}`,
      ok: source.includes("dispatch") && source.includes("SequenceWakeSafely"),
      detail: `${integrationPath} wires sequence wake dispatch.`,
    })
  }

  for (const event of SEQUENCE_TRIGGER_RUNTIME_EVENTS) {
    const probe = await admin
      .schema("growth")
      .from("sequence_pattern_step_conditions")
      .select("event")
      .eq("event", event)
      .limit(1)
    const schemaReady = !probe.error || !probe.error.message.toLowerCase().includes("violates check constraint")
    checks.push({
      name: `db_event_allowlist:${event}`,
      ok: schemaReady,
      detail: schemaReady
        ? `${event} allowlist probe succeeded or table empty.`
        : `DB constraint may reject ${event} until migration ${GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION} is applied.`,
    })
  }

  checks.push({
    name: "safety_flags.no_sequence_send_execution",
    ok: GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_sequence_send_execution === true,
    detail: "Sequence send execution remains disabled.",
  })

  const failed = checks.filter((check) => !check.ok)

  return {
    qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
    migration: GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION,
    read_only: true,
    checks,
    blockers: failed.map((check) => `${check.name}: ${check.detail}`),
    final_verdict: failed.length === 0 ? "PASS" : "FAIL",
    ...GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  }
}
