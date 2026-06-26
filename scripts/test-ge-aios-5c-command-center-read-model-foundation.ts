/**
 * GE-AIOS-5C — AI OS Command Center read model certification.
 * Run: pnpm test:ge-aios-5c-command-center-read-model-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AI_OS_COMMAND_CENTER_RUNTIME_RULE,
  GROWTH_AIOS_5C_PHASE,
  GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
} from "../lib/growth/aios/ai-os-command-center-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_5C_PHASE}] Command Center read model certification`)

assert.equal(GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER, "growth-aios-5c-command-center-v1")
assert.ok(AI_OS_COMMAND_CENTER_RUNTIME_RULE.includes("read-only"))

const files = [
  "lib/growth/aios/ai-os-command-center-types.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "app/api/platform/growth/ai-os/command-center/route.ts",
  "app/(growth)/growth/os/page.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx",
]
for (const file of files) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(service.includes("fetchAiOsCommandCenterReadModel"))
assert.ok(service.includes("listGrowthObjectives"))
assert.ok(service.includes("listAiWorkOrders"))
assert.ok(service.includes("listAiOsEvents"))
assert.ok(service.includes("listAiDecisionRecords"))
assert.ok(service.includes("evaluateAiOsAgentHealth"))
assert.ok(service.includes("evaluateAiOsProviderHealth"))
assert.ok(service.includes("resolveLeadResearchPilotConfig"))
assert.ok(service.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(service.includes("buildCommandCenterSafeModeFromPolicy"))
assert.ok(service.includes('from "@/lib/growth/aios/ai-os-daily-briefing-synthesizer"'))
assert.ok(service.includes('from "@/lib/growth/aios/ai-os-operations-dashboard-synthesizer"'))
assert.ok(service.includes("import { synthesizeAiOsDailyBriefing }"))
assert.ok(service.includes("import { synthesizeAiOsOperationsDashboard }"))
assert.equal(service.includes("runAiOsExecutMissionPlanningTick"), false)
assert.equal(service.includes("runExecutMissionPlanningTick"), false)
assert.equal(service.includes("transitionAiWorkOrder"), false)
assert.equal(service.includes("invokeAiOsProviderWithContextPackage"), false)
assert.equal(service.includes("expireStaleAiOsAgentLeases"), false)
assert.equal(service.includes("createAiWorkOrder"), false)
assert.equal(service.includes("approvePreview"), false)

const route = readSource("app/api/platform/growth/ai-os/command-center/route.ts")
assert.ok(route.includes("fetchAiOsCommandCenterReadModel"))
assert.ok(route.includes('export async function GET(request: Request)'))
assert.ok(route.includes("requireGrowthEnginePlatformAccess(request)"))
assert.equal(route.includes("POST"), false)
assert.ok(route.includes("growth_engine_ai_org_not_configured"))

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
const diagnostics = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-command-center-diagnostics-sections.tsx",
)
assert.ok(panel.includes("/api/platform/growth/ai-os/command-center"))
assert.ok(panel.includes("GrowthAiOsOperationsDashboard"))
assert.ok(panel.includes("engineering-diagnostics-toggle"))
assert.ok(diagnostics.includes('qaSection="executive-summary"'))
assert.ok(diagnostics.includes('qaSection="active-missions"'))
assert.ok(diagnostics.includes('qaSection="needs-attention"'))
assert.ok(diagnostics.includes('qaSection="recent-activity"'))
assert.ok(diagnostics.includes('qaSection="agent-health"'))
assert.ok(diagnostics.includes('qaSection="provider-health"'))
assert.ok(diagnostics.includes('qaSection="pilot-status"'))
assert.ok(diagnostics.includes('qaSection="safe-mode"'))
assert.ok(diagnostics.includes("Mission Planning Review"))
assert.equal(panel.includes("method: \"POST\""), false)
assert.equal(panel.includes("Create Work Orders"), false)

const page = readSource("app/(growth)/growth/os/page.tsx")
assert.ok(page.includes("GrowthAiOsCommandCenterPanel"))

for (const file of files) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "blitz@equipify.com"])
}

console.log(`[${GROWTH_AIOS_5C_PHASE}] PASS — Command Center read model certified (local)`)
