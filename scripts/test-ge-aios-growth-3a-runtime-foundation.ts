/**
 * GE-AIOS-GROWTH-3A — Execution Runtime Foundation certification.
 * Run: pnpm test:ge-aios-growth-3a-runtime-foundation
 */
import assert from "node:assert/strict"
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
  assertExecutionTransition,
  buildExecutionId,
  buildInitialStepProgress,
  canTransitionExecutionState,
  GROWTH_AIOS_GROWTH_3A_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_STATES,
  GROWTH_LEAD_RESEARCH_INTERNAL_MUTATION_RUNTIME_WORKFLOWS,
  isInternalMutationRuntimeWorkflow,
  isTerminalExecutionState,
  validateExecutionRuntimeGates,
} from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import { createInMemoryExecutionRuntimeStore } from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-store"
import {
  cancelGrowthLeadResearchExecution,
  enqueueGrowthLeadResearchExecution,
  pauseGrowthLeadResearchExecution,
  resumeGrowthLeadResearchExecution,
  runGrowthLeadResearchExecutionLifecycle,
} from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service"
import { runDeterministicExecutionStep } from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-step-runner"
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

const researchResult = {
  companySummary: "Regional commercial HVAC contractor.",
  websiteSummary: "Commercial HVAC.",
  likelyServiceCategory: "HVAC",
  serviceAreaClues: ["Midwest"],
  companySizeEstimate: "40-60",
  equipmentServiceIndicators: ["fleet dispatch"],
  equipifyPainPoints: ["dispatch efficiency"],
  equipifyFitScore: 78,
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

console.log(`[${GROWTH_AIOS_GROWTH_3A_PHASE}] Execution Runtime Foundation certification`)

assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  "growth-aios-growth-3a-execution-runtime-v1",
)
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED, false)
assert.match(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE, /internal_mutation_only/)
assert.match(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE, /Disabled by default/)
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_STATES.length, 8)
assert.equal(GROWTH_LEAD_RESEARCH_INTERNAL_MUTATION_RUNTIME_WORKFLOWS.length, 4)

for (const workflow of ["verify_email", "buying_committee", "research_company", "meeting_preparation"] as const) {
  assert.equal(isInternalMutationRuntimeWorkflow(workflow), true)
}
for (const workflow of ["outreach_generation", "monitoring", "approval", "close"] as const) {
  assert.equal(isInternalMutationRuntimeWorkflow(workflow), false)
}

assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-runtime-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-runtime-step-runner.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-runtime-store.ts")

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})
const executionPlan = { ...intelligence.executionPlan, missingPrerequisites: [] as string[] }

assert.equal(executionPlan.workflowType, "verify_email")
assert.ok(executionPlan.estimatedSteps.length >= 2)

const boundary = auditWorkflowBoundary("verify_email", readyInfrastructure)
const workflowPreflight = buildWorkflowPreflightChecklist({ boundary, infrastructure: readyInfrastructure })
const handoff = buildFutureExecutionHandoffContract({
  planId: "glr-ep:lead-cert-3a:verify_email:verify_email",
  leadId: "lead-cert-3a",
  companyName: "Cert HVAC Co",
  plan: executionPlan,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  readinessReason: "ready",
  futureExecutionEligible: true,
  evidenceSummary: null,
  auditTrail: { leadId: "lead-cert-3a", planId: "glr-ep:lead-cert-3a:verify_email:verify_email", entries: [] },
  infrastructure: readyInfrastructure,
  generatedAt: new Date(0).toISOString(),
  observationHref: "/growth/os/pilot/lead-research/lead-cert-3a",
})
const planPreflight = buildPlanPreflightChecklist({ handoff, workflowChecklist: workflowPreflight })

