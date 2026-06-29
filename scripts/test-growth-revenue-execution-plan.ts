/**
 * GE-IRE-8B — Native Revenue Execution Planner certification.
 * Run: pnpm test:growth-revenue-execution-plan
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { NextBestAction } from "../lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "../lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "../lib/growth/contact-verification/sequence-recommendation-types"
import {
  isRevenueExecutionPlanEnabled,
  isRevenueExecutionPlanEnabledClient,
  GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER,
} from "../lib/growth/contact-verification/revenue-execution-plan-feature"
import {
  buildApprovalsRequired,
  buildExecutionSteps,
  buildRevenueExecutionPlan,
  estimateDurationMinutes,
  GROWTH_REVENUE_EXECUTION_PLAN_QA_MARKER,
  resolveExecutionMode,
  resolveExecutionState,
  resolveRecommendedWorkflow,
  REVENUE_EXECUTION_PLAN_DURATION_MINUTES,
} from "../lib/growth/contact-verification/revenue-execution-planner"
import {
  assertRevenueExecutionPlanViewHasNoSensitiveData,
  buildRevenueExecutionPlanView,
  formatDurationLabel,
  sanitizeRevenueExecutionPlanView,
} from "../lib/growth/contact-verification/revenue-execution-plan-view"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }) as Promise<T>
}

const FIXTURE_QUALIFICATION: ProspectQualification = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  qualification: "qualified",
  overallScore: 78,
  fitScore: 82,
  contactScore: 86,
  engagementScore: 72,
  buyingCommitteeCoverage: 67,
  confidence: 80,
  acquisitionCandidate: {
    version: 1,
    companyId: "company-fixture-001",
    generatedAt: "2026-06-28T00:00:00.000Z",
    primaryContact: {
      personId: "person-001",
      fullName: "Chris Taylor",
      title: "VP Operations",
      email: "chris.taylor@precisionbiomedical.com",
      confidence: 88,
    },
    verification: { emailVerified: true, deliverability: "verified", confidence: 92 },
    committee: { role: "economic_buyer", confidence: 72 },
    outreach: { readiness: "ready", preferredChannel: "email", recommendedSequence: "Executive outbound" },
    backupContacts: [],
    blockers: [],
    reasons: ["Verified executive contact"],
    overallConfidence: 85,
  },
  strengths: ["Verified executive contact"],
  risks: [],
  blockers: [],
  recommendations: ["Enroll in outbound sequence"],
  nextAction: "enroll_sequence",
}

const FIXTURE_SEQUENCE: SequenceRecommendation = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  recommendedSequence: { name: "Executive Cold Outbound Sequence", type: "cold_outbound", confidence: 88 },
  enrollmentReadiness: "ready",
  preferredChannel: "email",
  cadence: { intensity: "high", suggestedTouchCount: 5, suggestedDurationDays: 14 },
  personalizationInputs: { primaryReason: "Verified executive contact" },
  reasons: ["Qualification permits sequence enrollment"],
  risks: [],
  blockers: [],
  nextAction: "enroll_sequence",
  confidence: 82,
}

const FIXTURE_NBA: NextBestAction = {
  version: 1,
  companyId: "company-fixture-001",
  generatedAt: "2026-06-28T00:00:00.000Z",
  action: "enroll_sequence",
  priority: "high",
  confidence: 84,
  executionReadiness: "ready",
  recommendedSequence: { name: "Executive Cold Outbound Sequence" },
  recommendedChannel: "email",
  recommendedDelayHours: 0,
  reasons: ["Qualified and ready for enrollment"],
  blockers: [],
  dependencies: [],
  warnings: [],
}

const FIXTURE_NBA_VERIFY: NextBestAction = {
  ...FIXTURE_NBA,
  action: "verify_contact",
  executionReadiness: "waiting",
  dependencies: ["Verified email required"],
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-8B Revenue Execution Planner Certification ===\n")

  assert.equal(GROWTH_REVENUE_EXECUTION_PLAN_QA_MARKER, "revenue-execution-plan-v1")
  assert.equal(REVENUE_EXECUTION_PLAN_DURATION_MINUTES.version, "rep-v1")
  assert.equal(isRevenueExecutionPlanEnabled(), false)
  assert.equal(isRevenueExecutionPlanEnabled({ GROWTH_REVENUE_EXECUTION_PLAN: "true" }), true)
  assert.equal(isRevenueExecutionPlanEnabledClient(), false)
  console.log("  ✓ Feature flag false by default")

  const plannerSource = readSource("lib/growth/contact-verification/revenue-execution-planner.ts")
  assert.match(plannerSource, /buildNextBestAction/)
  assert.match(plannerSource, /buildProspectQualification/)
  assert.match(plannerSource, /buildSequenceRecommendation/)
  assert.doesNotMatch(plannerSource, /openai/i)
  assert.doesNotMatch(plannerSource, /enrollContact/i)
  assert.doesNotMatch(plannerSource, /\.insert\(/)
  console.log("  ✓ Planner consumes canonical stack without AI, execution, or persistence")

  assert.equal(resolveRecommendedWorkflow("enroll_sequence"), "sequence_enrollment")
  assert.equal(resolveRecommendedWorkflow("verify_contact"), "verification")
  assert.equal(resolveRecommendedWorkflow("research_company"), "research")
  assert.equal(resolveRecommendedWorkflow("identify_decision_maker"), "research")
  assert.equal(resolveRecommendedWorkflow("manual_review"), "manual_review")
  assert.equal(resolveRecommendedWorkflow("monitor_buying_signals"), "monitor")
  assert.equal(resolveRecommendedWorkflow("disqualify"), "manual_review")
  console.log("  ✓ Deterministic workflow mapping")

  assert.equal(resolveExecutionState(FIXTURE_NBA), "ready")
  assert.equal(resolveExecutionState({ ...FIXTURE_NBA, executionReadiness: "blocked" }), "blocked")
  console.log("  ✓ Execution state rules")

  const readyMode = resolveExecutionMode({
    nextBestAction: FIXTURE_NBA,
    qualification: FIXTURE_QUALIFICATION,
    sequence: FIXTURE_SEQUENCE,
  })
  assert.equal(readyMode, "ready_for_execution")

  const approvalMode = resolveExecutionMode({
    nextBestAction: FIXTURE_NBA_VERIFY,
    qualification: {
      ...FIXTURE_QUALIFICATION,
      acquisitionCandidate: {
        ...FIXTURE_QUALIFICATION.acquisitionCandidate,
        verification: { emailVerified: false, deliverability: "unknown", confidence: 40 },
      },
    },
    sequence: { ...FIXTURE_SEQUENCE, enrollmentReadiness: "needs_verification" },
  })
  assert.equal(approvalMode, "approval_required")

  const reviewMode = resolveExecutionMode({
    nextBestAction: { ...FIXTURE_NBA, action: "manual_review", executionReadiness: "blocked" },
    qualification: { ...FIXTURE_QUALIFICATION, qualification: "blocked" },
    sequence: FIXTURE_SEQUENCE,
  })
  assert.equal(reviewMode, "human_review")
  console.log("  ✓ Execution mode rules")

  const enrollmentSteps = buildExecutionSteps({
    workflow: "sequence_enrollment",
    nextBestAction: FIXTURE_NBA,
    qualification: FIXTURE_QUALIFICATION,
    sequence: FIXTURE_SEQUENCE,
  })
  assert.ok(enrollmentSteps.length >= 5)
  assert.ok(enrollmentSteps.some((step) => step.id === "enroll_sequence"))
  assert.ok(enrollmentSteps.some((step) => step.id === "monitor_engagement"))

  const verifySteps = buildExecutionSteps({
    workflow: "verification",
    nextBestAction: FIXTURE_NBA_VERIFY,
    qualification: FIXTURE_QUALIFICATION,
    sequence: FIXTURE_SEQUENCE,
  })
  assert.equal(verifySteps.length, 3)
  console.log("  ✓ Execution step generation")

  const approvals = buildApprovalsRequired({
    executionMode: "ready_for_execution",
    nextBestAction: FIXTURE_NBA,
    qualification: FIXTURE_QUALIFICATION,
    sequence: FIXTURE_SEQUENCE,
  })
  assert.ok(approvals.some((item) => item.includes("Human approval required before enrollment")))
  console.log("  ✓ Approval generation")

  const duration = estimateDurationMinutes({
    workflow: "sequence_enrollment",
    executionSteps: enrollmentSteps,
  })
  assert.ok(duration >= REVENUE_EXECUTION_PLAN_DURATION_MINUTES.sequence_enrollment)
  assert.equal(formatDurationLabel(45), "45 minutes")
  assert.equal(formatDurationLabel(60), "1 hour")
  console.log("  ✓ Duration estimation")

  let nbaCalls = 0
  const plan = await buildRevenueExecutionPlan(
    {
      companyId: "company-fixture-001",
      qualification: FIXTURE_QUALIFICATION,
      sequenceRecommendation: FIXTURE_SEQUENCE,
      nextBestAction: FIXTURE_NBA,
      generatedAt: "2026-06-28T00:00:00.000Z",
    },
    {
      buildNextBestAction: async () => {
        nbaCalls += 1
        return FIXTURE_NBA
      },
    },
  )
  assert.equal(nbaCalls, 0)
  assert.equal(plan.version, 1)
  assert.equal(plan.recommendedWorkflow, "sequence_enrollment")
  assert.equal(plan.executionMode, "ready_for_execution")
  assert.ok(plan.executionSteps.length > 0)
  assert.ok(plan.approvalsRequired.length > 0)
  console.log("  ✓ Next Best Action consumed; plan built from pre-built artifacts")

  const sanitized = sanitizeRevenueExecutionPlanView(plan)
  assert.equal(sanitized.qa_marker, GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER)
  assert.ok(assertRevenueExecutionPlanViewHasNoSensitiveData(sanitized))
  console.log("  ✓ View sanitization")

  await withEnv({ GROWTH_REVENUE_EXECUTION_PLAN: "true" }, async () => {
    const view = await buildRevenueExecutionPlanView({
      companyId: "company-fixture-001",
      qualification: FIXTURE_QUALIFICATION,
      sequenceRecommendation: FIXTURE_SEQUENCE,
      nextBestAction: FIXTURE_NBA,
    })
    assert.ok(view)
    assert.equal(view?.recommended_workflow, "sequence_enrollment")
  })

  await withEnv({ GROWTH_REVENUE_EXECUTION_PLAN: undefined }, async () => {
    const view = await buildRevenueExecutionPlanView({
      companyId: "company-fixture-001",
      qualification: FIXTURE_QUALIFICATION,
      sequenceRecommendation: FIXTURE_SEQUENCE,
      nextBestAction: FIXTURE_NBA,
    })
    assert.equal(view, null)
    console.log("  ✓ Feature-gated view builder")
  })

  const panelSource = readSource(
    "components/growth/prospect-search/prospect-search-revenue-execution-plan-panel.tsx",
  )
  assert.match(panelSource, /GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER/)
  assert.match(panelSource, /Collapsible/)
  assert.match(panelSource, /useState\(false\)/)
  assert.match(panelSource, /Read-only preview/)
  assert.doesNotMatch(panelSource, /enroll/i)
  console.log("  ✓ Panel collapsible, lazy-loaded, read-only")

  const panelMountSource = readSource("components/growth/prospect-search/company-contact-intelligence-panel.tsx")
  assert.match(panelMountSource, /ProspectSearchRevenueExecutionPlanPanel/)
  assert.match(panelMountSource, /ProspectSearchNextBestActionPanel/)
  const nbaIndex = panelMountSource.indexOf("ProspectSearchNextBestActionPanel")
  const repIndex = panelMountSource.indexOf("ProspectSearchRevenueExecutionPlanPanel")
  assert.ok(nbaIndex >= 0 && repIndex > nbaIndex)
  console.log("  ✓ Panel mounted beneath Next Best Action")

  const apiSource = readSource("app/api/platform/growth/prospect-search/revenue-execution-plan/route.ts")
  assert.match(apiSource, /isRevenueExecutionPlanEnabled/)
  assert.match(apiSource, /buildRevenueExecutionPlanView/)
  assert.doesNotMatch(apiSource, /\.insert\(/)
  console.log("  ✓ Diagnostic API gated, read-only, no persistence")

  assert.match(readSource("next.config.mjs"), /NEXT_PUBLIC_GROWTH_REVENUE_EXECUTION_PLAN/)
  assert.match(readSource("package.json"), /test:growth-revenue-execution-plan/)
  console.log("  ✓ Client env exposure and test script registered")

  console.log("\nGE-IRE-8B revenue execution planner certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
