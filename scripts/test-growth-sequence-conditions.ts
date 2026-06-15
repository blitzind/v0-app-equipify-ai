/**
 * SR-3 Phase 1/2/3 — Conditional sequence schema, read-only evaluator, branch resolver + wait registry certification.
 *
 * Local: pnpm test:growth-sequence-conditions
 * Integration: pnpm test:growth-sequence-conditions:integration
 * Production: pnpm test:growth-sequence-conditions:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_SEQUENCE_CONDITIONS_CONFIRM,
  GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
  GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
  parseSequenceConditionSpec,
  sequenceConditionSpecSchema,
} from "../lib/growth/sequences/conditions/sequence-condition-types"
import {
  compareSequenceConditionNumeric,
  GROWTH_SEQUENCE_CONDITION_EVALUATOR_CONFIRM,
  GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER,
  maskSequenceConditionEvidenceRef,
  normalizeSequenceConditionTier,
} from "../lib/growth/sequences/conditions/sequence-condition-evaluator-types"
import {
  GROWTH_SEQUENCE_BRANCH_RESOLVER_QA_MARKER,
  resolveSequenceBranchEdges,
} from "../lib/growth/sequences/conditions/sequence-branch-resolver-types"
import { GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER } from "../lib/growth/sequences/conditions/sequence-wait-registry-types"
import {
  SEQUENCE_ENROLLMENT_WAIT_STATUSES,
  validateSequenceEnrollmentWaitStatus,
} from "../lib/growth/sequences/conditions/sequence-wait-types"
import {
  SEQUENCE_BRANCH_EDGE_TYPES,
  validateSequenceBranchEdgeType,
} from "../lib/growth/sequences/conditions/sequence-branch-types"
import {
  appendBranchDecision,
  createCondition,
  createEdge,
  createWait,
  deleteCondition,
  deleteEdge,
  listBranchDecisionsForEnrollment,
  listConditionsForStep,
  listEdgesForPattern,
  updateCondition,
  updateEdge,
  updateWait,
} from "../lib/growth/sequences/conditions/sequence-condition-repository"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
] as const

const RUNTIME_FORBIDDEN_PATTERNS = [
  /executeSequenceBranch/i,
  /runBranchExecution/i,
] as const

const BRANCH_PATH_FORBIDDEN_PATTERNS = [
  /queueSequenceStepTransportJob/,
  /createSequenceExecutionJob/,
  /runGrowthAiCopilotGeneration/,
  /insertGrowthOutreachQueueItem/,
] as const

const EVALUATOR_WRITE_FORBIDDEN_PATTERNS = [
  /\.insert\(/,
  /\.update\(/,
  /\.delete\(/,
  /\.upsert\(/,
] as const

function runLocalRegression(): void {
  console.log(`\n=== SR-3 Phase 1/2/3 local regression (${GROWTH_SEQUENCE_CONDITIONS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_CONDITIONS_QA_MARKER, "growth-sequence-conditions-sr3-phase1-v1")
  assert.equal(GROWTH_SEQUENCE_CONDITIONS_CONFIRM, "RUN_GROWTH_SEQUENCE_CONDITIONS_CERTIFICATION")
  assert.equal(GROWTH_SEQUENCE_CONDITIONS_MIGRATION, "20270827120000_growth_sequence_conditions_sr3_phase1.sql")
  assert.equal(GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER, "growth-sequence-condition-evaluator-sr3-phase2-v1")
  assert.equal(GROWTH_SEQUENCE_BRANCH_RESOLVER_QA_MARKER, "growth-sequence-branch-resolver-sr3-phase3-v1")
  assert.equal(GROWTH_SEQUENCE_WAIT_REGISTRY_QA_MARKER, "growth-sequence-wait-registry-sr3-phase3-v1")
  assert.equal(
    GROWTH_SEQUENCE_CONDITION_EVALUATOR_CONFIRM,
    "RUN_GROWTH_SEQUENCE_CONDITION_EVALUATOR_CERTIFICATION",
  )
  console.log("  ✓ QA markers")

  const requiredFiles = [
    "lib/growth/sequences/conditions/sequence-condition-types.ts",
    "lib/growth/sequences/conditions/sequence-branch-types.ts",
    "lib/growth/sequences/conditions/sequence-wait-types.ts",
    "lib/growth/sequences/conditions/sequence-condition-repository.ts",
    "lib/growth/sequences/conditions/sequence-condition-diagnostics.ts",
    "lib/growth/sequences/conditions/sequence-condition-evaluator-types.ts",
    "lib/growth/sequences/conditions/sequence-condition-event-query.ts",
    "lib/growth/sequences/conditions/sequence-condition-evaluator.ts",
    "lib/growth/sequences/conditions/sequence-condition-cert-fixtures.ts",
    "lib/growth/sequences/conditions/sequence-branch-resolver-types.ts",
    "lib/growth/sequences/conditions/sequence-branch-resolver.ts",
    "lib/growth/sequences/conditions/sequence-wait-registry-types.ts",
    "lib/growth/sequences/conditions/sequence-wait-registry.ts",
    "lib/growth/sequences/conditions/sequence-branch-audit.ts",
    "lib/growth/sequences/conditions/sequence-branch-advance-gate.ts",
    "app/api/platform/growth/sequences/conditions/evaluate/route.ts",
    "supabase/migrations/20270827120000_growth_sequence_conditions_sr3_phase1.sql",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ module files exist")

  const validSimple = parseSequenceConditionSpec({
    dslVersion: 1,
    source: "email",
    event: "email.opened",
  })
  assert.equal(validSimple.ok, true)
  console.log("  ✓ valid simple condition DSL accepted")

  const validLeadStatus = parseSequenceConditionSpec({
    dslVersion: 1,
    source: "lead",
    event: "lead.status",
    statusValue: "qualified",
  })
  assert.equal(validLeadStatus.ok, true)
  console.log("  ✓ valid lead.status condition DSL accepted")

  const validEngagement = parseSequenceConditionSpec({
    dslVersion: 1,
    source: "engagement",
    event: "engagement.score_threshold",
    operator: "gte",
    threshold: 75,
  })
  assert.equal(validEngagement.ok, true)
  console.log("  ✓ valid engagement.score_threshold condition DSL accepted")

  const invalidFreeform = parseSequenceConditionSpec({
    dslVersion: 1,
    source: "email",
    event: "email.opened",
    arbitrary: { nested: true },
  })
  assert.equal(invalidFreeform.ok, false)
  console.log("  ✓ freeform JSON fields rejected")

  const invalidSourceEvent = parseSequenceConditionSpec({
    dslVersion: 1,
    source: "sms",
    event: "email.opened",
  })
  assert.equal(invalidSourceEvent.ok, false)
  console.log("  ✓ source/event mismatch rejected")

  const invalidUnknownEvent = sequenceConditionSpecSchema.safeParse({
    dslVersion: 1,
    source: "email",
    event: "email.magic_happened",
  })
  assert.equal(invalidUnknownEvent.success, false)
  console.log("  ✓ unknown event rejected")

  assert.equal(validateSequenceBranchEdgeType("conditional_true").ok, true)
  assert.equal(validateSequenceBranchEdgeType("invalid_edge").ok, false)
  assert.deepEqual([...SEQUENCE_BRANCH_EDGE_TYPES], [
    "default",
    "conditional_true",
    "conditional_false",
    "timeout",
    "fallback",
  ])
  console.log("  ✓ edge type validation")

  assert.equal(validateSequenceEnrollmentWaitStatus("active").ok, true)
  assert.equal(validateSequenceEnrollmentWaitStatus("running").ok, false)
  assert.deepEqual([...SEQUENCE_ENROLLMENT_WAIT_STATUSES], [
    "pending",
    "active",
    "resolved",
    "timed_out",
    "cancelled",
  ])
  console.log("  ✓ wait status validation")

  const edge = (id: string, type: SequenceBranchEdge["edgeType"], conditionId: string | null, to: string): SequenceBranchEdge => ({
    id,
    patternId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fromPatternStepId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    toPatternStepId: to,
    conditionId,
    edgeType: type,
    priority: 10,
    label: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })

  const matched = resolveSequenceBranchEdges({
    fromPatternStepId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    edges: [
      edge("e1", "conditional_true", "c1", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
      edge("e2", "default", null, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
    ],
    evaluations: [{ conditionId: "c1", matched: true }],
  })
  assert.equal(matched.selectedEdge?.id, "e1")
  assert.equal(matched.skippedEdges.length, 1)
  console.log("  ✓ branch resolver conditional_true selection")

  const fallback = resolveSequenceBranchEdges({
    fromPatternStepId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    edges: [
      edge("e1", "conditional_true", "c1", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
      edge("e2", "default", null, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
    ],
    evaluations: [{ conditionId: "c1", matched: false }],
  })
  assert.equal(fallback.selectedEdge?.id, "e2")
  assert.equal(fallback.resolution, "default")
  console.log("  ✓ branch resolver default edge fallback")

  assert.equal(compareSequenceConditionNumeric("gte", 80, 75), true)
  assert.equal(compareSequenceConditionNumeric("lt", 10, 75), true)
  assert.equal(normalizeSequenceConditionTier("warming"), "warm")
  assert.match(
    maskSequenceConditionEvidenceRef("email_opens", "11111111-1111-4111-8111-111111111111"),
    /^email_opens:11111111…$/,
  )
  console.log("  ✓ deterministic evaluator helper functions")

  const evaluatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-condition-evaluator.ts"),
    "utf8",
  )
  const eventQuerySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-condition-event-query.ts"),
    "utf8",
  )
  assert.match(evaluatorSource, /evaluateSequenceConditionReadOnly/)
  assert.match(evaluatorSource, /readOnly: true/)
  for (const pattern of EVALUATOR_WRITE_FORBIDDEN_PATTERNS) {
    assert.doesNotMatch(evaluatorSource, pattern, "evaluator must not write")
  }
  assert.match(eventQuerySource, /sequence_enrollment_id/)
  assert.match(eventQuerySource, /sequence_enrollment_step_id/)
  assert.match(eventQuerySource, /enrollment_id/)
  console.log("  ✓ read-only evaluator + attribution-aware event query wiring")

  const apiRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/sequences/conditions/evaluate/route.ts"),
    "utf8",
  )
  assert.match(apiRouteSource, /requireGrowthEnginePlatformAccess/)
  assert.match(apiRouteSource, /evaluateSequenceConditionReadOnly/)
  assert.match(apiRouteSource, /read_only: true/)
  assert.match(apiRouteSource, /branch_execution_enabled: false/)
  assert.doesNotMatch(apiRouteSource, /\.insert\(/)
  console.log("  ✓ platform evaluate API is read-only")

  const repositorySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-condition-repository.ts"),
    "utf8",
  )
  for (const fn of [
    "createCondition",
    "updateCondition",
    "deleteCondition",
    "listConditionsForStep",
    "createEdge",
    "updateEdge",
    "deleteEdge",
    "listEdgesForPattern",
    "createWait",
    "updateWait",
    "appendBranchDecision",
    "listBranchDecisionsForEnrollment",
  ]) {
    assert.match(repositorySource, new RegExp(`export async function ${fn}`))
  }
  console.log("  ✓ repository surface exports")

  const enrollmentTypes = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequence-enrollment-types.ts"),
    "utf8",
  )
  assert.match(enrollmentTypes, /"waiting"/)
  assert.match(enrollmentTypes, /"branch_skipped"/)
  console.log("  ✓ enrollment step status types extended")

  const channelEventTypes = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequence-orchestration/sequence-multi-channel-state-types.ts"),
    "utf8",
  )
  assert.match(channelEventTypes, /branch_evaluated/)
  assert.match(channelEventTypes, /wait_started/)
  assert.match(channelEventTypes, /wait_resolved/)
  assert.match(channelEventTypes, /condition_timeout/)
  assert.match(channelEventTypes, /advancement_blocked/)
  console.log("  ✓ reserved channel event kinds documented")

  const waitRegistrySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-wait-registry.ts"),
    "utf8",
  )
  assert.match(waitRegistrySource, /resolveSequenceEnrollmentWaitRegistry/)
  assert.match(waitRegistrySource, /scheduleBranchTargetEnrollmentStep/)
  for (const pattern of BRANCH_PATH_FORBIDDEN_PATTERNS) {
    assert.doesNotMatch(waitRegistrySource, pattern, "wait registry must not execute transport")
  }
  console.log("  ✓ wait registry surface without direct transport execution")

  const orchestratorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"),
    "utf8",
  )
  assert.match(orchestratorSource, /applySequenceBranchResolution/)
  assert.match(orchestratorSource, /evaluateSequenceBranchAdvanceGate/)
  assert.match(orchestratorSource, /advanceGate\.blocked/)
  assert.match(orchestratorSource, /recordSequenceAdvancementBlockedAudit/)
  console.log("  ✓ advancement integration hooks + pause gate blocks all paths")

  const advanceGateSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-branch-advance-gate.ts"),
    "utf8",
  )
  assert.match(advanceGateSource, /recordSequenceAdvancementBlockedAudit/)
  assert.match(advanceGateSource, /runSequenceAdvancementGateSafetyProbes/)
  assert.match(advanceGateSource, /advancement_blocked/)
  console.log("  ✓ advancement gate audit + safety probes")

  const forbiddenScanTargets = [
    "lib/growth/sequences/execution/sequence-job-runner.ts",
    "lib/growth/sequences/execution/sequence-job-planner.ts",
    "lib/growth/sequences/conditions/sequence-wait-registry.ts",
  ]
  for (const relativePath of forbiddenScanTargets) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of RUNTIME_FORBIDDEN_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain runtime branching logic`)
    }
    if (!relativePath.includes("evaluator")) {
      assert.doesNotMatch(source, /executeSequenceBranch/)
    }
  }
  console.log("  ✓ no autonomous branch execution in job runner / wait registry")

  assert.equal(typeof createCondition, "function")
  assert.equal(typeof appendBranchDecision, "function")
  console.log("  ✓ repository imports resolve")

  console.log("\nSR-3 Phase 1/2/3 local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  process.env.GROWTH_SEQUENCE_CONDITIONS_CERT_ALLOW_LOCAL =
    process.env.GROWTH_SEQUENCE_CONDITIONS_CERT_ALLOW_LOCAL ?? "1"

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
  const { executeGrowthSequenceConditionsDiagnostics } = await import(
    "../lib/growth/sequences/conditions/sequence-condition-diagnostics"
  )
  return (await executeGrowthSequenceConditionsDiagnostics(admin)) as unknown as Record<string, unknown>
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

  console.log(`\n=== SR-3 Phase 1/2/3 ${mode} diagnostics ===\n`)
  const report = await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))

  const verdict = String(report.final_verdict ?? "FAIL")
  if (verdict === "FAIL") process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
