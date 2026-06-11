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
assert.match(accessSource, /getBearerAccessToken/)
assert.match(accessSource, /resolveGrowthEnginePlatformUser/)
assert.match(accessSource, /cookieClient\.auth\.getUser\(bearer\)/)
console.log("  ✓ requireGrowthEnginePlatformAccess resolves bearer + cookie sessions")

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

process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS = "mike@blitzind.com"
assert.equal(isPlatformAdminEmail("mike@blitzind.com"), true)
assert.equal(isPlatformAdminEmail("other@example.com"), false)
console.log("  ✓ platform admin allowlist is email-based (not org role)")

console.log("\nGrowth Engine Platform Access Certification PASSED")