const passingValidation = validateExecutionRuntimeGates({
  runtimeEnabled: true,
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

const blockedWhenDisabled = validateExecutionRuntimeGates({
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
assert.equal(blockedWhenDisabled.allowed, false)
assert.equal(blockedWhenDisabled.blockCode, "runtime_disabled")

const blockedOutreach = validateExecutionRuntimeGates({
  runtimeEnabled: true,
  workflowType: "outreach_generation",
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: "preflight_passed",
  boundaryClassification: "outbound_requires_human_approval",
  runtimeImplementationAllowed: false,
  futureExecutionAllowed: false,
})
assert.equal(blockedOutreach.allowed, false)
assert.equal(blockedOutreach.blockCode, "unsupported_workflow")

assert.equal(canTransitionExecutionState("queued", "validating"), true)
assert.equal(canTransitionExecutionState("executing", "paused"), true)
assert.equal(canTransitionExecutionState("paused", "executing"), true)
assert.equal(canTransitionExecutionState("completed", "executing"), false)
assert.equal(assertExecutionTransition("executing", "completed").ok, true)
assert.equal(assertExecutionTransition("failed", "executing").ok, false)

async function runAsyncCert(): Promise<void> {
const store = createInMemoryExecutionRuntimeStore()
const planId = "glr-ep:lead-cert-3a:verify_email:verify_email"
const fixedNow = "2026-06-25T12:00:00.000Z"

const queued = await enqueueGrowthLeadResearchExecution(store, {
  organizationId: "org-cert-3a",
  planId,
  leadId: "lead-cert-3a",
  companyName: "Cert HVAC Co",
  executionPlan,
  approvalState: "approved_for_future_execution",
  confidence: 0.86,
  operatorUserId: "operator-cert",
  runtimeEnabled: true,
  now: fixedNow,
})
assert.equal(queued.state, "queued")
assert.equal(buildExecutionId(planId), queued.executionId)
assert.deepEqual(
  queued.steps.map((step) => step.status),
  buildInitialStepProgress(executionPlan).map((step) => step.status),
)

const lifecycle = await runGrowthLeadResearchExecutionLifecycle(store, {
  executionId: queued.executionId,
  validation: passingValidation,
  now: fixedNow,
})
assert.equal(lifecycle.record.state, "completed")
assert.equal(lifecycle.record.context?.internalMutations.length, executionPlan.estimatedSteps.length)
assert.equal(lifecycle.record.context?.outboundActionsAttempted, 0)
assert.equal(lifecycle.record.context?.providerCallsAttempted, 0)
assert.equal(lifecycle.record.context?.coreMutationsAttempted, 0)
assert.equal(isTerminalExecutionState(lifecycle.record.state), true)

const auditTrail = await store.listAudit(lifecycle.record.executionId)
assert.ok(auditTrail.length >= executionPlan.estimatedSteps.length)

const pauseStore = createInMemoryExecutionRuntimeStore()
const pausePlan = planGrowthLeadResearchExecution({
  nextBestAction: { kind: "research_buying_committee", reason: "Map committee", priority: "medium" },
  opportunityAssessment: intelligence.opportunityAssessment,
  evidenceSummary: intelligence.evidenceSummary,
  qualification: qualification.qualification,
})
pausePlan.missingPrerequisites = []
const pauseQueued = await enqueueGrowthLeadResearchExecution(pauseStore, {
  organizationId: "org-cert-3a",
  planId: "glr-ep:lead-cert-3a:buying_committee:research_buying_committee",
  leadId: "lead-cert-3a",
  companyName: "Cert HVAC Co",
  executionPlan: pausePlan,
  approvalState: "approved_for_future_execution",
  confidence: 0.86,
  runtimeEnabled: true,
  now: fixedNow,
})
await runGrowthLeadResearchExecutionLifecycle(pauseStore, {
  executionId: pauseQueued.executionId,
  validation: validateExecutionRuntimeGates({
    runtimeEnabled: true,
    workflowType: pausePlan.workflowType,
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    handoffState: "handoff_ready",
    preflightStatus: "preflight_passed",
    boundaryClassification: "internal_mutation_only",
    runtimeImplementationAllowed: true,
    futureExecutionAllowed: true,
  }),
  now: fixedNow,
  maxSteps: 1,
})
const paused = await pauseGrowthLeadResearchExecution(pauseStore, pauseQueued.executionId, fixedNow)
assert.equal(paused.state, "paused")

const resumed = await resumeGrowthLeadResearchExecution(pauseStore, {
  executionId: pauseQueued.executionId,
  validation: validateExecutionRuntimeGates({
    runtimeEnabled: true,
    workflowType: pausePlan.workflowType,
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    handoffState: "handoff_ready",
    preflightStatus: "preflight_passed",
    boundaryClassification: "internal_mutation_only",
    runtimeImplementationAllowed: true,
    futureExecutionAllowed: true,
  }),
  now: fixedNow,
})
assert.equal(resumed.record.state, "completed")

const cancelStore = createInMemoryExecutionRuntimeStore()
const cancelQueued = await enqueueGrowthLeadResearchExecution(cancelStore, {
  organizationId: "org-cert-3a",
  planId: "glr-ep:lead-cert-3a:verify_email:verify_email:cancel",
  leadId: "lead-cert-3a",
  companyName: "Cert HVAC Co",
  executionPlan,
  approvalState: "approved_for_future_execution",
  confidence: 0.86,
  runtimeEnabled: true,
  now: fixedNow,
})
const cancelled = await cancelGrowthLeadResearchExecution(cancelStore, cancelQueued.executionId, fixedNow)
assert.equal(cancelled.state, "cancelled")

const stepResult = runDeterministicExecutionStep({
  context: {
    executionId: "glr-exec:test",
    planId: "test",
    leadId: "lead",
    organizationId: "org",
    workflowType: "verify_email",
    executionPlan,
    startedAt: fixedNow,
    gateSnapshot: passingValidation.gateSnapshot,
    internalMutations: [],
    outboundActionsAttempted: 0,
    providerCallsAttempted: 0,
    coreMutationsAttempted: 0,
  },
  step: executionPlan.estimatedSteps[0],
  now: fixedNow,
})
assert.equal(stepResult.ok, true)
if (stepResult.ok) {
  assert.equal(stepResult.context.outboundActionsAttempted, 0)
  assert.equal(stepResult.mutation.scope, "growth_internal")
}

assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
  "growth.execution_runtime.lifecycle_changed",
)
assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.stepCompleted,
  "growth.execution_runtime.step_completed",
)

console.log("  ✓ QA marker and runtime rule")
console.log("  ✓ Execution disabled by default")
console.log("  ✓ Internal mutation workflows only")
console.log("  ✓ State machine transitions")
console.log("  ✓ Gate validation (approval, readiness, handoff, preflight, boundary)")
console.log("  ✓ Deterministic step execution and lifecycle completion")
console.log("  ✓ Pause, resume, cancel")
console.log("  ✓ Audit history persisted in store")
console.log("  ✓ Zero outbound / provider / Core paths in runtime foundation")
console.log(`[${GROWTH_AIOS_GROWTH_3A_PHASE}] PASS`)
}

runAsyncCert().catch((error) => {
  console.error(error)
  process.exit(1)
})
