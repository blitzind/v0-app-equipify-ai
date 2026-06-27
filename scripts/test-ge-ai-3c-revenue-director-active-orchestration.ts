/**
 * GE-AI-3C — Revenue Director Active Orchestration certification.
 * Run: pnpm test:ge-ai-3c-revenue-director-active-orchestration
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { AI_EVENT_REGISTRY, isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import {
  REVENUE_DIRECTOR_DISPATCH_FORBIDDEN_TOKENS,
  synthesizeRevenueDirectorDispatchEligibility,
  validateRevenueDirectorDispatchRequestStatus,
  validateRevenueDirectorDispatchRequestType,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-dispatch-guardrails"
import {
  GROWTH_AIOS_GE_AI_3C_PHASE,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE,
  buildRevenueDirectorDispatchIdempotencyKey,
  isRevenueDirectorAdvisoryOnlyRequestType,
  isRevenueDirectorDispatchableRequestType,
  resolveDispatchTargetAgent,
} from "../lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types"
import { canTransitionWorkflowRequestStatus } from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-helpers"
import type { GrowthRevenueDirectorWorkflowRequestRecord } from "../lib/growth/aios/revenue-director/growth-revenue-director-decision-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenTokens(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of REVENUE_DIRECTOR_DISPATCH_FORBIDDEN_TOKENS) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleRequest(
  overrides: Partial<GrowthRevenueDirectorWorkflowRequestRecord> = {},
): GrowthRevenueDirectorWorkflowRequestRecord {
  return {
    id: "req-1",
    organizationId: "org-1",
    decisionId: "dec-1",
    requestType: "run_research",
    targetWorkflowAgent: "research_agent",
    status: "accepted",
    advisory: true,
    subjectType: "lead",
    subjectId: "lead-1",
    objectiveId: null,
    missionId: null,
    leadId: "lead-1",
    title: "Run research",
    summary: "Research lead",
    priorityScore: 80,
    requiresHumanApproval: true,
    idempotencyKey: "rev-dir-req:org-1:abc",
    correlationId: "corr-1",
    evidence: [{ source: "meta", label: "Score", value: 80 }],
    route: null,
    createdAt: "2026-06-25T14:00:00.000Z",
    updatedAt: "2026-06-25T14:00:00.000Z",
    acceptedAt: "2026-06-25T14:00:00.000Z",
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    supersededAt: null,
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_3C_PHASE}] Revenue Director Active Orchestration certification`)

assert.ok(GROWTH_REVENUE_DIRECTOR_DISPATCH_RULE.includes("never sends transport"))

const requiredFiles = [
  "lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-dispatch-guardrails.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-dispatch-adapters.ts",
  "lib/growth/aios/revenue-director/growth-revenue-director-dispatch-service.ts",
  "app/api/platform/growth/ai-os/revenue-director/workflow-requests/[id]/dispatch/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-revenue-director-dispatch-button.tsx",
  "docs/GE-AI-3C_REVENUE_DIRECTOR_ACTIVE_ORCHESTRATION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const dispatchService = readSource("lib/growth/aios/revenue-director/growth-revenue-director-dispatch-service.ts")
const adapters = readSource("lib/growth/aios/revenue-director/growth-revenue-director-dispatch-adapters.ts")
const route = readSource("app/api/platform/growth/ai-os/revenue-director/workflow-requests/[id]/dispatch/route.ts")
const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-revenue-director-dispatch-button.tsx")
const section = readSource("components/growth/ai-os/command-center/growth-ai-os-revenue-director-section.tsx")

assert.ok(dispatchService.includes('import "server-only"'))
assert.ok(dispatchService.includes("dispatchRevenueDirectorWorkflowRequest"))
assert.ok(dispatchService.includes("runRevenueDirectorDispatchAdapter"))
assert.ok(adapters.includes("runAutonomousResearchManualRefresh"))
assert.ok(adapters.includes("runAutonomousQualificationManualEvaluation"))
assert.ok(adapters.includes("requestGrowthCommunicationPlan"))
assert.ok(adapters.includes("runAutonomousOutreachPreparationManualRequest"))
assert.equal(adapters.includes("runSequenceExecutionJob"), false)

assert.ok(route.includes("requireGrowthOperatorAccess"))
assert.equal(route.includes("GET"), false)
assert.ok(route.includes("dispatchRevenueDirectorWorkflowRequest"))
assert.ok(route.includes("transportBlocked: true"))

assertNoForbiddenTokens("lib/growth/aios/revenue-director/growth-revenue-director-dispatch-adapters.ts")
assertNoForbiddenTokens("lib/growth/aios/revenue-director/growth-revenue-director-dispatch-service.ts")

assert.ok(ui.includes("Confirm dispatch"))
assert.ok(ui.includes("Does not send outbound directly"))
assert.equal(ui.includes("dispatch all"), false)
assert.equal(ui.includes("auto-dispatch"), false)
assert.ok(section.includes("GrowthAiOsRevenueDirectorDispatchButton"))

for (const eventType of Object.values(GROWTH_REVENUE_DIRECTOR_DISPATCH_EVENT_TYPES)) {
  assert.equal(isRegisteredAiEventType(eventType), true, `${eventType} must be registered`)
}

assert.equal(isRevenueDirectorDispatchableRequestType("run_research"), true)
assert.equal(isRevenueDirectorAdvisoryOnlyRequestType("pause_objective"), true)
assert.equal(resolveDispatchTargetAgent("run_research"), "research_agent")
assert.equal(resolveDispatchTargetAgent("rerun_qualification"), "qualification_agent")
assert.equal(resolveDispatchTargetAgent("request_communication_plan"), "communication_engine")
assert.equal(resolveDispatchTargetAgent("generate_outreach"), "outreach_preparation")
assert.equal(resolveDispatchTargetAgent("review_approval_queue"), "human_approval_center")

assert.equal(validateRevenueDirectorDispatchRequestStatus({ status: "proposed" }).allowed, false)
assert.equal(validateRevenueDirectorDispatchRequestStatus({ status: "accepted" }).allowed, true)
assert.equal(validateRevenueDirectorDispatchRequestStatus({ status: "completed" }).allowed, false)
assert.equal(validateRevenueDirectorDispatchRequestType("pause_objective").advisoryOnly, true)
assert.equal(validateRevenueDirectorDispatchRequestType("run_research").allowed, true)

assert.equal(
  synthesizeRevenueDirectorDispatchEligibility({ request: sampleRequest() }).eligible,
  true,
)
assert.equal(
  synthesizeRevenueDirectorDispatchEligibility({ request: sampleRequest({ status: "proposed" }) }).eligible,
  false,
)
assert.equal(
  synthesizeRevenueDirectorDispatchEligibility({ request: sampleRequest({ requestType: "pause_objective" }) })
    .advisoryOnly,
  true,
)

assert.equal(canTransitionWorkflowRequestStatus("accepted", "dispatched"), true)
assert.equal(buildRevenueDirectorDispatchIdempotencyKey("req-1"), "rev-dir-dispatch:req-1")

const registryCount = AI_EVENT_REGISTRY.filter((row) =>
  row.eventType.startsWith("growth.revenue_director.workflow_request_dispatch"),
).length
assert.ok(registryCount >= 4)

console.log("[GE-AI-3C] Static certification passed — running GE-AI-3B regression")
execSync("pnpm test:ge-ai-3b-revenue-director-decision-ledger", { stdio: "inherit" })

console.log("[GE-AI-3C] Revenue Director Active Orchestration certification PASSED")
