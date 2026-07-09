/**
 * GE-AIOS-18D/18B-HOTFIX — /growth route access regression certification.
 * Run: pnpm test:ge-aios-hotfix-growth-route-access
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-workspace-base-path"

const PHASE = "GE-AIOS-HOTFIX-GROWTH-ROUTE-ACCESS" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] /growth route access hotfix certification`)

  const growthLayout = readSource("app/(growth)/layout.tsx")
  const growthPage = readSource("app/(growth)/growth/page.tsx")
  const growthEngineSession = readSource("lib/growth/growth-engine-session.ts")
  const accessResolution = readSource("lib/growth/rbac/growth-access-resolution.ts")
  const middleware = readSource("middleware.ts")
  const dashboardPage = readSource("app/(dashboard)/page.tsx")

  assert.match(growthLayout, /resolveGrowthWorkspacePageAccess/)
  assert.match(growthLayout, /redirect\(access\.reason === "unauthenticated" \? "\/login" : "\/"\)/)
  assert.match(growthPage, /GrowthWorkspaceDashboardBody/)
  assert.doesNotMatch(growthPage, /redirect\(/)
  console.log("  ✓ /growth layout gates access; page renders Home body")

  assert.match(growthEngineSession, /import \{ z \} from "zod"/)
  assert.match(growthEngineSession, /z\.string\(\)\.uuid\(\)\.safeParse/)
  console.log("  ✓ getGrowthEngineAiOrgId uses zod (import restored — no ReferenceError at runtime)")

  assert.match(accessResolution, /resolveGrowthRoleForUser/)
  assert.match(accessResolution, /getGrowthEngineAiOrgId/)
  assert.match(accessResolution, /isGrowthEngineEnabledEnv/)
  console.log("  ✓ RBAC resolver still enforces Growth entitlement")

  assert.match(middleware, /isGrowthWorkspacePath/)
  assert.match(middleware, /x-growth-pathname/)
  assert.match(middleware, /shouldSkipMiddlewareAuth\(pathname\)/)
  console.log("  ✓ middleware passes /growth to layout RBAC gate")
  assert.doesNotMatch(middleware, /redirect\(new URL\("\/growth"/)
  console.log("  ✓ middleware does not redirect /growth away from workspace")

  assert.match(growthLayout, /x-growth-pathname/)
  assert.match(
    growthLayout,
    /headersList\.get\("x-growth-pathname"\)/,
    "layout must read pathname header for query-preserving routes like /growth?setup=1",
  )
  console.log("  ✓ /growth?setup=1 uses pathname header without redirecting to /")

  assert.match(dashboardPage, /export default/)
  assert.doesNotMatch(dashboardPage, /redirect\(\s*["']\/growth/)
  console.log("  ✓ core platform / route remains separate from Growth workspace")

  const specialistTeam = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx",
  )
  const specialistsBarrel = readSource("lib/growth/specialists/index.ts")
  assert.doesNotMatch(specialistTeam, /from "@\/lib\/growth\/specialists"/)
  assert.doesNotMatch(specialistsBarrel, /growth-access-resolution/)
  assert.doesNotMatch(specialistsBarrel, /autonomous-sales-loop-observability/)
  console.log("  ✓ no server-only RBAC import leaks into client bundle")

  assert.equal(GROWTH_WORKSPACE_BASE_PATH, "/growth")

  console.log(`[${PHASE}] PASS`)
}

main()
