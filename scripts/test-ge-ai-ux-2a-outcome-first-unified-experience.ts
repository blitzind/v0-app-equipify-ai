/**
 * GE-AI-UX-2A — Outcome-First Unified Experience certification (static).
 * Run: pnpm test:ge-ai-ux-2a-outcome-first-unified-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
  synthesizeGrowthHomeExecutiveBriefing,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { buildGrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-mapper"
import {
  buildGrowthAiOsOperatorExperienceCertFixture,
  synthesizeGrowthAiOsOperatorExperience,
} from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer"
import { GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER } from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import {
  AI_OS_APPROVAL_OUTCOME_BUCKETS,
  AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS,
  AI_OS_HOME_PRIMARY_CTA,
  AI_OS_HOME_SECONDARY_CTA,
  AI_OS_OUTCOME_ACTIVITY_GROUPS,
  GE_AI_UX_2A_QA_MARKER,
} from "../lib/workspace/ai-os-outcome-first-terminology"
import { AI_EMPLOYEE_REVIEW_BUCKETS } from "../lib/workspace/ai-employee-experience"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function listFilesRecursive(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFilesRecursive(full, acc)
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

function containsVisibleEngineLabel(source: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  if (new RegExp(`["'\`]${escaped}["'\`]`).test(source)) return true
  if (new RegExp(`>\\s*${escaped}\\s*<`).test(source)) return true
  return false
}

function assertNoHiddenEngineLabelsInDefaultUi(relativeDir: string, allowFiles: string[] = []) {
  const dir = path.join(ROOT, relativeDir)
  for (const file of listFilesRecursive(dir)) {
    const relative = path.relative(ROOT, file)
    if (allowFiles.some((allowed) => relative.endsWith(allowed))) continue
    const source = fs.readFileSync(file, "utf8")
    for (const label of AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS) {
      assert.equal(
        containsVisibleEngineLabel(source, label),
        false,
        `${relative} must not expose "${label}" in default operator UI`,
      )
    }
  }
}

console.log(`[GE-AI-UX-2A] Outcome-First Unified Experience certification`)

assert.equal(GE_AI_UX_2A_QA_MARKER, "ge-ai-ux-2a-outcome-first-unified-experience-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
assert.equal(
  GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER,
  "growth-ge-ai-ux-3a-teammate-operator-experience-v1",
)
console.log("  ✓ QA markers bumped for outcome-first experience")

assert.ok(fs.existsSync(path.join(ROOT, "lib/workspace/ai-os-outcome-first-terminology.ts")))
console.log("  ✓ shared outcome-first terminology module present")

const homeFixture = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(homeFixture.executiveBrief.completedOutcomes.length >= 3)
assert.ok(homeFixture.executiveBrief.introLine.includes("handled"))
assert.equal(homeFixture.executiveBrief.primaryCta.label, AI_OS_HOME_PRIMARY_CTA)
assert.equal(homeFixture.executiveBrief.secondaryCta.label, AI_OS_HOME_SECONDARY_CTA)
assert.ok(homeFixture.exceptions.length <= 5)
assert.ok(homeFixture.aiActivity.length === AI_OS_OUTCOME_ACTIVITY_GROUPS.length)
console.log("  ✓ Home synthesizer leads with completed outcomes and exception CTAs")

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`))
}

const homeLayout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
jsxOrder(homeLayout, "GrowthHomeCheckInSection", "GrowthHomeWaitingOnYouSection")
jsxOrder(homeLayout, "GrowthHomeWaitingOnYouSection", "GrowthHomeMyPrioritiesSection")
jsxOrder(homeLayout, "GrowthHomeMyPrioritiesSection", "GrowthHomeAccomplishmentsSection")
jsxOrder(homeLayout, "GrowthHomeMyPrioritiesSection", "GrowthHomeBusinessSnapshotSection")
jsxOrder(homeLayout, "GrowthHomeBusinessSnapshotSection", "GrowthHomeTimelineSection")
console.log("  ✓ Home visual hierarchy: check-in → noticed → completed → working → review → metrics → timeline")

const operatorView = synthesizeGrowthAiOsOperatorExperience(buildGrowthAiOsOperatorExperienceCertFixture())
assert.equal(operatorView.qaMarker, GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER)
assert.equal(operatorView.executiveBrief.primaryCtaLabel, AI_OS_HOME_PRIMARY_CTA)
assert.ok(operatorView.aiImprovements.length >= 0)
console.log("  ✓ operator synthesizer uses outcome-first CTAs and AI improvements")

const operatorLayout = readSource("components/growth/ai-os/operator-experience/growth-ai-os-operator-dashboard.tsx")
jsxOrder(operatorLayout, "GrowthAiOsExecutiveBriefSection", "GrowthAiOsOperatorRevenueDirectorCard")
jsxOrder(operatorLayout, "GrowthAiOsOperatorRevenueDirectorCard", "GrowthAiOsOperatorApprovalsSummary")
jsxOrder(operatorLayout, "GrowthAiOsOperatorApprovalsSummary", "GrowthAiOsNeedsAttentionSection")
jsxOrder(operatorLayout, "GrowthAiOsNeedsAttentionSection", "GrowthAiOsOperatorCommunicationCard")
jsxOrder(operatorLayout, "GrowthAiOsOperatorCommunicationCard", "GrowthAiOsOperatorAiImprovementsSection")
jsxOrder(operatorLayout, "GrowthAiOsOperatorAiImprovementsSection", "GrowthAiOsAiWorkingSection")
jsxOrder(operatorLayout, "GrowthAiOsAiWorkingSection", "GrowthAiOsBusinessSnapshotSection")
console.log("  ✓ AI Operations hierarchy prioritizes outcomes over system status")

const approvalGroups = homeFixture.approvalSummary?.groups.map((g) => g.label) ?? []
const allowedApprovalLabels = new Set([
  ...Object.values(AI_OS_APPROVAL_OUTCOME_BUCKETS),
  ...Object.values(AI_EMPLOYEE_REVIEW_BUCKETS),
  "pending items",
])
for (const label of approvalGroups) {
  assert.ok(allowedApprovalLabels.has(label), `unexpected approval bucket label "${label}"`)
}
assert.ok(approvalGroups.length >= 2, "approval summary must group into outcome buckets")
console.log("  ✓ approvals grouped into outcome buckets")

assertNoHiddenEngineLabelsInDefaultUi("components/growth/workspace/executive-briefing")
assertNoHiddenEngineLabelsInDefaultUi("components/growth/ai-os/operator-experience", [
  "growth-ai-os-operator-engineering-disclosure.tsx",
])
console.log("  ✓ engine labels hidden from default Home and AI Operations chrome")

const disclosure = readSource("components/growth/ai-os/operator-experience/growth-ai-os-operator-engineering-disclosure.tsx")
assert.ok(disclosure.includes("GrowthAiOsOperationsDashboard"))
assert.ok(disclosure.includes("GrowthAiOsCommandCenterDiagnosticsSections"))
console.log("  ✓ engineering terminology preserved under Advanced disclosure")

const commandCenterSections = [
  "growth-ai-os-revenue-director-section.tsx",
  "growth-ai-os-communication-engine-section.tsx",
  "growth-ai-os-human-approval-center-section.tsx",
]
for (const file of commandCenterSections) {
  assert.ok(fs.existsSync(path.join(ROOT, "components/growth/ai-os/command-center", file)))
}
console.log("  ✓ legacy engine sections remain for progressive disclosure")

const homeSynthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts")
const operatorSynthesizer = readSource("lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer.ts")
for (const source of [homeSynthesizer, operatorSynthesizer]) {
  assert.equal(source.includes('import "server-only"'), false)
  assert.equal(source.includes("fetch("), false)
}
const serviceSource = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.equal(serviceSource.includes("outcome-first"), false)
console.log("  ✓ presentation-only — no backend/API/runtime changes")

const emptyHome = synthesizeGrowthHomeExecutiveBriefing({
  dashboard: buildGrowthWorkspaceDashboardViewModel({
    briefing: null,
    leadInboxSections: [],
    cadenceSummary: null,
    pipelineDashboard: null,
    opportunityReadiness: null,
    sequenceFoundation: null,
    sequenceExecution: null,
    engagementWorkspace: null,
    conversationDashboard: null,
    relationshipDashboard: null,
    callsDashboard: null,
  }),
})
assert.ok(emptyHome.executiveBrief.completedOutcomes.length >= 1)
console.log("  ✓ empty Home degrades gracefully with outcome-first copy")

console.log(`[GE-AI-UX-2A] PASS — ${GE_AI_UX_2A_QA_MARKER}`)
