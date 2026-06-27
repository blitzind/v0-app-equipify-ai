/**
 * GE-AI-UX-4A — AI Employee Experience certification (static).
 * Run: pnpm test:ge-ai-ux-4a-ai-employee-experience
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
  synthesizeGrowthHomeExecutiveBriefing,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_EMPLOYEE_REVIEW_BUCKETS,
  GE_AI_UX_4A_QA_MARKER,
} from "../lib/workspace/ai-employee-experience"
import {
  AI_PROACTIVE_FOUND_INTRO,
} from "../lib/workspace/ai-proactive-initiative"
import {
  AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS,
  AI_OS_HOME_PRIMARY_CTA,
} from "../lib/workspace/ai-os-outcome-first-terminology"
import {
  buildGrowthAiOsOperatorExperienceCertFixture,
  synthesizeGrowthAiOsOperatorExperience,
} from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function jsxOrder(source: string, earlier: string, later: string) {
  assert.ok(source.indexOf(`<${earlier}`) < source.indexOf(`<${later}`), `${earlier} must appear before ${later}`)
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

console.log(`[GE-AI-UX-4A] AI Employee Experience certification`)

assert.equal(GE_AI_UX_4A_QA_MARKER, "ge-ai-ux-4a-ai-employee-experience-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers include proactive initiative layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.equal(home.checkIn.foundIntro, AI_PROACTIVE_FOUND_INTRO)
assert.ok(home.checkIn.foundObservations.length >= 3)
assert.ok(home.checkIn.focusingOn.length >= 1)
assert.ok(home.checkIn.needsReviewLine.includes("approval"))
assert.equal(home.checkIn.primaryCta.label, AI_OS_HOME_PRIMARY_CTA)
console.log("  ✓ Home opens with Ava check-in from existing read models")

assert.ok(home.myPriorities.length >= 1)
assert.ok(home.accomplishments.length >= 1)
console.log("  ✓ completed work separated from active ownership priorities")

for (const item of home.timeline.flatMap((period) => period.items)) {
  assert.equal(item.includes("Communication Engine"), false)
  assert.equal(item.includes("Revenue Director"), false)
  assert.equal(item.includes("Workflow Agent"), false)
}
assert.ok(home.timeline.some((period) => period.items.some((item) => item.startsWith("I "))))
console.log("  ✓ timeline rewritten into first-person narrative without engine names")

const reviewLabels = home.needsReview.groups.map((group) => group.label)
const allowedReviewLabels = new Set(Object.values(AI_EMPLOYEE_REVIEW_BUCKETS))
for (const label of reviewLabels) {
  assert.ok(allowedReviewLabels.has(label), `unexpected review bucket "${label}"`)
}
console.log("  ✓ Needs Your Review uses natural approval groups")

const requiredFiles = [
  "lib/workspace/ai-employee-experience.ts",
  "lib/growth/workspace/executive-briefing/growth-home-employee-voice.ts",
  "components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-completed-today-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-working-on-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-needs-review-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-work-summary-section.tsx",
  "components/growth/ai-teammate/ai-employee-status-provider.tsx",
  "docs/GE-AI-UX-4A_AI_EMPLOYEE_EXPERIENCE.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} employee experience files present`)

const homeLayout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
jsxOrder(homeLayout, "GrowthHomeCheckInSection", "GrowthHomeWaitingOnYouSection")
jsxOrder(homeLayout, "GrowthHomeWaitingOnYouSection", "GrowthHomeMyPrioritiesSection")
jsxOrder(homeLayout, "GrowthHomeMyPrioritiesSection", "GrowthHomeAccomplishmentsSection")
jsxOrder(homeLayout, "GrowthHomeMyPrioritiesSection", "GrowthHomeBusinessSnapshotSection")
jsxOrder(homeLayout, "GrowthHomeBusinessSnapshotSection", "GrowthHomeTimelineSection")
assert.ok(homeLayout.includes("GrowthHomeWorkSummarySection"))
assert.ok(homeLayout.includes("AiEmployeeStatusProvider") || homeLayout.includes("useAiEmployeeStatus"))
console.log("  ✓ Home layout follows AI employee hierarchy")

const topbar = readSource("components/growth/shell/growth-topbar.tsx")
assert.ok(topbar.includes("useAiEmployeeStatus"))
assert.ok(topbar.includes("statusLabel={status.label}"))
console.log("  ✓ AI status consistent in topbar")

const shell = readSource("components/growth/shell/growth-workspace-shell.tsx")
assert.ok(shell.includes("AiEmployeeStatusProvider"))
console.log("  ✓ workspace shell wires AI employee status provider")

const checkInSection = readSource("components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx")
assert.ok(checkInSection.includes("home-ai-employee-check-in"))
assert.ok(checkInSection.includes("foundIntro"))
assert.ok(checkInSection.includes("foundObservations"))
const completedSection = readSource("components/growth/workspace/executive-briefing/growth-home-completed-today-section.tsx")
assert.ok(completedSection.includes("AI_EMPLOYEE_COMPLETED_TODAY_TITLE"))
assert.ok(completedSection.includes("home-completed-today"))
const workingSection = readSource("components/growth/workspace/executive-briefing/growth-home-working-on-section.tsx")
assert.ok(workingSection.includes("AI_EMPLOYEE_WORKING_ON_TITLE"))
const needsReviewSection = readSource("components/growth/workspace/executive-briefing/growth-home-needs-review-section.tsx")
assert.ok(needsReviewSection.includes("AI_EMPLOYEE_NEEDS_REVIEW_TITLE"))
const workSummarySection = readSource("components/growth/workspace/executive-briefing/growth-home-work-summary-section.tsx")
assert.ok(workSummarySection.includes("AI_EMPLOYEE_WORK_SUMMARY_TITLE"))
console.log("  ✓ section titles match AI employee copy spec")

for (const file of listFilesRecursive(path.join(ROOT, "components/growth/workspace/executive-briefing"))) {
  const relative = path.relative(ROOT, file)
  const source = fs.readFileSync(file, "utf8")
  for (const label of AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS) {
    assert.equal(
      containsVisibleEngineLabel(source, label),
      false,
      `${relative} must not expose "${label}" in default Home UI`,
    )
  }
}

const homeSynthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts")
assert.equal(homeSynthesizer.includes("fetch("), false)
assert.equal(homeSynthesizer.includes('import "server-only"'), false)
console.log("  ✓ presentation-only — no backend/runtime/API changes")

assert.ok(home.executiveBrief.introLine.includes("Ava handled"))
assert.ok(home.executiveBrief.completedOutcomes[0]?.startsWith("She "))
console.log("  ✓ UX-3A teammate identity fields preserved on executiveBrief")

const operatorView = synthesizeGrowthAiOsOperatorExperience(buildGrowthAiOsOperatorExperienceCertFixture())
assert.ok(operatorView.executiveBrief.introLine.includes("Ava handled"))
console.log("  ✓ UX-3A operator teammate copy still present")

console.log(`[GE-AI-UX-4A] PASS — ${GE_AI_UX_4A_QA_MARKER}`)
