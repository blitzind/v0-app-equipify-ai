/**
 * GE-AIOS-5D — AI OS Daily Briefing read model certification.
 * Run: pnpm test:ge-aios-5d-daily-briefing-read-model-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_OS_DAILY_BRIEFING_RUNTIME_RULE,
  GROWTH_AIOS_5D_PHASE,
  GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER,
} from "../lib/growth/aios/ai-os-daily-briefing-types"
import {
  buildAiOsDailyBriefingCertFixture,
  synthesizeAiOsDailyBriefing,
} from "../lib/growth/aios/ai-os-daily-briefing-synthesizer"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function assertAllowedHref(href: string): void {
  const allowed =
    href.startsWith("/growth/os/missions/") ||
    href.startsWith("/growth/os/pilot/lead-research/") ||
    href === "/growth/objectives" ||
    href.startsWith("/growth/leads")
  assert.ok(allowed, `href must be an allowed link target: ${href}`)
}

console.log(`[${GROWTH_AIOS_5D_PHASE}] Daily Briefing read model certification`)

assert.equal(GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER, "growth-aios-5d-daily-briefing-v1")
assert.ok(AI_OS_DAILY_BRIEFING_RUNTIME_RULE.includes("read-only"))

const files = [
  "lib/growth/aios/ai-os-daily-briefing-types.ts",
  "lib/growth/aios/ai-os-daily-briefing-synthesizer.ts",
  "components/growth/ai-os/command-center/growth-ai-os-daily-briefing-section.tsx",
  "lib/growth/aios/ai-os-command-center-types.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx",
  "app(growth)/growth/os/page.tsx",
]
for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const synthesizer = readSource("lib/growth/aios/ai-os-daily-briefing-synthesizer.ts")
assert.ok(synthesizer.includes("synthesizeAiOsDailyBriefing"))
assert.equal(synthesizer.includes("fetch("), false)
assert.equal(synthesizer.includes("server-only"), false)
assert.equal(synthesizer.includes("createAiWorkOrder"), false)
assert.equal(synthesizer.includes("transitionAiWorkOrder"), false)
assert.equal(synthesizer.includes("invokeAiOsProviderWithContextPackage"), false)

const service = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(service.includes("synthesizeAiOsDailyBriefing"))
assert.ok(service.includes("dailyBriefing"))

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("GrowthAiOsDailyBriefingSection"))
assert.ok(panel.includes("model.dailyBriefing"))
const briefingIndex = panel.indexOf("GrowthAiOsDailyBriefingSection")
const executiveIndex = panel.indexOf('qaSection="executive-summary"')
assert.ok(briefingIndex >= 0 && executiveIndex >= 0 && briefingIndex < executiveIndex)

const briefingUi = readSource("components/growth/ai-os/command-center/growth-ai-os-daily-briefing-section.tsx")
assert.ok(briefingUi.includes('data-qa-section="daily-briefing"'))
assert.ok(briefingUi.includes("Recommended next actions"))
assert.ok(briefingUi.includes("Suggested links"))
assert.equal(briefingUi.includes("Execute"), false)
assert.equal(briefingUi.includes("method: \"POST\""), false)
assert.equal(briefingUi.includes("<Button"), false)

const fixture = buildAiOsDailyBriefingCertFixture()
const briefingA = synthesizeAiOsDailyBriefing(fixture)
const briefingB = synthesizeAiOsDailyBriefing(fixture)
assert.deepEqual(briefingA, briefingB, "briefing synthesis must be deterministic")
assert.equal(briefingA.readOnly, true)
assert.equal(briefingA.qaMarker, GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER)
assert.ok(briefingA.executiveHeadline.length > 0)
assert.ok(briefingA.topPriorities.length <= 3)
assert.ok(briefingA.needsApproval.length > 0)
assert.ok(briefingA.blockers.length > 0)

for (const item of [
  ...briefingA.topPriorities,
  ...briefingA.needsApproval,
  ...briefingA.blockers,
  ...briefingA.recommendedNextActions,
]) {
  if (item.href) assertAllowedHref(item.href)
}
for (const link of briefingA.suggestedLinks) {
  assertAllowedHref(link.href)
}

for (const file of files) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitz@equipify.com"])
}

console.log(`[${GROWTH_AIOS_5D_PHASE}] PASS — Daily Briefing read model certified (local)`)
