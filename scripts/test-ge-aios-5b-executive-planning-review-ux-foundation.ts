/**
 * GE-AIOS-5B — Executive Planning Review UX certification.
 * Run: pnpm test:ge-aios-5b-executive-planning-review-ux-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_OS_EXECUTIVE_PLANNING_REVIEW_UX_RULE,
  GROWTH_AIOS_5B_PHASE,
  GROWTH_AI_EXECUTIVE_PLANNING_REVIEW_UX_QA_MARKER,
} from "../lib/growth/aios/ai-executive-planning-review-ux-types"
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

console.log(`[${GROWTH_AIOS_5B_PHASE}] Executive Planning Review UX certification`)

assert.equal(GROWTH_AI_EXECUTIVE_PLANNING_REVIEW_UX_QA_MARKER, "growth-aios-5b-executive-planning-review-ux-v1")
assert.ok(AI_OS_EXECUTIVE_PLANNING_REVIEW_UX_RULE.includes("UX"))

const report = synthesizeAiExecutivePlanningReport({
  reportId: "report-5b",
  generatedAt: new Date().toISOString(),
  objective: sampleObjective(),
  currentStageId: "research",
  proposedWorkOrders: [],
  activeWorkOrderCount: 0,
  decisionRecordCount: 0,
  memoryEntryCount: 0,
  sourcesUsed: ["growth_objective_planner"],
})
assert.ok(report.missionSummary.title)
assert.ok(report.recommendedStrategy.steps.length >= 3)

const uxFiles = [
  "lib/growth/aios/ai-executive-planning-review-ux-types.ts",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-summary-section.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-mission-progress-track.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-work-order-roadmap.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-proposed-work-orders-section.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-approval-action-card.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-business-outcomes-section.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-reasoning-collapsible.tsx",
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard.tsx",
  "components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx",
]
for (const file of uxFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const dashboard = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard.tsx",
)
assert.ok(dashboard.includes("GrowthAiOsExecutSummarySection"))
assert.ok(dashboard.includes("GrowthAiOsMissionProgressTrack"))
assert.ok(dashboard.includes("GrowthAiOsWorkOrderRoadmap"))
assert.ok(dashboard.includes("GrowthAiOsProposedWorkOrdersSection"))
assert.ok(dashboard.includes("GrowthAiOsApprovalActionCard"))
assert.ok(dashboard.includes("GrowthAiOsExecutReasoningCollapsible"))
assert.ok(dashboard.includes("GROWTH_AI_EXECUTIVE_PLANNING_REVIEW_UX_QA_MARKER"))

const panel = readSource("components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx")
assert.ok(panel.includes("GrowthAiOsExecutPlanningReviewDashboard"))
assert.ok(panel.includes("/api/platform/growth/ai-os/missions/"))
assert.equal(panel.includes("runAiOsExecutMissionPlanningTick"), false)
assert.equal(panel.includes("invokeAiOsProviderWithContextPackage"), false)

const summary = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-summary-section.tsx",
)
assert.ok(summary.includes('data-qa-section="executive-summary"'))
assert.ok(summary.includes("GrowthAiOsKpiCard"))
assert.ok(summary.includes("Primary recommended action"))

const progress = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-mission-progress-track.tsx",
)
assert.ok(progress.includes('data-qa-section="mission-progress"'))
assert.ok(progress.includes("GrowthAiOsProgressBar"))

const roadmap = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-work-order-roadmap.tsx",
)
assert.ok(roadmap.includes('data-qa-section="work-order-roadmap"'))
assert.ok(roadmap.includes("ArrowDown"))

const approval = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-approval-action-card.tsx",
)
assert.ok(approval.includes('data-qa-section="approval-panel"'))
assert.ok(approval.includes("Create Work Orders"))

const reasoning = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-executive-reasoning-collapsible.tsx",
)
assert.ok(reasoning.includes("Collapsible"))
assert.ok(reasoning.includes("defaultOpen={false}"))
assert.ok(reasoning.includes("Business reasoning"))
assert.ok(reasoning.includes("Future learning"))

const outcomes = readSource(
  "components/growth/ai-os/executive-planning-review/growth-ai-os-business-outcomes-section.tsx",
)
assert.ok(outcomes.includes('data-qa-section="business-outcomes"'))
assert.ok(outcomes.includes('data-qa-section="risk-cards"'))
assert.ok(outcomes.includes("GrowthAiOsConfidenceGauge"))

assert.ok(dashboard.includes("xl:grid-cols-2"))
assert.ok(summary.includes("sm:grid-cols-2"))

for (const file of uxFiles) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitz@equipify.com"])
}

console.log(`[${GROWTH_AIOS_5B_PHASE}] PASS — Executive Planning Review UX certified (local)`)
