/**
 * GE-AI-UX-1A — Operator Experience Redesign certification (static).
 * Run: pnpm test:ge-ai-ux-1a-operator-experience-redesign
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { synthesizeGrowthAiOsOperatorExperience, buildGrowthAiOsOperatorExperienceCertFixture } from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer"
import { translateOperatorActivityHeadline } from "../lib/growth/aios/operator-experience/growth-ai-os-operator-event-translator"
import { GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER } from "../lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"

export const GE_AI_UX_1A_QA_MARKER = "ge-ai-ux-1a-operator-experience-redesign-v1" as const

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

console.log(`[GE-AI-UX-1A] Operator Experience Redesign certification`)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("GrowthAiOsOperatorDashboard"))
assert.equal(panel.includes("GrowthAiOsOperationsDashboard"), false, "default panel must not render legacy dashboard")
assert.equal(panel.includes('method: "POST"'), false, "command center panel remains read-only")
console.log("  ✓ command center panel uses operator dashboard (GET only)")

const operatorDir = path.join(ROOT, "components/growth/ai-os/operator-experience")
const requiredComponents = [
  "growth-ai-os-operator-dashboard.tsx",
  "growth-ai-os-executive-brief-section.tsx",
  "growth-ai-os-needs-attention-section.tsx",
  "growth-ai-os-ai-working-section.tsx",
  "growth-ai-os-business-snapshot-section.tsx",
  "growth-ai-os-ai-timeline-section.tsx",
  "growth-ai-os-operator-engineering-disclosure.tsx",
  "growth-ai-os-operator-revenue-director-card.tsx",
  "growth-ai-os-operator-approvals-summary.tsx",
  "growth-ai-os-operator-communication-card.tsx",
  "growth-ai-os-operator-system-status-card.tsx",
  "growth-ai-os-operator-ai-improvements-section.tsx",
]
for (const file of requiredComponents) {
  assert.ok(fs.existsSync(path.join(operatorDir, file)), `${file} must exist`)
}
console.log(`  ✓ ${requiredComponents.length} operator experience components present`)

const disclosure = readSource("components/growth/ai-os/operator-experience/growth-ai-os-operator-engineering-disclosure.tsx")
assert.ok(disclosure.includes("GrowthAiOsOperationsDashboard"))
assert.ok(disclosure.includes("GrowthAiOsCommandCenterDiagnosticsSections"))
console.log("  ✓ progressive disclosure preserves legacy operations + diagnostics")

const translated = translateOperatorActivityHeadline({
  title: "Growth Communication Plan Generated",
  summary: "",
})
assert.ok(translated.headline.includes("communication strategy"))
console.log("  ✓ event bus terminology translated for operators")

const view = synthesizeGrowthAiOsOperatorExperience(buildGrowthAiOsOperatorExperienceCertFixture())
assert.equal(view.qaMarker, GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER)
assert.ok(view.executiveBrief.todayHighlights.length >= 3)
assert.ok(view.needsAttention.length <= 5)
assert.ok(view.aiWorking.length >= 1)
assert.ok(view.businessSnapshot.length >= 6)
assert.ok(view.systemStatus.headline.length > 0)
assert.ok(Array.isArray(view.aiImprovements))
console.log("  ✓ operator experience synthesizer produces executive view model")

const aiOsUiFiles = listFilesRecursive(path.join(ROOT, "components/growth/ai-os"))
for (const file of aiOsUiFiles) {
  const source = fs.readFileSync(file, "utf8")
  const relative = path.relative(ROOT, file)
  assert.equal(source.includes("ai-os-command-center-service"), false, `${relative} must not import server service`)
}
console.log(`  ✓ ${aiOsUiFiles.length} AI OS UI files avoid server-only imports`)

const synthesizerSource = readSource("lib/growth/aios/operator-experience/growth-ai-os-operator-experience-synthesizer.ts")
assert.equal(synthesizerSource.includes('import "server-only"'), false)
assert.equal(synthesizerSource.includes("fetch("), false)
console.log("  ✓ operator synthesizer is client-safe presentation layer")

const serviceSource = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.equal(serviceSource.includes("operator-experience"), false, "command center service unchanged")
console.log("  ✓ no API/service/repository changes")

console.log(`[GE-AI-UX-1A] PASS — ${GE_AI_UX_1A_QA_MARKER}`)
