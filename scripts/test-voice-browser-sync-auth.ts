/**
 * Browser sync auth regression checks.
 * Run: pnpm test:voice-browser-sync-auth
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { formatBrowserVoiceApiError } from "../lib/voice/browser-calling/format-browser-voice-api-error"

const operatorRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/api/voice-operator-route.ts"),
  "utf8",
)
const browserSyncRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/browser/sync/route.ts"),
  "utf8",
)
const browserHook = fs.readFileSync(
  path.join(process.cwd(), "hooks/voice/use-voice-browser-calling.ts"),
  "utf8",
)
const telemetry = fs.readFileSync(path.join(process.cwd(), "lib/voice/telemetry.ts"), "utf8")

assert.match(operatorRoute, /getBearerAccessToken/)
assert.match(operatorRoute, /isPlatformAdminEmail/)
assert.match(operatorRoute, /operator_platform_admin_granted/)
assert.match(operatorRoute, /no_session_cookie/)
assert.match(operatorRoute, /session_invalid/)
assert.match(operatorRoute, /authStage/)
assert.match(
  operatorRoute,
  /Your sign-in session expired\. Refresh this page to restore browser calling\./,
  "401 must not use generic sign-in copy when session cookie is missing",
)

assert.match(browserSyncRoute, /requireVoiceOperatorRouteContext\(\{[\s\S]*request,/)
assert.match(browserSyncRoute, /voice_browser_sync_auth_success/)
assert.match(browserSyncRoute, /voice_browser_sync_auth_denied/)
assert.match(browserSyncRoute, /voice_browser_sync_success/)
assert.doesNotMatch(browserSyncRoute, /UUID_RE\.test\(rawWorkspaceSessionId\)/)

assert.match(browserHook, /credentials: "include"/)
assert.match(browserHook, /createBrowserSupabaseClient/)
assert.match(browserHook, /Authorization/)
assert.match(browserHook, /formatBrowserVoiceApiError/)

assert.match(telemetry, /voice_browser_sync_auth_denied/)
assert.match(telemetry, /voice_browser_sync_auth_success/)
assert.match(telemetry, /voice_browser_sync_success/)

assert.equal(
  formatBrowserVoiceApiError(
    { error: "unauthorized", message: "Sign in required.", authStage: "no_session_cookie" },
    "fallback",
  ),
  "Your sign-in session expired. Refresh this page to restore browser calling.",
)

assert.equal(
  formatBrowserVoiceApiError(
    { error: "forbidden", message: "ignored", authStage: "not_org_member" },
    "fallback",
  ),
  "Growth Engine voice access requires membership in the configured organization.",
)

assert.equal(
  formatBrowserVoiceApiError({ error: "unauthorized", message: "Sign in required." }, "fallback"),
  "Your sign-in session expired. Refresh this page to restore browser calling.",
)

console.log("voice-browser-sync-auth checks passed")
