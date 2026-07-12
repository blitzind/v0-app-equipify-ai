/**
 * GE-AIOS-25A-1 — Ava Cognitive Workspace Lead Drawer certification (static).
 * Run: pnpm test:ge-aios-25a-1-ava-cognitive-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaBeliefs,
  buildAvaCognitiveWorkspaceCertFixture,
  buildAvaCurrentAssessment,
  buildAvaEvidenceFacts,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import {
  GROWTH_AVA_COGNITIVE_SECTION_IDS,
  GROWTH_AVA_COGNITIVE_SECTION_ORDER,
  GROWTH_AVA_COGNITIVE_SECTION_TITLES,
  GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER,
  GROWTH_AVA_COGNITIVE_WORKSPACE_RULE,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[GE-AIOS-25A-1] Ava Cognitive Workspace certification")

assert.ok(GROWTH_AVA_COGNITIVE_WORKSPACE_RULE.includes("presentation-only"))
assert.ok(GROWTH_AVA_COGNITIVE_WORKSPACE_RULE.includes("no LLM"))
assert.equal(GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER, "ge-aios-25a-1-ava-cognitive-workspace-v1")
assert.deepEqual(GROWTH_AVA_COGNITIVE_SECTION_ORDER, [
  "assessment",
  "why_i_believe",
  "evidence",
  "execution_plan",
  "research_journal",
  "operational_state",
  "activity_timeline",
  "human_workspace",
  "raw_intelligence",
])
console.log("  ✓ cognitive section order locked")

const drawer = readSource("components/growth/growth-lead-drawer.tsx")
assert.ok(drawer.includes("GrowthLeadCognitiveWorkspace"))
assert.ok(drawer.includes("cognitiveActionsOnly"))
assert.ok(drawer.includes("rawIntelligenceChildren"))
assert.equal(drawer.includes("openai"), false)
assert.equal(drawer.includes("generateText"), false)
assert.equal(drawer.includes("createOpenAI"), false)
assert.equal(/apollo/i.test(drawer), false, "drawer must not introduce Apollo references")
console.log("  ✓ drawer uses cognitive workspace; no LLM; no Apollo")

const workspace = readSource("components/growth/growth-lead-cognitive-workspace.tsx")
assert.ok(workspace.includes("GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER"))
assert.ok(workspace.includes("data-qa-marker={GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER}"))
for (const section of GROWTH_AVA_COGNITIVE_SECTION_ORDER) {
  assert.ok(
    workspace.includes(`GROWTH_AVA_COGNITIVE_SECTION_IDS.${section}`) ||
      workspace.includes(GROWTH_AVA_COGNITIVE_SECTION_IDS[section]),
    `missing section id ${section}`,
  )
}
assert.ok(workspace.includes("GROWTH_AVA_COGNITIVE_SECTION_TITLES"))
assert.ok(workspace.includes("defaultOpen={false}"))
assert.ok(workspace.includes("GeV15AutomationRuntimeApprovalPanel"))
assert.ok(workspace.includes("Ava does not need anything from you right now"))
assert.ok(workspace.includes("GrowthSalesExecutionPlanPanel"))
assert.ok(workspace.includes("GrowthLeadDailyWorkQueuePanel"))
console.log("  ✓ workspace mounts cognitive sections, approvals, plan, queue")

assert.ok(
  workspace.includes('persistKey="ava-cognitive-raw"') || workspace.includes("ava-cognitive-raw"),
)
assert.ok(workspace.includes("expandToken={rawExpandToken}") || workspace.includes("rawExpandToken"))
console.log("  ✓ Raw Intelligence collapsed-by-default + expand token supported")

assert.ok(workspace.includes("forceVisible") || workspace.includes('forceVisible'))
assert.ok(drawer.includes("growth-lead-research"))
assert.ok(drawer.includes("growth-decision-makers"))
assert.ok(drawer.includes("GrowthLeadResearchPanel"))
assert.ok(drawer.includes("GrowthDecisionMakersPanel"))
console.log("  ✓ critical research/DM handlers remain mounted with focus IDs")

const mappers = readSource("lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers.ts")
assert.equal(mappers.includes("openai"), false)
assert.equal(mappers.includes("fetch("), false)
assert.ok(mappers.includes("buildAvaCurrentAssessment"))
assert.ok(mappers.includes("buildAvaBeliefs"))
assert.ok(mappers.includes("I've completed initial research") || mappers.includes("I have not completed usable research"))
console.log("  ✓ briefing mappers are deterministic (no fetch/LLM)")

const fixture = buildAvaCognitiveWorkspaceCertFixture()
assert.ok(fixture.assessment.briefingParagraphs.length >= 2)
assert.ok(fixture.assessment.briefingParagraphs.some((p) => p.includes("Block Imaging")))
assert.ok(fixture.assessment.blocker?.toLowerCase().includes("decision maker"))
assert.ok(fixture.beliefs.some((b) => /decision maker/i.test(b.text)))
assert.ok(fixture.beliefs.some((b) => /customer portal|online booking/i.test(b.text)))
assert.ok(fixture.evidence.some((f) => f.id === "industry"))
assert.equal(
  fixture.evidence.some((f) => /unknown/i.test(f.value)),
  false,
)
console.log("  ✓ cert fixture produces deterministic assessment/beliefs/evidence")

const emptyLeadBeliefs = buildAvaBeliefs({
  lead: {
    id: "empty",
    companyName: "Empty Co",
    status: "new",
    decisionMakerStatus: null,
    nextBestAction: null,
    opportunityAccelerators: [],
    opportunityBlockers: [],
  } as never,
  prospectRun: null,
})
assert.equal(emptyLeadBeliefs.length, 0, "new empty lead must not invent beliefs")
console.log("  ✓ empty lead does not invent conclusions")

const assessmentOnly = buildAvaCurrentAssessment({
  lead: {
    id: "empty",
    companyName: "Empty Co",
    status: "new",
    decisionMakerStatus: null,
    nextBestAction: null,
    opportunityAccelerators: [],
    opportunityBlockers: [],
  } as never,
})
assert.ok(assessmentOnly.briefingParagraphs.some((p) => /not completed usable research/i.test(p)))
assert.equal(assessmentOnly.operatorInvolvementRequired, false)
console.log("  ✓ incomplete evidence stated plainly")

const evidence = buildAvaEvidenceFacts({
  lead: {
    id: "empty",
    companyName: "Empty Co",
    status: "new",
    website: null,
    city: null,
    state: null,
    opportunityAccelerators: [],
    opportunityBlockers: [],
  } as never,
  prospectRun: {
    id: "r",
    leadId: "empty",
    status: "completed",
    websiteUrl: null,
    companyName: null,
    industryGuess: "Unknown",
    employeeSizeGuess: "Unknown",
    revenueSizeGuess: null,
    websiteMaturityScore: null,
    socialPresenceScore: null,
    reputationScore: null,
    technologyScore: null,
    detectedTechnologies: [],
    signals: { painSignals: [] },
    competitors: [],
    researchSummary: null,
    suggestedPitchAngle: null,
    suggestedSequence: null,
    suggestedCallOpening: null,
    recommendedNextAction: null,
    researchConfidence: null,
    completedAt: null,
    failedReason: null,
    createdAt: new Date().toISOString(),
  },
})
assert.equal(evidence.some((f) => f.value === "Unknown"), false)
console.log("  ✓ evidence hides Unknown rows")

const focus = readSource("lib/growth/command/command-lead-focus.ts")
assert.ok(focus.includes("ava-cognitive-raw"))
assert.ok(focus.includes("GROWTH_AVA_COGNITIVE_SECTION_IDS"))
console.log("  ✓ focus expands Raw Intelligence for legacy targets")

const requiredFiles = [
  "components/growth/growth-lead-cognitive-workspace.tsx",
  "components/growth/cognitive-workspace/growth-cognitive-section.tsx",
  "components/growth/cognitive-workspace/growth-ava-current-assessment-panel.tsx",
  "components/growth/cognitive-workspace/growth-ava-why-i-believe-panel.tsx",
  "components/growth/cognitive-workspace/growth-ava-evidence-panel.tsx",
  "components/growth/cognitive-workspace/growth-ava-research-journal-panel.tsx",
  "components/growth/cognitive-workspace/growth-ava-operational-state-panel.tsx",
  "lib/growth/cognitive-workspace/growth-cognitive-workspace-types.ts",
  "lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers.ts",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} implementation files present`)

// No schema/API additions in this milestone path
assert.equal(drawer.includes("supabase/migrations"), false)
assert.equal(workspace.includes("/api/platform/growth/cognitive"), false)
console.log("  ✓ no new cognitive API routes referenced")

console.log("[GE-AIOS-25A-1] PASS")
