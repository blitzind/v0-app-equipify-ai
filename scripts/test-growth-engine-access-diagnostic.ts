/**
 * Growth Engine access diagnostic — bearer/cookie/allowlist certification.
 * Run: pnpm test:growth-engine-access-diagnostic
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  buildGrowthEngineAccessDiagnostic,
  isGrowthEngineAccessDiagnosticEnabledEnv,
} from "../lib/growth/growth-engine-access-diagnostic"
import { isPlatformAdminEmail } from "../lib/platform-admin-policy"
import { getPlatformAdminAllowlistMeta } from "../lib/platform-admin-policy"

const ROOT = process.cwd()

assert.ok(
  fs.existsSync(path.join(ROOT, "app/api/platform/growth/access-diagnostic/route.ts")),
  "missing access-diagnostic route",
)
assert.ok(
  fs.existsSync(path.join(ROOT, "lib/growth/growth-engine-access-diagnostic-route.ts")),
  "missing diagnostic route loader",
)

const accessSource = fs.readFileSync(path.join(ROOT, "lib/growth/access.ts"), "utf8")
assert.match(accessSource, /resolveGrowthEnginePlatformUserResolution/)
console.log("  ✓ shared bearer/cookie resolution exported from access.ts")

process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS = "mike@blitzind.com,ops@equipify.ai"
const allowlistMeta = getPlatformAdminAllowlistMeta()
assert.equal(allowlistMeta.admin_allowlist_env_present, true)
assert.equal(allowlistMeta.admin_allowlist_entry_count, 2)

const bearerOnly = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: true,
  bearer_token_present: true,
  bearer_user_resolved: true,
  cookie_user_resolved: false,
  resolved_email: "mike@blitzind.com",
  admin_allowlist_env_present: true,
  admin_allowlist_entry_count: 2,
  admin_allowlist_env_source: "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
  resolved_email_in_admin_allowlist: true,
})
assert.equal(bearerOnly.access_decision, "allowed")
assert.equal(bearerOnly.bearer_user_resolved, true)
console.log("  ✓ bearer token user resolution grants access when email in allowlist")

const cookieFallback = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: false,
  bearer_token_present: false,
  bearer_user_resolved: false,
  cookie_user_resolved: true,
  resolved_email: "mike@blitzind.com",
  admin_allowlist_env_present: true,
  admin_allowlist_entry_count: 2,
  admin_allowlist_env_source: "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
  resolved_email_in_admin_allowlist: true,
})
assert.equal(cookieFallback.access_decision, "allowed")
assert.equal(cookieFallback.cookie_user_resolved, true)
console.log("  ✓ cookie session fallback grants access")

const allowlistPresentNotIncluded = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: true,
  bearer_token_present: true,
  bearer_user_resolved: true,
  cookie_user_resolved: false,
  resolved_email: "stranger@example.com",
  admin_allowlist_env_present: true,
  admin_allowlist_entry_count: 2,
  admin_allowlist_env_source: "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
  resolved_email_in_admin_allowlist: false,
})
assert.equal(allowlistPresentNotIncluded.access_decision, "forbidden")
assert.equal(allowlistPresentNotIncluded.resolved_email_in_admin_allowlist, false)
console.log("  ✓ allowlist present but email not included → forbidden")

const emptyAllowlist = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: true,
  bearer_token_present: true,
  bearer_user_resolved: true,
  cookie_user_resolved: false,
  resolved_email: "mike@blitzind.com",
  admin_allowlist_env_present: false,
  admin_allowlist_entry_count: 0,
  admin_allowlist_env_source: null,
  resolved_email_in_admin_allowlist: false,
})
assert.equal(emptyAllowlist.access_decision, "forbidden")
console.log("  ✓ empty allowlist → forbidden even with resolved bearer user")

const bearerNotResolved = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: true,
  bearer_token_present: true,
  bearer_user_resolved: false,
  cookie_user_resolved: false,
  resolved_email: null,
  admin_allowlist_env_present: true,
  admin_allowlist_entry_count: 1,
  admin_allowlist_env_source: "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
  resolved_email_in_admin_allowlist: false,
})
assert.equal(bearerNotResolved.access_decision, "unauthenticated")
console.log("  ✓ bearer present but user not resolved → unauthenticated")

process.env.GROWTH_ENGINE_ACCESS_DIAGNOSTIC_ENABLED = "true"
assert.equal(isGrowthEngineAccessDiagnosticEnabledEnv(), true)
assert.equal(isPlatformAdminEmail("mike@blitzind.com"), true)
assert.equal(isPlatformAdminEmail("stranger@example.com"), false)

const routeSource = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/access-diagnostic/route.ts"),
  "utf8",
)
assert.doesNotMatch(routeSource, /SUPABASE_SERVICE_ROLE_KEY/)
assert.doesNotMatch(routeSource, /getPlatformAdminEmails/)
console.log("  ✓ diagnostic route does not expose allowlist values or secrets")

console.log("\nGrowth Engine Access Diagnostic Certification PASSED")
