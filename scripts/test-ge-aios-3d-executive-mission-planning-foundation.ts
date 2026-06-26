/**
 * GE-AIOS-3D — Executive Mission Planning Tick certification.
 * Run: pnpm test:ge-aios-3d-executive-mission-planning-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_EXECUTIVE_MISSION_PLANNING_RUNTIME_RULE,
  EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS,
  GROWTH_AIOS_3D_PHASE,
  GROWTH_AI_EXECUTIVE_MISSION_PLANNING_QA_MARKER,
} from "../lib/growth/aios/ai-executive-mission-planning-types"
import {
  buildExecutiveWorkOrderProposalKey,
  buildExecutiveWorkOrderProposalsForMission,
  isConstitutionalExecutiveWorkOrderType,
  markDuplicateExecutiveWorkOrderProposals,
  selectableExecutiveWorkOrderProposals,
} from "../lib/growth/aios/ai-executive-mission-planning-planner"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import { AI_WORK_ORDER_TYPES } from "../lib/growth/aios/ai-work-order-types"
import type { GrowthObjective } from "../lib/growth/objectives/growth-objective-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleObjective(overrides: Partial<GrowthObjective> = {}): GrowthObjective {
  return {
    id: "mission-1",
    organizationId: "org-1",
    title: "Book demos",
    description: null,
    objectiveType: "demos_booked",
    targetValue: 10,
    currentValue: 2,
    startDate: new Date().toISOString(),
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "medium",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: {
      qa_marker: "growth-objective-ge-auto-2g-v1",
      currentStageId: "research",
      stageStates: {} as GrowthObjective["runtime"] extends infer R ? NonNullable<R>["stageStates"] : never,
      startedAt: new Date().toISOString(),
      lastTickAt: null,
      stoppedAt: null,
      estimatedCompletionDate: null,
      running: true,
    },
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: null,
    emergencyStopActive: false,
    qa_marker: "growth-objective-ge-auto-2g-v1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_3D_PHASE}] Executive Mission Planning Tick certification`)

assert.equal(GROWTH_AI_EXECUTIVE_MISSION_PLANNING_QA_MARKER, "growth-aios-3d-executive-mission-planning-v1")

for (const types of Object.values(EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS)) {
  for (const workOrderType of types) {
    assert.ok(isConstitutionalExecutiveWorkOrderType(workOrderType))
    assert.ok(AI_WORK_ORDER_TYPES.includes(workOrderType))
  }
}

const proposals = buildExecutiveWorkOrderProposalsForMission({ objective: sampleObjective() })
assert.ok(proposals.length >= 1)
assert.equal(proposals[0].workOrderType, "research_company")

const key = buildExecutiveWorkOrderProposalKey({
  workOrderType: "research_company",
  entityType: "mission",
  entityId: "mission-1",
})
const marked = markDuplicateExecutiveWorkOrderProposals({
  proposals,
  existingWorkOrders: [
    {
      id: "wo-existing",
      organizationId: "org-1",
      missionId: "mission-1",
      ownerAgent: "executive_brain",
      assignedAgent: "research",
      workOrderType: "research_company",
      entityType: "mission",
      entityId: "mission-1",
      priority: 500,
      status: "issued",
      decisionRecordIds: [],
      memoryRefs: [],
      payload: {},
      dependsOn: [],
      retryCount: 0,
      maxRetries: 3,
      timeoutAt: null,
      executionWindowStart: null,
      executionWindowEnd: null,
      approvalId: null,
      checkpoint: null,
      requestedBy: null,
      result: null,
      failureReason: null,
      auditMetadata: {},
      issuedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      archivedAt: null,
      qaMarker: "growth-aios-2a-ai-work-order-v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
})
assert.equal(marked.skippedDuplicates, 1)
assert.equal(marked.proposals[0].duplicate, true)
assert.equal(selectableExecutiveWorkOrderProposals(marked.proposals).length, 0)

const serviceSource = readSource("lib/growth/aios/ai-executive-mission-planning-service.ts")
assert.ok(serviceSource.includes("runExecutiveMissionPlanningTick"))
assert.ok(serviceSource.includes("getGrowthObjective"))
assert.ok(serviceSource.includes("delegateAiExecutiveWorkOrder"))
assert.ok(serviceSource.includes('mode === "dry_run"'))
assert.ok(serviceSource.includes("executive.planning_tick_started"))
assert.ok(serviceSource.includes("executive.work_order_proposed"))
assert.ok(serviceSource.includes("executive.planning_tick_completed"))
assert.ok(serviceSource.includes("executive.planning_tick_failed"))
assert.ok(serviceSource.includes("prepareDecision"))
for (const pattern of ["claimAiOsWorkOrder", "invokeAiOsProviderWithContextPackage", "getProviderAdapter", 'toStatus: "executing"']) {
  assert.equal(serviceSource.includes(pattern), false, `planning service must not reference ${pattern}`)
}

const planningFiles = [
  "lib/growth/aios/ai-executive-mission-planning-types.ts",
  "lib/growth/aios/ai-executive-mission-planning-planner.ts",
  "lib/growth/aios/ai-executive-mission-planning-service.ts",
]
for (const file of planningFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

assert.ok(AI_EXECUTIVE_MISSION_PLANNING_RUNTIME_RULE.includes("never claims"))
assert.ok(lookupAiEventRegistryEntry("executive.planning_tick_started"))
assert.ok(lookupAiEventRegistryEntry("executive.work_order_proposed"))
assert.ok(lookupAiEventRegistryEntry("executive.planning_tick_completed"))
assert.ok(lookupAiEventRegistryEntry("executive.planning_tick_failed"))

console.log(`[${GROWTH_AIOS_3D_PHASE}] PASS — Executive Mission Planning Tick certified (local)`)
