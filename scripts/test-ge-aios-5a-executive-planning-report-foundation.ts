/**
 * GE-AIOS-5A — Executive Planning Report certification.
 * Run: pnpm test:ge-aios-5a-executive-planning-report-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_EXECUTIVE_PLANNING_REPORT_RUNTIME_RULE,
  GROWTH_AIOS_5A_PHASE,
  GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER,
} from "../lib/growth/aios/ai-executive-planning-report-types"
import { synthesizeAiExecutivePlanningReport } from "../lib/growth/aios/ai-executive-planning-report-synthesizer"
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

function sampleObjective(): GrowthObjective {
  return {
    id: "d702724e-6565-4db7-a2f0-d686fea7623a",
    organizationId: "org-1",
    title: "Book demo with Precision Biomedical",
    description: "Healthcare medical equipment demo booking mission",
    objectiveType: "demos_booked",
    targetValue: 1,
    currentValue: 0,
    startDate: new Date().toISOString(),
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "high",
    autonomyLevel: "assisted",
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
  }
}

console.log(`[${GROWTH_AIOS_5A_PHASE}] Executive Planning Report certification`)

assert.equal(
  GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER,
  "growth-aios-5a-executive-planning-report-v1",
)
assert.ok(AI_EXECUTIVE_PLANNING_REPORT_RUNTIME_RULE.includes("never executes"))
assert.ok(AI_EXECUTIVE_PLANNING_REPORT_RUNTIME_RULE.includes("never executes Work Orders"))

const report = synthesizeAiExecutivePlanningReport({
  reportId: "report-1",
  generatedAt: new Date().toISOString(),
  objective: sampleObjective(),
  currentStageId: "research",
  proposedWorkOrders: [],
  activeWorkOrderCount: 0,
  decisionRecordCount: 0,
  memoryEntryCount: 0,
  sourcesUsed: ["growth_objective_planner"],
})

assert.equal(report.readOnly, true)
assert.ok(report.missionAnalysis.companyFitScore >= 60)
assert.ok(report.recommendedStrategy.steps.length >= 8)
assert.ok(report.businessReasoning.length >= 3)
assert.ok(report.alternativeStrategies.length >= 2)
assert.ok(report.futureLearningPlaceholders.length >= 1)

const serviceSource = readSource("lib/growth/aios/ai-executive-planning-report-service.ts")
assert.ok(serviceSource.includes("fetchAiExecutivePlanningReport"))
assert.ok(serviceSource.includes("resolveAiContextEntityMetadata"))
assert.ok(serviceSource.includes("listAiDecisionRecords"))
assert.ok(serviceSource.includes("listAiMemoryRegistryEntries"))
for (const pattern of [
  "runAiExecutiveMissionPlanningTick",
  "invokeAiOsProviderWithContextPackage",
  "claimAiOsWorkOrder",
  "delegateAiExecutiveWorkOrder",
]) {
  assert.equal(serviceSource.includes(pattern), false, `report service must not reference ${pattern}`)
}

const reviewService = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.ok(reviewService.includes("executivePlanningReport"))
assert.ok(reviewService.includes("fetchAiExecutivePlanningReport"))

const ui = readSource("components/growth/ai-os/growth-ai-os-executive-planning-report-section.tsx")
assert.ok(ui.includes("GrowthAiOs" + "E" + "xecutivePlanningReportSection"))
assert.ok(ui.includes("Business Reasoning"))

const panel = readSource("components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx")
assert.ok(panel.includes("GrowthAiOs" + "E" + "xecutivePlanningReportSection"))

const files = [
  "lib/growth/aios/ai-executive-planning-report-types.ts",
  "lib/growth/aios/ai-executive-planning-report-synthesizer.ts",
  "lib/growth/aios/ai-executive-planning-report-service.ts",
  "components/growth/ai-os/growth-ai-os-executive-planning-report-section.tsx",
]
for (const file of files) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitzpay"])
}

console.log(`[${GROWTH_AIOS_5A_PHASE}] PASS — Executive Planning Report certified (local)`)
