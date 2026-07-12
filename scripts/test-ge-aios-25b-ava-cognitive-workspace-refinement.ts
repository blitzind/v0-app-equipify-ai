/**
 * GE-AIOS-25B — Cognitive Workspace compression & live teammate UX certification.
 * Run: pnpm test:ge-aios-25b-ava-cognitive-workspace-refinement
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaAssessmentSummaryBullets,
  buildAvaCognitiveWorkspaceCertFixture,
  buildAvaCurrentAssessment,
  buildAvaExecutionProgressTimeline,
  buildAvaWhatsChanged,
  captureAvaVisitSnapshot,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import {
  GROWTH_AVA_COGNITIVE_NESTED_TOOL_ORDER,
  GROWTH_AVA_COGNITIVE_SECTION_ORDER,
  GROWTH_AVA_COGNITIVE_WORKSPACE_REFINEMENT_QA_MARKER,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-types"
import type { GrowthLead } from "../lib/growth/types"
import type { GrowthResearchRunPublicView } from "../lib/growth/research/research-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[GE-AIOS-25B] Cognitive Workspace refinement certification")

assert.equal(
  GROWTH_AVA_COGNITIVE_WORKSPACE_REFINEMENT_QA_MARKER,
  "ge-aios-25b-ava-cognitive-workspace-refinement-v1",
)
assert.deepEqual([...GROWTH_AVA_COGNITIVE_SECTION_ORDER], [
  "assessment",
  "whats_changed",
  "execution_plan",
  "human_workspace",
  "why_i_believe",
  "evidence",
  "raw_intelligence",
])
assert.deepEqual([...GROWTH_AVA_COGNITIVE_NESTED_TOOL_ORDER], [
  "research_journal",
  "operational_state",
  "activity_timeline",
])
console.log("  ✓ operator hierarchy + nested notebook tools locked")

const workspace = readSource("components/growth/growth-lead-cognitive-workspace.tsx")
assert.ok(workspace.includes("GROWTH_AVA_COGNITIVE_WORKSPACE_REFINEMENT_QA_MARKER"))
assert.ok(workspace.includes("GrowthAvaWhatsChangedPanel"))
assert.ok(workspace.includes("GrowthAvaProgressTimeline"))
assert.ok(workspace.includes("GrowthAvaHumanInterventionsSummary"))
assert.ok(workspace.includes("includeEmbeddedSurfaces={false}"))
assert.ok(workspace.includes("Notebook tools"))
assert.ok(workspace.includes("GROWTH_AVA_COGNITIVE_SECTION_IDS.research_journal"))
assert.equal(workspace.includes('title="Ownership"'), false)
assert.ok(workspace.includes("Why I Believe") || workspace.includes("why_i_believe"))
assert.ok(workspace.includes("Evidence") || workspace.includes("evidence"))
console.log("  ✓ workspace mounts compressed teammate surfaces")

const assessmentPanel = readSource(
  "components/growth/cognitive-workspace/growth-ava-current-assessment-panel.tsx",
)
assert.ok(assessmentPanel.includes("summaryBullets"))
assert.ok(assessmentPanel.includes("Current focus"))
assert.ok(assessmentPanel.includes("Blocked by"))
assert.ok(assessmentPanel.includes("Next step"))
assert.equal(assessmentPanel.includes("briefingParagraphs.map"), false)
console.log("  ✓ assessment panel is compact executive summary")

const commandCenter = readSource("components/growth/growth-lead-command-center.tsx")
assert.ok(commandCenter.includes("Ownership"))
assert.ok(commandCenter.includes("cognitiveActionsOnly ? ("))
assert.ok(commandCenter.includes("GrowthLeadAssignmentPanel"))
console.log("  ✓ ownership elevated under company information")

const fixture = buildAvaCognitiveWorkspaceCertFixture()
assert.ok(fixture.assessment.summaryBullets.length >= 2)
assert.ok(fixture.assessment.summaryBullets.some((b) => /researched/i.test(b)))
assert.ok(fixture.assessment.summaryBullets.some((b) => /decision maker/i.test(b)))
assert.ok(fixture.assessment.objective)
assert.ok(fixture.assessment.blocker)
console.log("  ✓ compact assessment bullets deterministic")

const lead = {
  id: "cert-lead",
  companyName: "Block Imaging",
  status: "enriched",
  decisionMakerStatus: "none",
  nextBestAction: "find_decision_maker",
  website: "https://example.com",
  score: 72,
  lastProspectResearchedAt: new Date().toISOString(),
  contactEmail: null,
  callAttemptCount: 0,
  opportunityReadinessTier: "warm",
  opportunityBlockers: [],
  opportunityAccelerators: [],
} as unknown as GrowthLead

const prospectRun = {
  id: "run-1",
  status: "completed",
  websiteUrl: "https://example.com",
  employeeSizeGuess: "51-200",
  researchConfidence: 0.67,
  completedAt: new Date().toISOString(),
} as GrowthResearchRunPublicView

const input = { lead, prospectRun, pendingApprovalCount: 0 }
const bullets = buildAvaAssessmentSummaryBullets(input)
assert.ok(bullets.every((b) => b.length < 80))
assert.ok(bullets.length <= 5)

const timeline = buildAvaExecutionProgressTimeline(input)
assert.equal(timeline.length, 8)
assert.equal(timeline[0]?.status, "done")
assert.ok(timeline.some((s) => s.id === "decision_maker" && s.status === "current"))
assert.ok(timeline.some((s) => s.id === "meeting" && s.status === "upcoming"))
console.log("  ✓ progress timeline communicates done / current / upcoming")

const current = captureAvaVisitSnapshot(input)
const previous = {
  ...current,
  confidencePercent: 41,
  employeeSizeGuess: "11-50",
  decisionMakerStatus: "none",
  evidenceCount: Math.max(0, current.evidenceCount - 2),
  visitedAt: new Date(Date.now() - 86_400_000).toISOString(),
}
const changed = buildAvaWhatsChanged({ current, previous })
assert.ok(changed.bullets.some((b) => /confidence/i.test(b)))
assert.ok(changed.bullets.some((b) => /decision maker still missing/i.test(b)))
assert.equal(changed.isFirstVisit, false)
assert.equal(buildAvaWhatsChanged({ current, previous: null }).isFirstVisit, true)
console.log("  ✓ what's changed reports visit deltas without LLM")

assert.ok(buildAvaCurrentAssessment(input).summaryBullets.length > 0)
assert.equal(workspace.includes("openai"), false)
assert.equal(workspace.includes("supabase/migrations"), false)
assert.equal(readSource("lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers.ts").includes("fetch("), false)

const requiredFiles = [
  "components/growth/cognitive-workspace/growth-ava-progress-timeline.tsx",
  "components/growth/cognitive-workspace/growth-ava-whats-changed-panel.tsx",
  "components/growth/cognitive-workspace/growth-ava-human-interventions-summary.tsx",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}

console.log("[GE-AIOS-25B] PASS")
