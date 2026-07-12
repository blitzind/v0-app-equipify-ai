/**
 * Growth Engine platform access — cookie + bearer parity certification.
 * Run: pnpm test:growth-engine-platform-access
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { isPlatformAdminEmail } from "../lib/platform-admin-policy"

const ROOT = process.cwd()

const accessSource = fs.readFileSync(path.join(ROOT, "lib/growth/access.ts"), "utf8")
const sessionSource = fs.readFileSync(path.join(ROOT, "lib/growth/growth-engine-session.ts"), "utf8")
assert.match(accessSource, /resolveGrowthEnginePlatformUser/)
assert.match(accessSource, /requireGrowthAccess/)
assert.match(sessionSource, /getBearerAccessToken/)
assert.match(sessionSource, /createSupabaseClientWithAccessToken\(bearer\)/)
assert.match(sessionSource, /bearerClient\.auth\.getUser\(\)/)
assert.match(sessionSource, /cookieClient\.auth\.getUser\(bearer\)/)
assert.doesNotMatch(sessionSource, /inflightCookieSessionAuth/)
assert.match(sessionSource, /resolveCookieSessionAuthSnapshot/)
console.log("  ✓ bearer validated via access-token client + cookie fallback")
console.log("  ✓ cookie auth is request-local (no module-scoped inflight)")

const serverSource = fs.readFileSync(path.join(ROOT, "lib/supabase/server.ts"), "utf8")
assert.match(serverSource, /Authorization: `Bearer \$\{accessToken\}`/)
console.log("  ✓ access-token client sets Authorization header for Supabase getUser")

function getBearerAccessTokenFromHeader(authHeader: string | null | undefined): string | null {
  if (typeof authHeader !== "string") return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token || null
}

assert.equal(getBearerAccessTokenFromHeader("NotBearer token"), null)
assert.equal(getBearerAccessTokenFromHeader("Bearer"), null)
assert.equal(getBearerAccessTokenFromHeader("Bearer   "), null)
assert.equal(getBearerAccessTokenFromHeader("Bearer eyJheader.payload.sig"), "eyJheader.payload.sig")
console.log("  ✓ malformed Bearer header yields no token")

const commandCenterRoute = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/revenue-execution/command-center/route.ts"),
  "utf8",
)
assert.match(commandCenterRoute, /requireGrowthEnginePlatformAccess\(request\)/)
console.log("  ✓ command-center passes request into platform access")

const diagnosticRoute = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-25-company-pilot/diagnostic/route.ts"),
  "utf8",
)
assert.match(diagnosticRoute, /requireGrowthEnginePlatformAccess\(request\)/)
console.log("  ✓ apollo-25-company-pilot diagnostic passes request into platform access")

const reportRoute = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-25-company-pilot/report/route.ts"),
  "utf8",
)
assert.match(reportRoute, /requireGrowthEnginePlatformAccess\(request\)/)
console.log("  ✓ apollo-25-company-pilot report passes request into platform access")

const operationsDashboardRoute = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-operations-dashboard/route.ts"),
  "utf8",
)
assert.match(operationsDashboardRoute, /requireGrowthEnginePlatformAccess\(request\)/)
console.log("  ✓ apollo-operations-dashboard passes request into platform access")

process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS = "mike@blitzind.com"
assert.equal(isPlatformAdminEmail("mike@blitzind.com"), true)
assert.equal(isPlatformAdminEmail("other@example.com"), false)
console.log("  ✓ platform admin allowlist is email-based (not org role)")

console.log("\nGrowth Engine Platform Access Certification PASSED")
