/**
 * S3-A — SR-3 runtime trigger extensions (media, booking handoff, high intent).
 *
 * Local: pnpm test:growth-sequence-runtime
 * Integration: pnpm test:growth-sequence-runtime:integration
 * Production: pnpm test:growth-sequence-runtime:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  bootstrapGrowthSequenceConditionsCertEnv,
  describeSequenceConditionsCertBootstrapFailure,
} from "../lib/growth/sequences/conditions/sequence-condition-cert-bootstrap"
import {
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
  GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS,
  SEQUENCE_TRIGGER_RUNTIME_EVENTS,
} from "../lib/growth/sequences/runtime/sequence-trigger-runtime-types"
import {
  buildSequenceTriggerRuntimeSimulationFixtures,
  buildSequenceTriggerSimulationConditionOverrides,
  mapMediaPlaybackEventToSequenceTriggerEvent,
  normalizeSequenceBookingHandoffTriggerWakePayload,
  normalizeSequenceHighIntentTriggerWakePayload,
  normalizeSequenceMediaTriggerWakePayload,
  resolveSequenceTriggerRuntimeEventFromDsl,
  resolveSequenceTriggerSimulationConditionOverrides,
} from "../lib/growth/sequences/runtime/sequence-trigger-runtime-utils"
import { parseSequenceConditionSpec } from "../lib/growth/sequences/conditions/sequence-condition-types"
import { mapMediaPlaybackEventToSequenceWakeEvent } from "../lib/growth/sequences/conditions/sequence-event-wake-types"
import { isWaitUntilEventConditionEvent } from "../lib/growth/sequences/conditions/sequence-wait-registry-types"

const FORBIDDEN_DISPATCHER_PATTERNS = [
  /emitGrowth.*Notification/i,
  /insertGrowthOutreachQueueItem/,
  /queueSequenceStepTransportJob/,
  /createSequenceExecutionJob/,
  /runGrowthAiCopilotGeneration/,
] as const

const LEAD_ID = "11111111-1111-4111-8111-111111111111"
const MEDIA_CONDITION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const BOOKING_CONDITION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const HIGH_INTENT_CONDITION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

function ensureCertSupabasePublicEnv(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "cert-placeholder-anon-key"
  }
}

function runLocalRegression(): void {
  console.log(`\n=== S3-A local regression (${GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER, "growth-sequence-trigger-runtime-s3a-v1")
  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_MIGRATION, "20270827120900_growth_sequence_trigger_runtime_s3a.sql")
  console.log("  ✓ QA marker + migration")

  const requiredFiles = [
    "lib/growth/sequences/runtime/sequence-trigger-runtime-types.ts",
    "lib/growth/sequences/runtime/sequence-trigger-runtime-utils.ts",
    "lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers.ts",
    "lib/growth/sequences/runtime/sequence-trigger-runtime-diagnostics.ts",
    "lib/growth/sequences/runtime/sequence-trigger-runtime-production-diagnostics.ts",
    "supabase/migrations/20270827120900_growth_sequence_trigger_runtime_s3a.sql",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ module + migration files exist")

  const dslCases = [
    { source: "media", event: "viewed", expected: "media.viewed" },
    { source: "media", event: "play_started", expected: "media.play_started" },
    { source: "media", event: "completed", expected: "media.completed" },
    { source: "media", event: "cta_clicked", expected: "media.cta_clicked" },
    { source: "booking_handoff", event: "ready", expected: "booking_handoff.ready" },
    { source: "high_intent", event: "detected", expected: "high_intent.detected" },
  ] as const

  for (const entry of dslCases) {
    assert.equal(resolveSequenceTriggerRuntimeEventFromDsl(entry), entry.expected)
    const parsed = parseSequenceConditionSpec({ dslVersion: 1, source: entry.source, event: entry.expected })
    assert.equal(parsed.ok, true, `${entry.expected} schema`)
    assert.equal(isWaitUntilEventConditionEvent(entry.expected), true)
  }
  console.log("  ✓ DSL schema validation + wait-until-event classification")

  assert.equal(mapMediaPlaybackEventToSequenceTriggerEvent("video_viewed"), "media.viewed")
  assert.equal(mapMediaPlaybackEventToSequenceWakeEvent("video_completed"), "media.completed")
  console.log("  ✓ media playback wake mappings")

  const mediaPayload = normalizeSequenceMediaTriggerWakePayload({
    leadId: LEAD_ID,
    mediaAssetId: "22222222-2222-4222-8222-222222222222",
    sessionId: "session-1",
    watchSeconds: 30,
    completionRate: 0.5,
  })
  assert.equal(mediaPayload.leadId, LEAD_ID)

  const bookingPayload = normalizeSequenceBookingHandoffTriggerWakePayload({
    leadId: LEAD_ID,
    readinessTier: "meeting_ready",
    readinessScore: 70,
    recommendation: "Book discovery call",
  })
  assert.equal(bookingPayload.readinessScore, 70)

  const highIntentPayload = normalizeSequenceHighIntentTriggerWakePayload({
    leadId: LEAD_ID,
    signalId: "33333333-3333-4333-8333-333333333333",
    signalType: "share_page_cta_clicked",
    score: 80,
  })
  assert.equal(highIntentPayload.evidenceRef, highIntentPayload.signalId)
  console.log("  ✓ payload normalization")

  const fixtures = buildSequenceTriggerRuntimeSimulationFixtures({
    conditionIds: {
      "media.viewed": MEDIA_CONDITION_ID,
      "booking_handoff.ready": BOOKING_CONDITION_ID,
      "high_intent.detected": HIGH_INTENT_CONDITION_ID,
    },
  })
  assert.equal(fixtures.length, 9)

  const waitMatchedOverrides = resolveSequenceTriggerSimulationConditionOverrides({
    fixtures,
    scenario: "wait_matched",
  })
  assert.equal(waitMatchedOverrides[MEDIA_CONDITION_ID], true)
  assert.equal(waitMatchedOverrides[BOOKING_CONDITION_ID], true)

  const waitTimeoutOverrides = resolveSequenceTriggerSimulationConditionOverrides({
    fixtures,
    scenario: "wait_timeout",
  })
  assert.equal(waitTimeoutOverrides[MEDIA_CONDITION_ID], false)

  const merged = buildSequenceTriggerSimulationConditionOverrides(fixtures)
  assert.equal(Object.keys(merged).length, 3)
  console.log("  ✓ simulation fixtures (immediate / wait_matched / wait_timeout)")

  const dispatchersSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/runtime/sequence-trigger-runtime-dispatchers.ts"),
    "utf8",
  )
  assert.match(dispatchersSource, /dispatchMediaSequenceWakeSafely/)
  assert.match(dispatchersSource, /dispatchBookingHandoffSequenceWakeSafely/)
  assert.match(dispatchersSource, /dispatchHighIntentSequenceWakeSafely/)
  assert.match(dispatchersSource, /dispatchSequenceWakeForLeadEvent/)
  for (const pattern of FORBIDDEN_DISPATCHER_PATTERNS) {
    assert.doesNotMatch(dispatchersSource, pattern, "dispatchers must not send or notify")
  }
  console.log("  ✓ wake dispatcher adapters forward to SR-3 engine only")

  const integrationSources = [
    "lib/growth/media/media-asset-analytics-service.ts",
    "lib/growth/media/media-booking-handoff-service.ts",
    "lib/growth/share-pages/share-page-analytics-signals.ts",
  ]
  for (const relativePath of integrationSources) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    assert.match(source, /dispatch.*SequenceWakeSafely/)
    for (const pattern of FORBIDDEN_DISPATCHER_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not send or notify via wake wiring`)
    }
  }
  console.log("  ✓ source integrations wired")

  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.read_only, true)
  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_notifications, true)
  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_provider_execution, true)
  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_sequence_send_execution, true)
  assert.equal(GROWTH_SEQUENCE_TRIGGER_RUNTIME_SAFETY_FLAGS.no_background_jobs, true)
  assert.equal(SEQUENCE_TRIGGER_RUNTIME_EVENTS.length, 6)
  console.log("  ✓ safety flags")

  console.log("\nS3-A local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthSequenceConditionsCertEnv()
  if (!boot) {
    return {
      qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
      ...describeSequenceConditionsCertBootstrapFailure(),
    }
  }

  ensureCertSupabasePublicEnv()

  const { executeGrowthSequenceTriggerRuntimeDiagnostics } = await import(
    "../lib/growth/sequences/runtime/sequence-trigger-runtime-diagnostics"
  )
  const { executeGrowthSequenceTriggerRuntimeIntegrationCert } = await import(
    "../lib/growth/sequences/runtime/sequence-trigger-runtime-integration-cert"
  )

  const diagnostics = await executeGrowthSequenceTriggerRuntimeDiagnostics(boot.admin)
  const integration = await executeGrowthSequenceTriggerRuntimeIntegrationCert(boot.admin)

  return {
    ...diagnostics,
    integration_cert: integration,
    final_verdict:
      diagnostics.final_verdict === "PASS" && integration.final_verdict === "PASS" ? "PASS" : "FAIL",
    env_source: boot.env_source,
    vercel_production_env_run: boot.vercel_production_env_run,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthSequenceConditionsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      qa_marker: GROWTH_SEQUENCE_TRIGGER_RUNTIME_QA_MARKER,
      ...describeSequenceConditionsCertBootstrapFailure({ requireVercelProductionEnvRun: true }),
    }
  }

  const { executeGrowthSequenceTriggerRuntimeProductionDiagnostics } = await import(
    "../lib/growth/sequences/runtime/sequence-trigger-runtime-production-diagnostics"
  )
  const report = await executeGrowthSequenceTriggerRuntimeProductionDiagnostics(boot.admin)
  return {
    ...report,
    env_source: boot.env_source,
    vercel_production_env_run: boot.vercel_production_env_run,
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--production")
    ? "production"
    : process.argv.includes("--integration")
      ? "integration"
      : "local"

  if (mode === "local") {
    runLocalRegression()
    return
  }

  console.log(`\n=== S3-A ${mode} diagnostics ===\n`)
  const report = mode === "production" ? await runProductionDiagnostics() : await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))

  const verdict = String(report.final_verdict ?? "FAIL")
  if (verdict === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
