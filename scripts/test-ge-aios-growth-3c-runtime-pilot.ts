/**
 * GE-AIOS-GROWTH-3C — Execution Runtime Pilot certification.
 * Run: pnpm test:ge-aios-growth-3c-runtime-pilot
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  planGrowthLeadResearchExecution,
} from "../lib/growth/aios/growth/growth-lead-research-execution-plan"
import { buildGrowthLeadResearchExecutionPlanId } from "../lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { auditWorkflowBoundary } from "../lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import { buildFutureExecutionHandoffContract } from "../lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import {
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
} from "../lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import {
  runInternalWorkflowDryRun,
  validateDryRunExecutionGates,
} from "../lib/growth/aios/growth/growth-lead-research-execution-dry-run-engine"
import {
  getLatestDryRunReportForPlan,
  rememberLatestDryRunReport,
} from "../lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import {
  GROWTH_AIOS_GROWTH_3C_PHASE,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_DEFAULT_ENABLED,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_RULE,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW,
  buildExecutionRuntimePilotSummary,
  isRuntimePilotWorkflow,
  validateExecutionRuntimePilotEnqueue,
} from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES,
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

console.log(`[${GROWTH_AIOS_GROWTH_3C_PHASE}] Execution Runtime Pilot certification`)

assert.equal(
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER,
  "growth-aios-growth-3c-execution-runtime-pilot-v1",
)
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_DEFAULT_ENABLED, false)
assert.equal(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_WORKFLOW, "research_company")
assert.match(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_RULE, /research_company/)
assert.match(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_RULE, /dry_run_passed|dry-run/i)

assert.equal(isRuntimePilotWorkflow("research_company"), true)
assert.equal(isRuntimePilotWorkflow("verify_email"), false)
assert.equal(isRuntimePilotWorkflow("outreach_generation"), false)

assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service.ts")
assertNoForbiddenPaths("app/api/platform/growth/ai-os/execution-runtime/enqueue/route.ts")

const enqueueRoute = readSource("app/api/platform/growth/ai-os/execution-runtime/enqueue/route.ts")
assert.match(enqueueRoute, /validateGrowthLeadResearchExecutionPilotEnqueue/)
assert.equal(enqueueRoute.includes("createAiWorkOrder"), false)
assert.equal(enqueueRoute.toLowerCase().includes("launch"), false)

const uiSource = readSource("components/growth/ai-os/command-center/growth-ai-os-execution-runtime-section.tsx")
assert.match(uiSource, /Runtime Pilot|research_company/)
assert.match(uiSource, /Enqueue/)
assert.equal(
  uiSource.includes(GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER) ||
    uiSource.includes("GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER"),
  true,
)
assert.equal(uiSource.toLowerCase().includes("launch"), false)

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildPilotEligibilityForPlan/)
assert.match(missionPlanning, /pilotEligible/)

const qualification = qualifyGrowthLeadResearch({ result: researchResult, researchRunStatus: "succeeded" })
const intelligence = assessGrowthLeadResearchOpportunity({
  result: researchResult,
  qualification: qualification.qualification,
})

const researchPlan = planGrowthLeadResearchExecution({
  nextBestAction: { kind: "continue_research", reason: "Supplemental company research", priority: "medium" },
  opportunityAssessment: intelligence.opportunityAssessment,
  evidenceSummary: intelligence.evidenceSummary,
  qualification: qualification.qualification,
})
researchPlan.missingPrerequisites = []
assert.equal(researchPlan.workflowType, "research_company")

const verifyPlan = planGrowthLeadResearchExecution({
  nextBestAction: { kind: "verify_email", reason: "Verify contact", priority: "high" },
  opportunityAssessment: intelligence.opportunityAssessment,
  evidenceSummary: intelligence.evidenceSummary,
  qualification: qualification.qualification,
})
verifyPlan.missingPrerequisites = []

const fixedNow = "2026-06-25T12:00:00.000Z"
const leadId = "lead-cert-3c"
const planId = buildGrowthLeadResearchExecutionPlanId({ leadId, plan: researchPlan })

const boundary = auditWorkflowBoundary("research_company", readyInfrastructure)
const workflowPreflight = buildWorkflowPreflightChecklist({ boundary, infrastructure: readyInfrastructure })
const handoff = buildFutureExecutionHandoffContract({
  planId,
  leadId,
  companyName: "Cert HVAC Co",
  plan: researchPlan,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  readinessReason: "ready",
  futureExecutionEligible: true,
  evidenceSummary: null,
  auditTrail: { leadId, planId, entries: [] },
  infrastructure: readyInfrastructure,
  generatedAt: fixedNow,
  observationHref: `/growth/os/pilot/lead-research/${leadId}`,
})
const planPreflight = buildPlanPreflightChecklist({ handoff, workflowChecklist: workflowPreflight })

const passingGateValidation = validateExecutionRuntimeGates({
  runtimeEnabled: true,
  workflowType: researchPlan.workflowType,
  approvalState: "approved_for_future_execution",
  readinessState: "ready_for_future_execution",
  handoffState: "handoff_ready",
  preflightStatus: planPreflight.preflightStatus,
  boundaryClassification: boundary.classification,
  runtimeImplementationAllowed: planPreflight.runtimeImplementationAllowed,
  futureExecutionAllowed: boundary.futureExecutionAllowed,
})
assert.equal(passingGateValidation.allowed, true)

const pilotDisabled = validateExecutionRuntimePilotEnqueue({
  pilotEnabled: false,
  runtimeEnabled: true,
  workflowType: researchPlan.workflowType,
  gateValidation: passingGateValidation,
  dryRunStatus: "dry_run_passed",
})
assert.equal(pilotDisabled.allowed, false)
assert.equal(pilotDisabled.blockCode, "pilot_disabled")

const runtimeDisabled = validateExecutionRuntimePilotEnqueue({
  pilotEnabled: true,
  runtimeEnabled: false,
  workflowType: researchPlan.workflowType,
  gateValidation: passingGateValidation,
  dryRunStatus: "dry_run_passed",
})
assert.equal(runtimeDisabled.allowed, false)
assert.equal(runtimeDisabled.blockCode, "runtime_disabled")

const nonPilotWorkflow = validateExecutionRuntimePilotEnqueue({
  pilotEnabled: true,
  runtimeEnabled: true,
  workflowType: verifyPlan.workflowType,
  gateValidation: passingGateValidation,
  dryRunStatus: "dry_run_passed",
})
assert.equal(nonPilotWorkflow.allowed, false)
assert.equal(nonPilotWorkflow.blockCode, "pilot_workflow_not_allowed")

const dryRunRequired = validateExecutionRuntimePilotEnqueue({
  pilotEnabled: true,
  runtimeEnabled: true,
  workflowType: researchPlan.workflowType,
  gateValidation: passingGateValidation,
  dryRunStatus: null,
})
assert.equal(dryRunRequired.allowed, false)
assert.equal(dryRunRequired.blockCode, "dry_run_required")

const dryRunNotPassed = validateExecutionRuntimePilotEnqueue({
  pilotEnabled: true,
  runtimeEnabled: true,
  workflowType: researchPlan.workflowType,
  gateValidation: passingGateValidation,
  dryRunStatus: "dry_run_failed_gate_validation",
})
assert.equal(dryRunNotPassed.allowed, false)
assert.equal(dryRunNotPassed.blockCode, "dry_run_not_passed")

const pilotSummaryOff = buildExecutionRuntimePilotSummary({ pilotEnabled: false, runtimeEnabled: false })
assert.equal(pilotSummaryOff.effectiveRuntimeEnabled, false)

const pilotSummaryOn = buildExecutionRuntimePilotSummary({ pilotEnabled: true, runtimeEnabled: true })
assert.equal(pilotSummaryOn.effectiveRuntimeEnabled, true)

async function runAsyncCert(): Promise<void> {
  const dryRunValidation = validateDryRunExecutionGates({
    runtimeEnabled: true,
    workflowType: researchPlan.workflowType,
    approvalState: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    handoffState: "handoff_ready",
    preflightStatus: planPreflight.preflightStatus,
    boundaryClassification: boundary.classification,
    runtimeImplementationAllowed: planPreflight.runtimeImplementationAllowed,
    futureExecutionAllowed: boundary.futureExecutionAllowed,
  })

  const dryRunReport = runInternalWorkflowDryRun({
    organizationId: "org-cert-3c",
    planId,
    leadId,
    executionPlan: researchPlan,
    validation: dryRunValidation,
    now: fixedNow,
    dryRunId: `glr-dry-run:${planId}:${fixedNow}`,
  })
  assert.equal(dryRunReport.finalStatus, "dry_run_passed")
  rememberLatestDryRunReport(dryRunReport)
  assert.equal(getLatestDryRunReportForPlan(planId)?.finalStatus, "dry_run_passed")

  const pilotAllowed = validateExecutionRuntimePilotEnqueue({
    pilotEnabled: true,
    runtimeEnabled: true,
    workflowType: researchPlan.workflowType,
    gateValidation: passingGateValidation,
    dryRunStatus: getLatestDryRunReportForPlan(planId)?.finalStatus ?? null,
  })
  assert.equal(pilotAllowed.allowed, true)

  const store = createInMemoryExecutionRuntimeStore()
  const queued = await enqueueGrowthLeadResearchExecution(store, {
    organizationId: "org-cert-3c",
    planId,
    leadId,
    companyName: "Cert HVAC Co",
    executionPlan: researchPlan,
    approvalState: "approved_for_future_execution",
    confidence: 0.86,
    operatorUserId: "operator-cert",
    runtimeEnabled: true,
    now: fixedNow,
  })
  assert.equal(queued.state, "queued")
  assert.equal(queued.workflowType, "research_company")

  const lifecycle = await runGrowthLeadResearchExecutionLifecycle(store, {
    executionId: queued.executionId,
    validation: passingGateValidation,
    now: fixedNow,
  })
  assert.equal(lifecycle.record.state, "completed")
  assert.equal(lifecycle.record.context?.outboundActionsAttempted, 0)
  assert.equal(lifecycle.record.context?.providerCallsAttempted, 0)
  assert.equal(lifecycle.record.context?.coreMutationsAttempted, 0)

  const auditTrail = await store.listAudit(lifecycle.record.executionId)
  assert.ok(auditTrail.length >= researchPlan.estimatedSteps.length)
  assert.ok(
    auditTrail.some(
      (entry) => entry.eventType === GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.stepCompleted,
    ),
  )

  const pauseStore = createInMemoryExecutionRuntimeStore()
  const pauseQueued = await enqueueGrowthLeadResearchExecution(pauseStore, {
    organizationId: "org-cert-3c",
    planId: `${planId}:pause`,
    leadId,
    companyName: "Cert HVAC Co",
    executionPlan: researchPlan,
    approvalState: "approved_for_future_execution",
    confidence: 0.86,
    runtimeEnabled: true,
    now: fixedNow,
  })
  await runGrowthLeadResearchExecutionLifecycle(pauseStore, {
    executionId: pauseQueued.executionId,
    validation: passingGateValidation,
    now: fixedNow,
    maxSteps: 1,
  })
  const paused = await pauseGrowthLeadResearchExecution(pauseStore, pauseQueued.executionId, fixedNow)
  assert.equal(paused.state, "paused")

  const resumed = await resumeGrowthLeadResearchExecution(pauseStore, {
    executionId: pauseQueued.executionId,
    validation: passingGateValidation,
    now: fixedNow,
  })
  assert.equal(resumed.record.state, "completed")

  const cancelStore = createInMemoryExecutionRuntimeStore()
  const cancelQueued = await enqueueGrowthLeadResearchExecution(cancelStore, {
    organizationId: "org-cert-3c",
    planId: `${planId}:cancel`,
    leadId,
    companyName: "Cert HVAC Co",
    executionPlan: researchPlan,
    approvalState: "approved_for_future_execution",
    confidence: 0.86,
    runtimeEnabled: true,
    now: fixedNow,
  })
  const cancelled = await cancelGrowthLeadResearchExecution(cancelStore, cancelQueued.executionId, fixedNow)
  assert.equal(cancelled.state, "cancelled")

  for (const workflow of ["verify_email", "buying_committee", "meeting_preparation", "outreach_generation"] as const) {
    const blocked = validateExecutionRuntimePilotEnqueue({
      pilotEnabled: true,
      runtimeEnabled: true,
      workflowType: workflow,
      gateValidation: passingGateValidation,
      dryRunStatus: "dry_run_passed",
    })
    assert.equal(blocked.allowed, false, `${workflow} must remain blocked from pilot enqueue`)
  }

  console.log("  ✓ Pilot QA marker and disabled-by-default rule")
  console.log("  ✓ research_company-only pilot allowlist")
  console.log("  ✓ Dry-run required before enqueue")
  console.log("  ✓ Deterministic lifecycle with persisted audit history")
  console.log("  ✓ Pause, resume, cancel")
  console.log("  ✓ Zero provider/outbound/Core side effects")
  console.log(`[${GROWTH_AIOS_GROWTH_3C_PHASE}] PASS`)

  console.log(`[${GROWTH_AIOS_GROWTH_3C_PHASE}] Running 3B regression (includes 2B/2C/3A)…`)
  const result = spawnSync("pnpm", ["test:ge-aios-growth-3b-internal-workflow-dry-run"], {
    stdio: "inherit",
    shell: true,
  })
  assert.equal(result.status, 0, "3B regression failed")
  console.log(`[${GROWTH_AIOS_GROWTH_3C_PHASE}] PASS — all regressions green`)
}

runAsyncCert().catch((error) => {
  console.error(error)
  process.exit(1)
})
