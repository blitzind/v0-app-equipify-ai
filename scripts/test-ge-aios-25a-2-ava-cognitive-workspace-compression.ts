/**
 * GE-AIOS-25A-2 — Ava Cognitive Workspace Compression certification (static).
 * Also re-validates 25A-1 structural contracts.
 * Run: pnpm test:ge-aios-25a-2-ava-cognitive-workspace-compression
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAvaCognitiveWorkspaceCertFixture,
  buildAvaCurrentAssessment,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers"
import {
  GROWTH_AVA_COGNITIVE_SECTION_ORDER,
  GROWTH_AVA_COGNITIVE_WORKSPACE_COMPRESSION_QA_MARKER,
  GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER,
  GROWTH_AVA_RAW_DOMAIN_IDS,
  GROWTH_AVA_RAW_DOMAIN_ORDER,
  GROWTH_AVA_RAW_DOMAIN_TITLES,
  GROWTH_AVA_FOCUS_TO_RAW_DOMAIN,
} from "../lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[GE-AIOS-25A-2] Ava Cognitive Workspace Compression certification")

assert.equal(
  GROWTH_AVA_COGNITIVE_WORKSPACE_COMPRESSION_QA_MARKER,
  "ge-aios-25a-2-ava-cognitive-workspace-compression-v1",
)
assert.deepEqual([...GROWTH_AVA_RAW_DOMAIN_ORDER], [
  "research",
  "revenue",
  "communication",
  "relationship",
  "operations",
  "advanced",
])
assert.equal(GROWTH_AVA_RAW_DOMAIN_ORDER.length, 6)
console.log("  ✓ Raw Intelligence has exactly 6 domains")

const drawer = readSource("components/growth/growth-lead-drawer.tsx")
assert.ok(drawer.includes("rawDomains={{"))
assert.ok(drawer.includes("research:"))
assert.ok(drawer.includes("revenue:"))
assert.ok(drawer.includes("communication:"))
assert.ok(drawer.includes("relationship:"))
assert.ok(drawer.includes("operations:"))
assert.ok(drawer.includes("advanced:"))
assert.ok(drawer.includes("GrowthLeadResearchPanel"))
assert.ok(drawer.includes("GrowthDecisionMakersPanel"))
assert.ok(drawer.includes("GrowthRevenueForecast"))
assert.ok(drawer.includes("growth-lead-research"))
assert.ok(drawer.includes("growth-decision-makers"))
assert.equal(drawer.includes("rawIntelligenceChildren"), false)
assert.equal(/apollo/i.test(drawer), false)
assert.equal(drawer.includes("openai"), false)
console.log("  ✓ drawer maps panels into 6 raw domains; handlers preserved")

const workspace = readSource("components/growth/growth-lead-cognitive-workspace.tsx")
assert.ok(workspace.includes("GROWTH_AVA_COGNITIVE_WORKSPACE_COMPRESSION_QA_MARKER"))
assert.ok(workspace.includes("GrowthAvaRawDomain"))
assert.ok(workspace.includes("GrowthAvaOperatorTaskGroup"))
assert.ok(workspace.includes("What Ava Needs") || workspace.includes('human_workspace'))
assert.ok(workspace.includes("Approvals"))
assert.ok(workspace.includes("Ownership"))
assert.ok(workspace.includes("Replies & follow-up"))
assert.ok(workspace.includes("I'll let you know if I need approval") || workspace.includes("I&apos;ll let you know if I need approval"))
assert.ok(workspace.includes("GROWTH_AVA_RAW_DOMAIN_ORDER"))
for (const domain of GROWTH_AVA_RAW_DOMAIN_ORDER) {
  assert.ok(GROWTH_AVA_RAW_DOMAIN_IDS[domain])
  assert.ok(GROWTH_AVA_RAW_DOMAIN_TITLES[domain])
}
assert.ok(workspace.includes("defaultOpen={false}"))
assert.ok(workspace.includes("GeV15AutomationRuntimeApprovalPanel"))
console.log("  ✓ Human Workspace organized by operator tasks; Raw uses domains")

const focus = readSource("lib/growth/command/command-lead-focus.ts")
assert.ok(focus.includes("resolveAvaRawDomainForFocus"))
assert.ok(focus.includes("GROWTH_AVA_FOCUS_TO_RAW_DOMAIN") || focus.includes("GROWTH_AVA_RAW_DOMAIN_PERSIST_KEYS"))
assert.equal(GROWTH_AVA_FOCUS_TO_RAW_DOMAIN.research, "research")
assert.equal(GROWTH_AVA_FOCUS_TO_RAW_DOMAIN.revenue, "revenue")
assert.equal(GROWTH_AVA_FOCUS_TO_RAW_DOMAIN.meetings, "communication")
console.log("  ✓ deep-link focus expands matching Raw domain")

const mappers = readSource("lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers.ts")
assert.ok(mappers.includes("still haven't verified a decision maker") || mappers.includes("still haven\\'t verified a decision maker") || mappers.includes("still haven't verified"))
assert.ok(mappers.includes("I'll let you know if I need approval") || mappers.includes("I\\'ll let you know if I need approval"))
assert.equal(mappers.includes("I've completed initial research on"), false)
assert.equal(mappers.includes("fetch("), false)
assert.equal(mappers.includes("openai"), false)
console.log("  ✓ assessment copy tightened; still deterministic")

const fixture = buildAvaCognitiveWorkspaceCertFixture()
assert.ok(fixture.assessment.briefingParagraphs.some((p) => /researched|research/i.test(p)))
assert.ok(fixture.assessment.briefingParagraphs.some((p) => /decision maker/i.test(p)))
assert.ok(
  fixture.assessment.briefingParagraphs.some((p) => /approval|direction|continuing/i.test(p)),
)
console.log("  ✓ cert fixture uses compressed teammate briefing")

const empty = buildAvaCurrentAssessment({
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
assert.ok(empty.briefingParagraphs.some((p) => /haven.?t finished usable research/i.test(p)))
console.log("  ✓ incomplete research stated plainly")

assert.deepEqual([...GROWTH_AVA_COGNITIVE_SECTION_ORDER].slice(0, 4), [
  "assessment",
  "why_i_believe",
  "evidence",
  "execution_plan",
])
assert.equal(GROWTH_AVA_COGNITIVE_WORKSPACE_QA_MARKER, "ge-aios-25a-1-ava-cognitive-workspace-v1")

const requiredFiles = [
  "components/growth/cognitive-workspace/growth-ava-raw-domain.tsx",
  "components/growth/cognitive-workspace/growth-ava-operator-task-group.tsx",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}

assert.equal(drawer.includes("/api/platform/growth/cognitive"), false)
assert.equal(workspace.includes("supabase/migrations"), false)
console.log("  ✓ no new APIs or schema references")

console.log("[GE-AIOS-25A-2] PASS")
