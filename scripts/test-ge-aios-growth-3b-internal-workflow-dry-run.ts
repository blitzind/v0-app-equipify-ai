/**
 * GE-AIOS-GROWTH-3B — Internal Workflow Dry Run certification.
 * Run: pnpm test:ge-aios-growth-3b-internal-workflow-dry-run
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { planGrowthLeadResearchExecution } from "../lib/growth/aios/growth/growth-lead-research-execution-plan"
import { auditWorkflowBoundary } from "../lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import { buildFutureExecutionHandoffContract } from "../lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import {
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
} from "../lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import {
  GROWTH_AIOS_GROWTH_3B_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_STATUSES,
  DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS,
} from "../lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import {
  runInternalWorkflowDryRun,
  validateDryRunExecutionGates,
} from "../lib/growth/aios/growth/growth-lead-research-execution-dry-run-engine"
import {
  getLatestDryRunReportForPlan,
  rememberLatestDryRunReport,
} from "../lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES,
  isInternalMutationRuntimeWorkflow,
  validateExecutionRuntimeGates,
} from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { createInMemoryExecutionRuntimeStore } from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-store"
import { assessGrowthLeadResearchOpportunity } from "../lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { qualifyGrowthLeadResearch } from "../lib/growth/aios/growth/growth-lead-research-workflow-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenPaths(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of [
    "createAiWorkOrder",
    "enroll_sequence",
    "invokeAiOsProvider",
    "public.invoices",
    "public.quotes",
    "sendEmail",
    "sendSms",
    "executeTransportSend",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

const readyInfrastructure = {
  providerReady: true,
  availableProviderIds: ["openai"],
  autonomyEnabled: true,
  emergencyStopActive: false,
  workflowFeatureEnabled: true,
}

/** Internal-mutation dry-run fixture — not yet package-sufficient; bounded verify_email work remains. */
const internalDryRunResearchResult = {
  companySummary: "Regional commercial HVAC contractor.",
  websiteSummary: "Commercial HVAC.",
  likelyServiceCategory: "HVAC",
  serviceAreaClues: ["Midwest"],
  companySizeEstimate: "40-60",
  equipmentServiceIndicators: ["fleet dispatch"],
  equipifyPainPoints: ["dispatch efficiency"],
  equipifyFitScore: 52,
  outreachAngles: ["fleet optimization"],
  recommendedNextAction: "Verify contacts",
  researchConfidence: 0.86,
  sourceUrls: ["https://example.com"],
  caveats: [],
  fitModelVersion: "v3",
  decisionMakerCandidates: [
    {
      fullName: "Jane Doe",
      title: "Ops Director",
      email: null,
      phone: null,
      linkedinUrl: null,
      confidence: 0.7,
      evidenceExcerpt: null,
    },
  ],
  estimatedAnnualRevenue: "$1.2M",
  estimatedEmployeeCount: "40-60",
  fleetSizeEstimate: "35 trucks",
  crmDetected: null,
  fieldServiceStackDetected: null,
}

/** Package-ready fixture — used only to assert outreach_generation stays non-dry-run-eligible. */
const packageReadyResearchResult = {
  ...internalDryRunResearchResult,
  equipifyFitScore: 78,
  decisionMakerCandidates: [],
}

console.log(`[${GROWTH_AIOS_GROWTH_3B_PHASE}] Internal Workflow Dry Run certification`)

assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
  "growth-aios-growth-3b-execution-dry-run-v1",
)
assert.match(GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE, /non-persistent|No persistence/i)
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_STATUSES.length, 4)

assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-dry-run-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-dry-run-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-dry-run-service.ts")

const dryRunRouteSource = readSource("app/api/platform/growth/ai-os/execution-runtime/dry-run/route.ts")
assert.match(dryRunRouteSource, /dry-run/)
assert.equal(dryRunRouteSource.includes("enqueueGrowthLeadResearchExecution"), false)
assert.equal(dryRunRouteSource.includes("runGrowthLeadResearchExecutionLifecycle"), false)

const uiSource = readSource("components/growth/ai-os/command-center/growth-ai-os-execution-runtime-section.tsx")
assert.match(uiSource, /Dry-run|dry-run/)
assert.match(uiSource, /Non-persistent|non-persistent/)
assert.equal(uiSource.includes("enqueueGrowthLeadResearchExecution"), false)
assert.equal(uiSource.toLowerCase().includes("launch"), false)

