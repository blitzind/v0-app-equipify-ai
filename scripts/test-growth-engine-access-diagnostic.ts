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
import {
  classifyGrowthEngineBearerAuthError,
  getGrowthEngineBearerTokenMetadata,
  sanitizeGrowthEngineAuthErrorMessage,
} from "../lib/growth/growth-engine-platform-user-resolution"
import { isPlatformAdminEmail, getPlatformAdminAllowlistMeta } from "../lib/platform-admin-policy"

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
assert.match(accessSource, /createSupabaseClientWithAccessToken/)
console.log("  ✓ shared bearer/cookie resolution exported from access.ts")

const tokenMeta = getGrowthEngineBearerTokenMetadata("eyJheader.payload.signature")
assert.equal(tokenMeta.bearer_token_length, 27)
assert.equal(tokenMeta.bearer_token_segment_count, 3)
assert.deepEqual(getGrowthEngineBearerTokenMetadata(null), {
  bearer_token_length: 0,
  bearer_token_segment_count: 0,
})
console.log("  ✓ bearer token metadata reports length and segment count")

assert.equal(
  sanitizeGrowthEngineAuthErrorMessage("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bad"),
  "supabase_auth_error",
)
assert.equal(sanitizeGrowthEngineAuthErrorMessage("Invalid JWT"), "Invalid JWT")
const classified = classifyGrowthEngineBearerAuthError({ code: "invalid_jwt", message: "JWT expired" })
assert.equal(classified.code, "invalid_jwt")
assert.equal(classified.message_safe, "JWT expired")
console.log("  ✓ auth error messages are sanitized for diagnostics")

process.env.EQUIPIFY_PLATFORM_ADMIN_EMAILS = "mike@blitzind.com,ops@equipify.ai"
const allowlistMeta = getPlatformAdminAllowlistMeta()
assert.equal(allowlistMeta.admin_allowlist_env_present, true)
assert.equal(allowlistMeta.admin_allowlist_entry_count, 2)

const bearerDefaults = {
  bearer_resolution_attempted: false,
  bearer_resolution_error_code: null,
  bearer_resolution_error_message_safe: null,
  bearer_token_length: 0,
  bearer_token_segment_count: 0,
}

const bearerOnly = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: true,
  bearer_token_present: true,
  ...bearerDefaults,
  bearer_resolution_attempted: true,
  bearer_token_length: 795,
  bearer_token_segment_count: 3,
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
  ...bearerDefaults,
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
  ...bearerDefaults,
  bearer_resolution_attempted: true,
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
  ...bearerDefaults,
  bearer_resolution_attempted: true,
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
  bearer_resolution_attempted: true,
  bearer_resolution_error_code: "invalid_jwt",
  bearer_resolution_error_message_safe: "JWT expired",
  bearer_token_length: 795,
  bearer_token_segment_count: 3,
  bearer_user_resolved: false,
  cookie_user_resolved: false,
  resolved_email: null,
  admin_allowlist_env_present: true,
  admin_allowlist_entry_count: 1,
  admin_allowlist_env_source: "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
  resolved_email_in_admin_allowlist: false,
})
assert.equal(bearerNotResolved.access_decision, "unauthenticated")
assert.equal(bearerNotResolved.bearer_resolution_error_code, "invalid_jwt")
console.log("  ✓ expired/invalid bearer fails safely → unauthenticated")

const malformedBearerHeader = buildGrowthEngineAccessDiagnostic({
  growth_engine_enabled: true,
  diagnostic_enabled: true,
  request_has_authorization_header: true,
  bearer_token_present: false,
  ...bearerDefaults,
  bearer_user_resolved: false,
  cookie_user_resolved: false,
  resolved_email: null,
  admin_allowlist_env_present: true,
  admin_allowlist_entry_count: 1,
  admin_allowlist_env_source: "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
  resolved_email_in_admin_allowlist: false,
})
assert.equal(malformedBearerHeader.access_decision, "unauthenticated")
console.log("  ✓ malformed Bearer header fails safely → unauthenticated")

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
