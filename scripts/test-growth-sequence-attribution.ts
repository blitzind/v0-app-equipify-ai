/**
 * SR-3 Phase 0 — Sequence attribution + pause safety certification.
 *
 * Local: pnpm test:growth-sequence-attribution
 * Integration: pnpm test:growth-sequence-attribution:integration
 * Production: pnpm test:growth-sequence-attribution:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildSequenceAttributionContext,
  isCompleteSequenceAttribution,
  mergeSequenceAttributionContext,
  sequenceAttributionFromMetadata,
  sequenceAttributionToDbRow,
  sharePageAttributionToDbRow,
} from "../lib/growth/sequences/attribution/sequence-attribution"
import {
  GROWTH_SEQUENCE_ATTRIBUTION_CONFIRM,
  GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION,
  GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER,
} from "../lib/growth/sequences/attribution/sequence-attribution-types"
import { evaluateEnrollmentStatusForExecutionGate } from "../lib/growth/sequences/execution/sequence-pause-gate-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
] as const

const ENROLLMENT_ID = "11111111-1111-4111-8111-111111111111"
const STEP_ID = "22222222-2222-4222-8222-222222222222"
const JOB_ID = "33333333-3333-4333-8333-333333333333"

function runLocalRegression(): void {
  console.log(`\n=== SR-3 Phase 0 local regression (${GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER, "growth-sequence-attribution-sr3-phase0-v1")
  assert.equal(GROWTH_SEQUENCE_ATTRIBUTION_CONFIRM, "RUN_GROWTH_SEQUENCE_ATTRIBUTION_CERTIFICATION")
  assert.equal(GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION, "20270616120100_growth_sequence_attribution_sr3_phase0.sql")
  console.log("  ✓ QA markers")

  const requiredFiles = [
    "lib/growth/sequences/attribution/sequence-attribution-types.ts",
    "lib/growth/sequences/attribution/sequence-attribution.ts",
    "lib/growth/sequences/attribution/sequence-attribution-resolver.ts",
    "lib/growth/sequences/attribution/sequence-attribution-diagnostics.ts",
    "lib/growth/sequences/execution/sequence-pause-gate.ts",
    "lib/growth/sequences/conditions/sequence-branch-advance-gate.ts",
    "supabase/migrations/20270616120100_growth_sequence_attribution_sr3_phase0.sql",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ module files exist")

  const context = buildSequenceAttributionContext({
    sequenceEnrollmentId: ENROLLMENT_ID,
    sequenceEnrollmentStepId: STEP_ID,
    sequenceExecutionJobId: JOB_ID,
  })
  assert.equal(isCompleteSequenceAttribution(context), true)
  assert.deepEqual(sequenceAttributionToDbRow(context), {
    sequence_enrollment_id: ENROLLMENT_ID,
    sequence_enrollment_step_id: STEP_ID,
    sequence_execution_job_id: JOB_ID,
  })
  console.log("  ✓ sequence attribution helpers")

  const merged = mergeSequenceAttributionContext(
    buildSequenceAttributionContext({ sequenceEnrollmentId: ENROLLMENT_ID }),
    { sequenceEnrollmentStepId: STEP_ID, sequenceExecutionJobId: JOB_ID },
  )
  assert.equal(isCompleteSequenceAttribution(merged), true)
  console.log("  ✓ mergeSequenceAttributionContext")

  const fromMetadata = sequenceAttributionFromMetadata({
    sequence_enrollment_id: ENROLLMENT_ID,
    sequence_enrollment_step_id: STEP_ID,
    sequence_execution_job_id: JOB_ID,
  })
  assert.equal(isCompleteSequenceAttribution(fromMetadata), true)
  console.log("  ✓ sequenceAttributionFromMetadata")

  const shareRow = sharePageAttributionToDbRow({
    enrollmentId: ENROLLMENT_ID,
    sequenceEnrollmentStepId: STEP_ID,
    sequenceStepId: "44444444-4444-4444-8444-444444444444",
    sequenceExecutionJobId: JOB_ID,
  })
  assert.equal(shareRow.enrollment_id, ENROLLMENT_ID)
  assert.equal(shareRow.sequence_enrollment_step_id, STEP_ID)
  console.log("  ✓ share page attribution row")

  const paused = evaluateEnrollmentStatusForExecutionGate("paused")
  assert.equal(paused?.blocked, true)
  assert.equal(paused?.code, "enrollment_paused")
  const completed = evaluateEnrollmentStatusForExecutionGate("completed")
  assert.equal(completed?.code, "enrollment_completed")
  const cancelled = evaluateEnrollmentStatusForExecutionGate("cancelled")
  assert.equal(cancelled?.code, "enrollment_cancelled")
  assert.equal(evaluateEnrollmentStatusForExecutionGate("active"), null)
  console.log("  ✓ pause gate pure status evaluation")

  const jobRunner = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/execution/sequence-job-runner.ts"),
    "utf8",
  )
  assert.match(jobRunner, /assertSequenceExecutionPauseGate/)
  assert.match(jobRunner, /sequence_enrollment_step_id: locked\.sequenceStepId/)
  console.log("  ✓ safe execute pause gate + email step attribution wiring")

  const orchestrator = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestrator, /advanceGate\.blocked/)
  assert.match(orchestrator, /recordSequenceAdvancementBlockedAudit/)
  console.log("  ✓ advancement pause gate blocks branch and linear paths")

  const advanceGate = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-branch-advance-gate.ts"),
    "utf8",
  )
  assert.match(advanceGate, /runSequenceAdvancementGateSafetyProbes/)
  assert.match(advanceGate, /advancement_blocked/)
  console.log("  ✓ advancement gate audit + integration safety probes")

  const trackingRepo = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/tracking/tracking-repository.ts"),
    "utf8",
  )
  assert.match(trackingRepo, /resolveSequenceAttributionFromDeliveryAttemptId/)
  assert.match(trackingRepo, /\.\.\.attributionRow/)
  console.log("  ✓ email open/click attribution wiring")

  const smsRunner = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/execution/sequence-sms-runner.ts"),
    "utf8",
  )
  assert.match(smsRunner, /sequenceEnrollmentStepId: job\.sequenceStepId/)
  console.log("  ✓ SMS sequence attribution wiring")

  const voiceRunner = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/execution/sequence-voice-drop-runner.ts"),
    "utf8",
  )
  assert.match(voiceRunner, /sequence_enrollment_step_id/)
  console.log("  ✓ voice drop attribution metadata")

  const shareAnalytics = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-analytics-service.ts"),
    "utf8",
  )
  assert.match(shareAnalytics, /sequenceEnrollmentStepId: page\.sequenceEnrollmentStepId/)
  console.log("  ✓ share page view/event attribution wiring")

  const bookingAttribution = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-booking-attribution.ts"),
    "utf8",
  )
  assert.match(bookingAttribution, /sequence_enrollment_step_id/)
  console.log("  ✓ share page booking attribution wiring")

  const cadenceMaterialize = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/cadence/materialize-cadence-step.ts"),
    "utf8",
  )
  assert.match(cadenceMaterialize, /sequence_enrollment_id: input\.enrollmentId/)
  console.log("  ✓ cadence task enrollment attribution wiring")

  console.log("\nSR-3 Phase 0 local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  process.env.GROWTH_SEQUENCE_ATTRIBUTION_CERT_ALLOW_LOCAL =
    process.env.GROWTH_SEQUENCE_ATTRIBUTION_CERT_ALLOW_LOCAL ?? "1"

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeGrowthSequenceAttributionDiagnostics } = await import(
    "../lib/growth/sequences/attribution/sequence-attribution-diagnostics"
  )
  const report = await executeGrowthSequenceAttributionDiagnostics(admin)
  return report as unknown as Record<string, unknown>
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

  console.log(`\n=== SR-3 Phase 0 ${mode} diagnostics ===\n`)
  const report = await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))

  const verdict = String(report.final_verdict ?? "FAIL")
  if (verdict === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
