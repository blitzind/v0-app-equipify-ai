/**
 * Growth middleware auth + performance guards (Phase 8E).
 *
 * Usage: pnpm test:growth-middleware-auth
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_MIDDLEWARE_AUTH_QA_MARKER = "growth-middleware-auth-v3" as const

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth middleware auth audit (${GROWTH_MIDDLEWARE_AUTH_QA_MARKER}) ===\n`)

  const middleware = read("middleware.ts")
  const supabaseMiddleware = read("lib/supabase/middleware.ts")
  const portalGate = read("lib/portal/middleware-gate.ts")
  const middlewareTimeout = read("lib/supabase/middleware-timeout.ts")
  const growthLayout = read("app/(growth)/layout.tsx")
  const growthAccess = read("lib/growth/access.ts")
  const growthEngineSession = read("lib/growth/growth-engine-session.ts")
  const workspaceSettingsApi = read("app/api/growth/workspace/settings/profile/route.ts")
  const platformGrowthApi = read("app/api/platform/growth/notifications/preferences/route.ts")

  assert.match(
    middleware,
    /from "@\/lib\/growth\/navigation\/growth-route-metadata-types"/,
    "middleware must import Growth base path from lightweight metadata-types",
  )
  assert.doesNotMatch(
    middleware,
    /growth-workspace-base-path|growth-route-registry|growth-route-metadata"|growth-route-catalog/,
    "middleware must not import heavy Growth navigation registries",
  )
  console.log("  ✓ middleware avoids heavy Growth registry imports")

  assert.match(
    middleware,
    /if \(isGrowthWorkspacePath\(pathname\)\) return true/,
    "/growth/* must bypass middleware Supabase auth",
  )
  assert.match(middleware, /x-growth-api-pathname/, "Growth API paths must inject pathname header for RBAC")
  console.log("  ✓ Growth API paths inject x-growth-api-pathname for centralized RBAC")
  assert.match(middleware, /\/api\/growth\//, "/api/growth/* must bypass middleware auth")
  assert.match(middleware, /\/api\/platform\/growth\//, "/api/platform/growth/* must bypass middleware auth")
  assert.match(
    middleware,
    /if \(isGrowthWorkspacePath\(pathname\)\) \{[\s\S]*?x-growth-pathname[\s\S]*?return NextResponse\.next/,
    "/growth/* must short-circuit before session refresh",
  )
  assert.equal(GROWTH_WORKSPACE_BASE_PATH, "/growth")
  console.log("  ✓ /growth/* and Growth API paths excluded from middleware Supabase auth work")

  assert.match(middleware, /\/downloads\//, "matcher or early return must bypass /downloads/*")
  assert.match(middleware, /shouldSkipSupabaseSessionRefresh/, "voice ingress bypass preserved")
  console.log("  ✓ static/download/voice paths bypass middleware work")

  assert.match(
    middleware,
    /if \(pathname\.startsWith\("\/admin"\)\) \{[\s\S]*?if \(!isAuthenticated\)/,
    "/admin/* must retain middleware session gate",
  )
  assert.match(
    middleware,
    /if \(isGrowthApiPath\(pathname\)\) \{[\s\S]*?x-growth-api-pathname[\s\S]*?return NextResponse\.next/,
    "Growth APIs must short-circuit before session refresh",
  )
  console.log("  ✓ /admin/* protection unchanged; Growth APIs skip duplicate middleware auth")

  assert.match(growthLayout, /resolveGrowthWorkspacePageAccess/, "Growth layout must enforce Growth RBAC gate")
  assert.match(growthLayout, /redirect\("\/login"\)/, "unauthenticated users redirected to login")
  assert.doesNotMatch(growthLayout, /loadPlatformAdminIdentity/, "Growth layout must not require platform admin only")
  console.log("  ✓ /growth/* page auth enforced by Growth RBAC layout gate")

  assert.match(growthAccess, /requireGrowthEnginePlatformAccess/, "Growth route handlers retain access gate")
  assert.match(growthEngineSession, /raceMiddlewareAuthOperation/, "Growth API auth must use bounded timeout guards")
  assert.match(
    growthEngineSession,
    /raceMiddlewareAuthOperation\(cookieClient\.auth\.getUser\(\)\)/,
    "Growth cookie session auth must time out",
  )
  assert.match(workspaceSettingsApi, /requireGrowthWorkspaceSettingsAccess/, "workspace settings APIs retain access gate")
  assert.match(platformGrowthApi, /requireGrowthEnginePlatformAccess/, "platform growth APIs retain access gate")
  console.log("  ✓ skipped Growth APIs still protected in route handlers")

  assert.match(supabaseMiddleware, /raceMiddlewareAuthOperation/, "updateSession must use middleware auth timeout")
  assert.match(supabaseMiddleware, /raceMiddlewareAuthOperation\(supabase\.auth\.getUser\(\)\)/, "getUser timeout guard required")
  assert.match(supabaseMiddleware, /raceMiddlewareAuthOperation\([\s\S]*userHasOnlyArchivedOrganizationMemberships/, "archived membership timeout guard required")
  assert.match(supabaseMiddleware, /raceMiddlewareAuthOperation\(supabase\.auth\.signOut\(\)\)/, "signOut timeout guard required")
  assert.match(portalGate, /raceMiddlewareAuthOperation\(verifyPortalToken/, "portal token verify timeout guard required")
  assert.match(middlewareTimeout, /MIDDLEWARE_AUTH_OPERATION_TIMEOUT_MS/, "middleware timeout budget exported")
  console.log("  ✓ middleware auth operations use bounded timeout guards")

  assert.match(
    middleware,
    /pathname === "\/login" && isAuthenticated[\s\S]*redirect\(new URL\("\/", request\.url\)\)/,
    "authenticated /login must redirect to / (no /login loop)",
  )
  console.log("  ✓ no /login redirect recursion pattern in middleware source")

  const readonlyClient = read("lib/growth/settings/growth-workspace-settings-readonly-client.ts")
  assert.match(readonlyClient, /settingsBootstrapInflight/, "settings readonly client must share one bootstrap inflight")
  assert.match(readonlyClient, /loadGrowthWorkspaceSettingsReadonlyBootstrap/, "settings bootstrap loader required")
  console.log("  ✓ settings readonly client uses shared bootstrap inflight")

  console.log("\nGrowth middleware auth audit PASS\n")
  console.log(JSON.stringify({ ok: true, qa_marker: GROWTH_MIDDLEWARE_AUTH_QA_MARKER }, null, 2))
}

runAudit()
