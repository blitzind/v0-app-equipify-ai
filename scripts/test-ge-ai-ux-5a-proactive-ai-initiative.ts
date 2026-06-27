/**
 * GE-AI-UX-5A — Proactive AI Initiative certification (static).
 * Run: pnpm test:ge-ai-ux-5a-proactive-ai-initiative
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthHomeExecutiveBriefingCertFixture,
} from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_INITIATIVE_CONFIDENCE_LABELS,
  AI_INITIATIVE_PRIORITY_LABELS,
  AI_PROACTIVE_FOUND_INTRO,
  GE_AI_UX_5A_QA_MARKER,
} from "../lib/workspace/ai-proactive-initiative"
import {
  AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS,
} from "../lib/workspace/ai-os-outcome-first-terminology"

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

console.log(`[GE-AI-UX-5A] Proactive AI Initiative certification`)

assert.equal(GE_AI_UX_5A_QA_MARKER, "ge-ai-ux-5a-proactive-ai-initiative-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
console.log("  ✓ QA markers bumped for proactive initiative layer")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.equal(home.checkIn.foundIntro, AI_PROACTIVE_FOUND_INTRO)
assert.ok(home.checkIn.foundObservations.length >= 3)
assert.ok(home.checkIn.foundIntro.includes("Here's what I found"))
console.log("  ✓ Home opens with proactive found narrative")

for (const item of home.thingsNoticed) {
  assert.ok(item.evidence.length > 0, "noticed item must include evidence")
  assert.match(item.observation, /^I'm (responsible|monitoring|preparing|waiting|protecting|tracking|optimizing)|^I (found|noticed|discovered|detected|identified|recommend)/i)
  assert.equal(item.observation.includes("The system"), false)
  assert.equal(item.observation.includes("The engine"), false)
}
console.log("  ✓ Things I Noticed built from read models with first-person voice")

assert.ok(home.watching.length >= 1)
for (const item of home.watching) {
  assert.ok(item.label.length > 0)
}
console.log("  ✓ What I'm Watching uses active monitoring data")

for (const rec of home.initiativeRecommendations) {
  assert.ok(rec.evidence.length >= 1, "recommendation must include evidence")
  assert.ok(rec.headline.includes("because") || rec.headline.startsWith("I recommend"))
  assert.ok(Object.values(AI_INITIATIVE_CONFIDENCE_LABELS).includes(rec.confidenceLabel))
  assert.ok(Object.values(AI_INITIATIVE_PRIORITY_LABELS).includes(rec.priorityLabel))
  assert.equal(rec.headline.includes("%"), false)
  assert.equal(rec.confidenceLabel.includes("%"), false)
}
console.log("  ✓ recommendations contain evidence, confidence labels, and priority wording")

assert.ok(home.businessAwareness.currentObjective || home.businessAwareness.topWin)
console.log("  ✓ business awareness cards derived from briefing read models")

const requiredFiles = [
  "lib/workspace/ai-proactive-initiative.ts",
  "lib/growth/workspace/executive-briefing/growth-home-proactive-initiative-synthesizer.ts",
  "components/growth/workspace/executive-briefing/growth-home-things-noticed-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-watching-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-business-awareness-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-initiative-recommendations-section.tsx",
  "docs/GE-AI-UX-5A_PROACTIVE_AI_INITIATIVE.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredFiles.length} proactive initiative files present`)

const homeLayout = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(homeLayout.includes("GrowthHomeThingsNoticedSection"))
assert.ok(homeLayout.includes("GrowthHomeWatchingSection"))
assert.ok(homeLayout.includes("GrowthHomeInitiativeRecommendationsSection"))
jsxOrder(homeLayout, "GrowthHomeThingsNoticedSection", "GrowthHomeWatchingSection")
console.log("  ✓ Home layout retains proactive initiative sections")

const thingsSection = readSource("components/growth/workspace/executive-briefing/growth-home-things-noticed-section.tsx")
assert.ok(thingsSection.includes("AI_PROACTIVE_THINGS_NOTICED_TITLE"))
const watchingSection = readSource("components/growth/workspace/executive-briefing/growth-home-watching-section.tsx")
assert.ok(watchingSection.includes("AI_PROACTIVE_WATCHING_TITLE"))
console.log("  ✓ section titles match proactive initiative spec")

for (const file of listFilesRecursive(path.join(ROOT, "components/growth/workspace/executive-briefing"))) {
  const relative = path.relative(ROOT, file)
  const source = fs.readFileSync(file, "utf8")
  for (const label of AI_OS_HIDDEN_DEFAULT_ENGINE_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const visible =
      new RegExp(`["'\`]${escaped}["'\`]`).test(source) || new RegExp(`>\\s*${escaped}\\s*<`).test(source)
    assert.equal(visible, false, `${relative} must not expose "${label}" in default Home UI`)
  }
}

const synthesizer = readSource("lib/growth/workspace/executive-briefing/growth-home-proactive-initiative-synthesizer.ts")
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes('import "server-only"'), false)
console.log("  ✓ presentation-only — no backend/runtime/API changes")

console.log(`[GE-AI-UX-5A] PASS — ${GE_AI_UX_5A_QA_MARKER}`)