const qualification = qualifyGrowthLeadResearch({
  result: internalDryRunResearchResult,
  researchRunStatus: "succeeded",
})
const intelligence = assessGrowthLeadResearchOpportunity({
  result: internalDryRunResearchResult,
  qualification: qualification.qualification,
})
assert.equal(intelligence.opportunityAssessment.recommendation, "verify_contacts")
const executionPlan = { ...intelligence.executionPlan, missingPrerequisites: [] as string[] }
assert.equal(executionPlan.workflowType, "verify_email")
assert.equal(isInternalMutationRuntimeWorkflow(executionPlan.workflowType), true)

const packageReadyQualification = qualifyGrowthLeadResearch({
  result: packageReadyResearchResult,
  researchRunStatus: "succeeded",
})
const packageReadyIntelligence = assessGrowthLeadResearchOpportunity({
  result: packageReadyResearchResult,
  qualification: packageReadyQualification.qualification,
})
assert.equal(packageReadyIntelligence.opportunityAssessment.recommendation, "prepare_outreach")
assert.equal(packageReadyIntelligence.executionPlan.workflowType, "outreach_generation")
assert.equal(isInternalMutationRuntimeWorkflow(packageReadyIntelligence.executionPlan.workflowType), false)

const fixedNow = "2026-06-25T12:00:00.000Z"
const planId = `glr-ep:lead-cert-3b:${executionPlan.workflowType}:${executionPlan.workflowType}`

const boundary = auditWorkflowBoundary(executionPlan.workflowType, readyInfrastructure)
const workflowPreflight = buildWorkflowPreflightChecklist({ boundary, infrastructure: readyInfrastructure })
const handoff = buildFutureExecutionHandoffContract({
  planId,
  leadId: "lead-cert-3b",
  companyName: "Cert HVAC Co",
  plan: executionPlan,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  readinessReason: "ready",
  futureExecutionEligible: true,
  evidenceSummary: null,
  auditTrail: { leadId: "lead-cert-3b", planId, entries: [] },
  infrastructure: readyInfrastructure,
  generatedAt: fixedNow,
  observationHref: "/growth/os/pilot/lead-research/lead-cert-3b",
})
const planPreflight = buildPlanPreflightChecklist({ handoff, workflowChecklist: workflowPreflight })

const passingValidation = validateDryRunExecutionGates({
  runtimeEnabled: false,
  workflowType: executionPlan.workflowType,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: planPreflight.preflightStatus,
  boundaryClassification: boundary.classification,
  runtimeImplementationAllowed: planPreflight.runtimeImplementationAllowed,
  futureExecutionAllowed: boundary.futureExecutionAllowed,
})
assert.equal(passingValidation.allowed, true)

const runtimeDisabledButDryRunPasses = validateDryRunExecutionGates({
  runtimeEnabled: false,
  workflowType: executionPlan.workflowType,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: "preflight_passed",
  boundaryClassification: "internal_mutation_only",
  runtimeImplementationAllowed: true,
  futureExecutionAllowed: true,
})
assert.equal(runtimeDisabledButDryRunPasses.allowed, true)

const realRuntimeDisabled = validateExecutionRuntimeGates({
  runtimeEnabled: false,
  workflowType: executionPlan.workflowType,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: "preflight_passed",
  boundaryClassification: "internal_mutation_only",
  runtimeImplementationAllowed: true,
  futureExecutionAllowed: true,
})
assert.equal(realRuntimeDisabled.allowed, false)
assert.equal(realRuntimeDisabled.blockCode, "runtime_disabled")

