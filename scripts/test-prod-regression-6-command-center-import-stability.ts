/**
 * PROD-REGRESSION-6 — Command Center import stability & AI Operations route certification.
 * Run: pnpm test:prod-regression-6-command-center-import-stability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildAiOsDailyBriefingCertFixture,
  synthesizeAiOsDailyBriefing,
} from "../lib/growth/aios/ai-os-daily-briefing-synthesizer"
import { synthesizeAiOsOperationsDashboard } from "../lib/growth/aios/ai-os-operations-dashboard-synthesizer"
import { mapAiOsLegacyPublicPathToCanonical } from "../lib/growth/aios/ai-os-public-routes"

export const PROD_REGRESSION_6_COMMAND_CENTER_QA_MARKER =
  "prod-regression-6-command-center-import-stability-v1" as const

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

console.log(`[PROD-REGRESSION-6] Command Center import stability certification`)

async function runCertification(): Promise<void> {

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes('import "server-only"'))
assert.ok(
  commandCenterService.includes('from "@/lib/growth/aios/ai-os-daily-briefing-synthesizer"'),
  "command-center service must import daily briefing synthesizer",
)
assert.ok(
  commandCenterService.includes('from "@/lib/growth/aios/ai-os-operations-dashboard-synthesizer"'),
  "command-center service must import operations dashboard synthesizer",
)
assert.ok(commandCenterService.includes("import { synthesizeAiOsDailyBriefing }"))
assert.ok(commandCenterService.includes("import { synthesizeAiOsOperationsDashboard }"))
console.log("  ✓ command-center service imports both synthesizers")

// ── 2. Runtime smoke — synthesizers callable (no ReferenceError) ─────────────

const fixture = buildAiOsDailyBriefingCertFixture()
const briefing = synthesizeAiOsDailyBriefing(fixture)
assert.equal(briefing.qaMarker, "growth-aios-5d-daily-briefing-v1")
assert.equal(typeof synthesizeAiOsOperationsDashboard, "function")
console.log("  ✓ synthesizers resolve and execute without ReferenceError")

// ── 3. Dynamic import of server read model module ────────────────────────────

const serviceModule = await import("../lib/growth/aios/ai-os-command-center-service.ts")
assert.equal(typeof serviceModule.fetchAiOsCommandCenterReadModel, "function")
console.log("  ✓ fetchAiOsCommandCenterReadModel resolves from server module")

// ── 4. Client components must not import server-only services ────────────────

const aiOsUiDir = path.join(ROOT, "components/growth/ai-os")
const aiOsUiFiles = listFilesRecursive(aiOsUiDir)
const forbiddenClientImports = [
  "ai-os-command-center-service",
  'import "server-only"',
  "fetchAiOsCommandCenterReadModel",
  "agent-orchestration/",
]

for (const file of aiOsUiFiles) {
  const source = fs.readFileSync(file, "utf8")
  const relative = path.relative(ROOT, file)
  for (const token of forbiddenClientImports) {
    assert.equal(
      source.includes(token),
      false,
      `${relative} must not reference ${token}`,
    )
  }
  const serviceImport = source.match(/from ["']@\/lib\/growth\/aios\/[^"']+-service["']/g)
  assert.equal(serviceImport, null, `${relative} must not import *-service modules`)
}
console.log(`  ✓ ${aiOsUiFiles.length} AI OS UI files avoid server-only service imports`)

// ── 5. Synthesizer modules remain client-safe ────────────────────────────────

for (const file of [
  "lib/growth/aios/ai-os-daily-briefing-synthesizer.ts",
  "lib/growth/aios/ai-os-operations-dashboard-synthesizer.ts",
]) {
  const source = readSource(file)
  assert.equal(source.includes('import "server-only"'), false, `${file} must stay client-safe`)
}
console.log("  ✓ synthesizer modules remain client-safe (no server-only)")

// ── 6. API route auth + org guard ────────────────────────────────────────────

const commandCenterRoute = readSource("app/api/platform/growth/ai-os/command-center/route.ts")
assert.ok(commandCenterRoute.includes("requireGrowthEnginePlatformAccess(request)"))
assert.ok(commandCenterRoute.includes('export const runtime = "nodejs"'))
assert.ok(commandCenterRoute.includes("growth_engine_ai_org_not_configured"))
assert.ok(commandCenterRoute.includes("fetchAiOsCommandCenterReadModel"))
console.log("  ✓ command-center API uses request-scoped auth and org guard")

// ── 7. Growth auth dedupe (no concurrent getUser lock regression) ────────────

const growthEngineSession = readSource("lib/growth/growth-engine-session.ts")
const growthLayout = readSource("app/(growth)/layout.tsx")
assert.equal(
  growthEngineSession.includes("inflightCookieSessionAuth"),
  false,
  "module-scoped cookie auth inflight must remain removed (GE-AIOS-HOTFIX-LIVE-1C-5D)",
)
assert.ok(growthEngineSession.includes("resolveCookieSessionAuthSnapshot"))
assert.doesNotMatch(
  growthLayout,
  /createServerSupabaseClient[\s\S]*?auth\.getUser[\s\S]*?resolveGrowthWorkspacePageAccess/,
)
console.log("  ✓ Growth cookie auth is request-local; layout avoids duplicate getUser")

// ── 8. Route files exist for AI Operations surfaces ──────────────────────────

const requiredRoutes = [
  "app/(growth)/growth/os/page.tsx",
  "app/(growth)/growth/os/missions/[missionId]/planning/page.tsx",
  "app/(growth)/growth/os/pilot/lead-research/[leadId]/page.tsx",
  "app/api/platform/growth/ai-os/command-center/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts",
]
for (const route of requiredRoutes) {
  assert.ok(fs.existsSync(path.join(ROOT, route)), `${route} must exist`)
}
console.log("  ✓ AI Operations + mission planning routes present")

// ── 9. Legacy /growth/ai-os redirects ────────────────────────────────────────

const nextConfig = readSource("next.config.mjs")
assert.ok(nextConfig.includes('source: "/growth/ai-os/:path*"'))
assert.equal(mapAiOsLegacyPublicPathToCanonical("/growth/ai-os/missions/x/planning"), "/growth/os/missions/x/planning")
console.log("  ✓ legacy /growth/ai-os paths map to canonical /growth/os")

// ── 10. AI Operations read-only UI ──────────────────────────────────────────

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("/api/platform/growth/ai-os/command-center"))
assert.ok(panel.includes("GrowthAiOsOperatorDashboard"))
assert.equal(panel.includes('method: "POST"'), false)
assert.equal(panel.includes("transitionAiWorkOrder"), false)
console.log("  ✓ AI Operations panel remains read-only (operator dashboard, GET only)")

// ── 11. No GS-4D agent-orchestration in AI OS server path ──────────────────

const aiosServerFiles = listFilesRecursive(path.join(ROOT, "lib/growth/aios"))
for (const file of aiosServerFiles) {
  const source = fs.readFileSync(file, "utf8")
  assert.equal(
    source.includes("agent-orchestration"),
    false,
    `${path.relative(ROOT, file)} must not import deprecated GS-4D orchestration`,
  )
}
console.log("  ✓ AI OS lib tree avoids deprecated agent-orchestration imports")

// ── 12. Autonomy policy gates unchanged (control plane path) ─────────────────

const policyTypes = readSource("lib/growth/autonomy/growth-ai-os-autonomy-policy-types.ts")
assert.ok(policyTypes.includes("GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH"))
console.log("  ✓ Growth Autonomy control plane path unchanged")

console.log(`[PROD-REGRESSION-6] PASS — ${PROD_REGRESSION_6_COMMAND_CENTER_QA_MARKER}`)
}

runCertification().catch((error) => {
  console.error(error)
  process.exit(1)
})
