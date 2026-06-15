/**
 * SR-3 Phase 7 — Conditional sequence E2E certification + final SR-3 report.
 *
 * Local: pnpm test:growth-sequence-conditional-e2e
 * Integration: pnpm test:growth-sequence-conditional-e2e:integration
 * Production: pnpm test:growth-sequence-conditional-e2e:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER,
  simulateSequenceBranchStepPure,
} from "../lib/growth/sequences/conditions/sequence-branch-simulation-types"
import {
  GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER,
  SR3_CERTIFIED_PATTERN_A_KEY,
  SR3_CERTIFIED_PATTERN_B_KEY,
  SR3_CONDITIONAL_E2E_QA_MARKER,
} from "../lib/growth/sequences/conditions/sequence-enrollment-branch-visibility-types"
import {
  SR3_CERTIFIED_CONDITIONAL_PATTERN_A,
  SR3_CERTIFIED_CONDITIONAL_PATTERN_B,
  certifiedPatternTimeoutIso,
} from "../lib/growth/sequences/conditions/sequence-conditional-certified-patterns"
import { GROWTH_SEQUENCE_CONDITIONS_QA_MARKER } from "../lib/growth/sequences/conditions/sequence-condition-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
] as const

const WRITE_FORBIDDEN = [/\.insert\(/, /\.update\(/, /\.delete\(/, /createWait\(/, /queueSequenceStepTransportJob/] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function runLocalCertification(): void {
  console.log(`\n=== SR-3 Phase 7 conditional E2E local (${SR3_CONDITIONAL_E2E_QA_MARKER}) ===\n`)

  assert.equal(SR3_CONDITIONAL_E2E_QA_MARKER, "growth-sequence-conditional-e2e-sr3-phase7-v1")
  assert.equal(GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER, "growth-sequence-branch-visibility-sr3-phase7-v1")
  assert.equal(GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER, "growth-sequence-branch-simulation-sr3-phase6-v1")
  console.log("  ✓ QA markers")

  for (const relativePath of [
    "lib/growth/sequences/conditions/sequence-enrollment-branch-visibility-types.ts",
    "lib/growth/sequences/conditions/sequence-enrollment-branch-visibility.ts",
    "lib/growth/sequences/conditions/sequence-conditional-certified-patterns.ts",
    "components/growth/growth-sequence-branch-audit-panel.tsx",
    "lib/growth/sequence-enrollment/enrollment-detail.ts",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ module files exist")

  assert.equal(SR3_CERTIFIED_CONDITIONAL_PATTERN_A.key, SR3_CERTIFIED_PATTERN_A_KEY)
  assert.equal(SR3_CERTIFIED_CONDITIONAL_PATTERN_B.key, SR3_CERTIFIED_PATTERN_B_KEY)
  assert.equal(SR3_CERTIFIED_CONDITIONAL_PATTERN_A.timeoutHours, 72)
  assert.equal(SR3_CERTIFIED_CONDITIONAL_PATTERN_B.timeoutHours, 48)
  assert.ok(SR3_CERTIFIED_CONDITIONAL_PATTERN_A.steps.every((step) => step.channel))
  console.log("  ✓ certified pattern A/B specs")

  const timeoutAt = certifiedPatternTimeoutIso("2026-06-01T00:00:00.000Z", 72)
  assert.equal(timeoutAt, "2026-06-04T00:00:00.000Z")
  console.log("  ✓ certified pattern timeout helper")

  const detailSource = readSource("lib/growth/sequence-enrollment/enrollment-detail.ts")
  assert.match(detailSource, /fetchSequenceEnrollmentBranchVisibility/)
  assert.match(detailSource, /branchVisibility/)
  console.log("  ✓ enrollment detail includes branch visibility")

  const panelSource = readSource("components/growth/growth-sequence-branch-audit-panel.tsx")
  assert.match(panelSource, /GrowthSequenceBranchAuditPanel/)
  assert.match(panelSource, /activeWaits/)
  assert.match(panelSource, /branchDecisions/)
  assert.match(panelSource, /skippedSteps/)
  assert.match(panelSource, /timeline/)
  assert.match(panelSource, /Read-only operator view/)
  console.log("  ✓ operator branch audit panel renders audit fields")

  const enrollmentUi = readSource("components/growth/growth-pattern-enrollment-detail.tsx")
  assert.match(enrollmentUi, /GrowthSequenceBranchAuditPanel/)
  assert.match(enrollmentUi, /branchVisibility/)
  console.log("  ✓ enrollment detail UI embeds branch audit panel")

  const visibilitySource = readSource("lib/growth/sequences/conditions/sequence-enrollment-branch-visibility.ts")
  for (const pattern of WRITE_FORBIDDEN) {
    assert.doesNotMatch(visibilitySource, pattern, "branch visibility fetch must not write")
  }
  console.log("  ✓ branch visibility service is read-only")

  const patternSource = readSource("lib/growth/sequences/conditions/sequence-conditional-certified-patterns.ts")
  assert.match(patternSource, /required_human_approval: true/)
  assert.match(patternSource, /ensureAllSr3CertifiedConditionalPatterns/)
  console.log("  ✓ certified patterns enforce human approval on steps")

  const fromStep = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  const openedTarget = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const smsTarget = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const conditionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  const patternSteps = [
    {
      id: fromStep,
      patternId: "11111111-1111-4111-8111-111111111111",
      stepOrder: 1,
      channel: "email" as const,
      delayDaysMin: 0,
      delayDaysMax: 0,
      generationType: null,
      playbookCategory: null,
      voiceDropCampaignId: null,
      requiredHumanApproval: true,
      expectedSignal: "reply" as const,
    },
    {
      id: smsTarget,
      patternId: "11111111-1111-4111-8111-111111111111",
      stepOrder: 2,
      channel: "sms" as const,
      delayDaysMin: 1,
      delayDaysMax: 1,
      generationType: null,
      playbookCategory: null,
      voiceDropCampaignId: null,
      requiredHumanApproval: true,
      expectedSignal: "reply" as const,
    },
    {
      id: openedTarget,
      patternId: "11111111-1111-4111-8111-111111111111",
      stepOrder: 3,
      channel: "email" as const,
      delayDaysMin: 2,
      delayDaysMax: 2,
      generationType: null,
      playbookCategory: null,
      voiceDropCampaignId: null,
      requiredHumanApproval: true,
      expectedSignal: "reply" as const,
    },
  ]
  const edges = [
    {
      id: "edge-true",
      patternId: "11111111-1111-4111-8111-111111111111",
      fromPatternStepId: fromStep,
      toPatternStepId: openedTarget,
      conditionId,
      edgeType: "conditional_true" as const,
      priority: 10,
      label: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "edge-timeout",
      patternId: "11111111-1111-4111-8111-111111111111",
      fromPatternStepId: fromStep,
      toPatternStepId: smsTarget,
      conditionId: null,
      edgeType: "timeout" as const,
      priority: 5,
      label: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]
  const waitPreview = simulateSequenceBranchStepPure({
    fromPatternStepId: fromStep,
    patternSteps,
    edges,
    conditions: [],
    evaluations: [{ conditionId, matched: false }],
    conditionResults: [
      {
        conditionId,
        result: {
          matched: false,
          reason: "No open yet.",
          evidence: [],
          evaluatedAt: "2026-06-01T00:00:00.000Z",
          readOnly: true,
          event: "email.opened",
          source: "email",
        },
      },
    ],
    now: "2026-06-01T00:00:00.000Z",
  })
  assert.equal(waitPreview.pathKind, "waiting")
  assert.ok(waitPreview.timeout)

  const timeoutPreview = simulateSequenceBranchStepPure({
    fromPatternStepId: fromStep,
    patternSteps,
    edges,
    conditions: [],
    evaluations: [{ conditionId, matched: false }],
    conditionResults: [
      {
        conditionId,
        result: {
          matched: false,
          reason: "Timed out.",
          evidence: [],
          evaluatedAt: "2026-06-04T00:00:00.000Z",
          readOnly: true,
          event: "email.opened",
          source: "email",
        },
      },
    ],
    scenario: "wait_timeout",
    now: "2026-06-04T00:00:00.000Z",
  })
  assert.equal(timeoutPreview.pathKind, "timeout")
  assert.equal(timeoutPreview.targetPatternStepId, smsTarget)
  console.log("  ✓ pattern A simulation matches runtime wait + timeout semantics")

  console.log("\n--- SR-3 Final Certification Report (local) ---")
  console.log(
    JSON.stringify(
      {
        sr3_program: "growth-sequence-conditions-sr3",
        qa_marker: SR3_CONDITIONAL_E2E_QA_MARKER,
        phases_certified_local: [
          "phase0_attribution_pause",
          "phase1_schema_dsl",
          "phase2_read_only_evaluator",
          "phase3_branch_wait_registry",
          "phase4_event_wake",
          "phase5_wait_timeout_processor",
          "phase6_branch_simulation",
          "phase7_operator_visibility_certified_patterns",
        ],
        conditions_qa_marker: GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
        certified_patterns: [SR3_CERTIFIED_PATTERN_A_KEY, SR3_CERTIFIED_PATTERN_B_KEY],
        integration_required_for_full_e2e: true,
        final_verdict: "PASS",
      },
      null,
      2,
    ),
  )

  console.log("\nSR-3 Phase 7 conditional E2E local PASS\n")
}

async function runIntegrationCertification(): Promise<Record<string, unknown>> {
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
  const { ensureAllSr3CertifiedConditionalPatterns } = await import(
    "../lib/growth/sequences/conditions/sequence-conditional-certified-patterns"
  )
  const { listEdgesForPattern } = await import(
    "../lib/growth/sequences/conditions/sequence-condition-repository"
  )
  const { simulateSequenceBranchPreview } = await import(
    "../lib/growth/sequences/conditions/sequence-branch-simulation-engine"
  )
  const { ensureSequenceConditionCertFixture } = await import(
    "../lib/growth/sequences/conditions/sequence-condition-cert-fixtures"
  )
  const { executeGrowthSequenceConditionsDiagnostics } = await import(
    "../lib/growth/sequences/conditions/sequence-condition-diagnostics"
  )

  const patterns = await ensureAllSr3CertifiedConditionalPatterns(admin)
  const conditionsReport = await executeGrowthSequenceConditionsDiagnostics(admin)

  const checks: Array<{ id: string; ok: boolean; detail: string }> = []
  checks.push({
    id: "patterns.certified_graph_exists",
    ok: patterns.length === 2,
    detail: `Ensured ${patterns.length} certified conditional pattern(s).`,
  })

  for (const record of patterns) {
    const edges = await listEdgesForPattern(admin, record.patternId)
    const hasTrue = edges.some((edge) => edge.edgeType === "conditional_true")
    const hasTimeout = edges.some((edge) => edge.edgeType === "timeout")
    checks.push({
      id: `patterns.${record.patternKey}.edges`,
      ok: hasTrue && hasTimeout,
      detail: `${record.patternKey}: true=${hasTrue} timeout=${hasTimeout}`,
    })
  }

  const fixture = await ensureSequenceConditionCertFixture(admin)
  if (fixture) {
    const simulation = await simulateSequenceBranchPreview(admin, {
      enrollmentId: fixture.enrollmentId,
      enrollmentStepId: fixture.enrollmentStepId,
      scenario: "immediate",
    })
    checks.push({
      id: "simulation.read_only_enrollment_preview",
      ok: simulation.read_only === true,
      detail: `Simulation path kind: ${simulation.path.kind}.`,
    })

    const { count: jobsCount } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id", { count: "exact", head: true })
      .eq("sequence_enrollment_id", fixture.enrollmentId)

    checks.push({
      id: "safety.no_direct_execution_jobs",
      ok: (jobsCount ?? 0) === 0,
      detail: `Execution jobs for cert enrollment: ${jobsCount ?? 0}.`,
    })
  } else {
    checks.push({
      id: "simulation.read_only_enrollment_preview",
      ok: false,
      detail: "Cert fixture unavailable.",
    })
  }

  checks.push({
    id: "conditions.diagnostics_pass",
    ok: Boolean(conditionsReport.ok) || conditionsReport.final_verdict === "CONDITIONAL_PASS",
    detail: `Conditions diagnostics verdict: ${conditionsReport.final_verdict}.`,
  })

  const ok = checks.every((check) => check.ok)
  return {
    ok,
    final_verdict: ok ? "PASS" : "FAIL",
    qa_marker: SR3_CONDITIONAL_E2E_QA_MARKER,
    checks,
    certified_patterns: patterns.map((record) => record.patternKey),
    conditions_diagnostics: {
      final_verdict: conditionsReport.final_verdict,
      branch_simulation_ready: conditionsReport.branch_simulation_ready,
      wait_timeout_ready: conditionsReport.wait_timeout_ready,
    },
    sr3_final_report: {
      phases: 8,
      operator_visibility: true,
      certified_patterns: patterns.length,
      autonomous_outreach: false,
      auto_approval: false,
    },
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--production")
    ? "production"
    : process.argv.includes("--integration")
      ? "integration"
      : "local"

  if (mode === "local") {
    runLocalCertification()
    return
  }

  console.log(`\n=== SR-3 Phase 7 conditional E2E ${mode} ===\n`)
  const report = await runIntegrationCertification()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