async function runAsyncCert(): Promise<void> {
const store = createInMemoryExecutionRuntimeStore()
const recordsBefore = await store.list("org-cert-3b")

const report = runInternalWorkflowDryRun({
  organizationId: "org-cert-3b",
  planId,
  leadId: "lead-cert-3b",
  executionPlan,
  validation: passingValidation,
  now: fixedNow,
  dryRunId: `glr-dry-run:${planId}:${fixedNow}`,
})

assert.equal(report.finalStatus, "dry_run_passed")
assert.equal(report.nonPersistent, true)
assert.equal(report.planId, planId)
assert.equal(report.simulatedSteps.every((step) => step.status === "completed"), true)
assert.equal(report.simulatedStateTransitions.at(-1)?.nextState, "completed")
assert.deepEqual(report.sideEffectCounters, DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS)
assert.ok(report.predictedAuditEvents.length > 0)
assert.ok(
  report.predictedAuditEvents.some(
    (event) => event.eventType === GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.stepCompleted,
  ),
)

const recordsAfter = await store.list("org-cert-3b")
assert.deepEqual(recordsBefore, recordsAfter)

const report2 = runInternalWorkflowDryRun({
  organizationId: "org-cert-3b",
  planId,
  leadId: "lead-cert-3b",
  executionPlan,
  validation: passingValidation,
  now: fixedNow,
  dryRunId: `glr-dry-run:${planId}:${fixedNow}`,
})
assert.equal(report2.finalStatus, report.finalStatus)
assert.equal(report2.simulatedSteps.length, report.simulatedSteps.length)
assert.equal(report2.simulatedInternalMutations.length, report.simulatedInternalMutations.length)

for (const workflow of ["verify_email", "buying_committee", "research_company", "meeting_preparation"] as const) {
  assert.equal(isInternalMutationRuntimeWorkflow(workflow), true)
}

for (const workflow of ["outreach_generation", "monitoring", "approval", "close"] as const) {
  assert.equal(isInternalMutationRuntimeWorkflow(workflow), false)
  const outreachPlan = planGrowthLeadResearchExecution({
    nextBestAction: { kind: "generate_outreach", reason: "Outreach", priority: "high" },
    opportunityAssessment: intelligence.opportunityAssessment,
    evidenceSummary: intelligence.evidenceSummary,
    qualification: qualification.qualification,
  })
  outreachPlan.workflowType = workflow as typeof outreachPlan.workflowType
  const blockedReport = runInternalWorkflowDryRun({
    organizationId: "org-cert-3b",
    planId: `glr-ep:blocked:${workflow}`,
    leadId: "lead-cert-3b",
    executionPlan: outreachPlan,
    validation: validateDryRunExecutionGates({
      runtimeEnabled: true,
      workflowType: workflow as typeof outreachPlan.workflowType,
      approvalState: "approved_for_future_execution",
      readinessState: "ready_for_future_execution",
      handoffState: "handoff_ready",
      preflightStatus: "preflight_passed",
      boundaryClassification: "outbound_requires_human_approval",
      runtimeImplementationAllowed: false,
      futureExecutionAllowed: false,
    }),
    now: fixedNow,
  })
  assert.equal(blockedReport.finalStatus, "dry_run_not_allowed")
}

const gateFailValidation = validateDryRunExecutionGates({
  runtimeEnabled: true,
  workflowType: executionPlan.workflowType,
  approvalState: "pending_review",
  readinessState: "blocked_missing_approval",
  handoffState: "handoff_blocked",
  preflightStatus: "preflight_blocked",
  boundaryClassification: "internal_mutation_only",
  runtimeImplementationAllowed: false,
  futureExecutionAllowed: true,
})
const gateFailReport = runInternalWorkflowDryRun({
  organizationId: "org-cert-3b",
  planId: "glr-ep:gate-fail",
  leadId: "lead-cert-3b",
  executionPlan,
  validation: gateFailValidation,
  now: fixedNow,
})
assert.equal(gateFailValidation.allowed, false)
assert.equal(gateFailReport.finalStatus, "dry_run_failed_gate_validation")
assert.ok(gateFailReport.blockedReasons.length > 0)
assert.equal(gateFailReport.predictedAuditEvents.length, 0)

rememberLatestDryRunReport(report)
assert.equal(getLatestDryRunReportForPlan(planId)?.dryRunId, report.dryRunId)

console.log("[GE-AIOS-GROWTH-3B] PASS — dry-run harness certified")
console.log("[GE-AIOS-GROWTH-3B] Running 2B/2C/3A regressions…")

for (const script of [
  "test:ge-aios-growth-2b-execution-preflight-checklist",
  "test:ge-aios-growth-2c-execution-simulation",
  "test:ge-aios-growth-3a-runtime-foundation",
]) {
  const result = spawnSync("pnpm", [script], { stdio: "inherit", shell: true })
  assert.equal(result.status, 0, `${script} regression failed`)
}

console.log("[GE-AIOS-GROWTH-3B] PASS — all regressions green")
}

runAsyncCert().catch((error) => {
  console.error(error)
  process.exit(1)
})
