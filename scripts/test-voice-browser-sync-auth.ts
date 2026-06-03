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
const browserTokenRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/browser/token/route.ts"),
  "utf8",
)
const browserRegisterRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/browser/register/route.ts"),
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
const browserFetchInit = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/build-voice-browser-fetch-init.ts"),
  "utf8",
)
const telemetry = fs.readFileSync(path.join(process.cwd(), "lib/voice/telemetry.ts"), "utf8")

assert.match(operatorRoute, /voice_browser_auth_source/)
assert.match(operatorRoute, /logVoiceBrowserAuthSource/)
assert.match(operatorRoute, /cookie_fallback/)
assert.match(operatorRoute, /bearer_invalid_and_cookie_invalid/)
assert.match(operatorRoute, /createServerSupabaseClient\(\)[\s\S]*auth\.getUser\(\)/)
assert.match(operatorRoute, /if \(cookieUser\?\.id\)/)
assert.doesNotMatch(
  operatorRoute,
  /if \(bearer\)[\s\S]*return[\s\S]*if \(cookieUser/,
  "bearer must not be checked before cookie user resolution",
)

assert.match(operatorRoute, /getBearerAccessToken/)
assert.match(operatorRoute, /createSupabaseClientWithAccessToken/)
assert.match(operatorRoute, /voice_operator_auth_resolution/)
assert.match(operatorRoute, /ignored_stale_bearer_cookie_authoritative/)
assert.match(operatorRoute, /session_invalid/)
assert.match(operatorRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.match(operatorRoute, /browserAuthTelemetry/)

assert.match(browserTokenRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.match(browserRegisterRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.match(browserSyncRoute, /workspaceSessionId/)
assert.match(browserSyncRoute, /requireVoiceBrowserLightweightOperatorContext/)

assert.match(browserHook, /buildVoiceBrowserFetchInit/)
assert.match(browserHook, /logVoiceBrowserClientAuthTelemetry/)
assert.match(browserHook, /voice_browser_sync_auth_result/)
assert.match(browserFetchInit, /resolveVoiceBrowserFetchAuth/)
assert.match(browserFetchInit, /auth\.getUser\(\)/)
assert.match(browserFetchInit, /voice_browser_fetch_auth_resolved/)
assert.match(browserFetchInit, /auth\.accessToken && !headers\.has\("Authorization"\)/)
assert.match(browserFetchInit, /auth = await resolveVoiceBrowserFetchAuth\(\)/)

assert.match(telemetry, /voice_browser_auth_source/)
assert.match(telemetry, /voice_operator_auth_resolution/)
assert.match(telemetry, /voice_browser_sync_auth_denied/)
assert.match(telemetry, /voice_browser_sync_auth_failure/)
assert.match(telemetry, /voice_browser_sync_auth_success/)
assert.match(operatorRoute, /voice_browser_sync_auth_failure/)
assert.match(operatorRoute, /logSessionInvalidAuthFailure/)
assert.match(operatorRoute, /logVoiceBrowserSyncAuthFailure/)

const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8")
assert.match(middlewareSource, /shouldSkipSupabaseSessionRefresh/)
assert.match(middlewareSource, /pathname\.startsWith\("\/api\/voice\/"\)/)
assert.doesNotMatch(
  middlewareSource,
  /pathname\.startsWith\("\/api\/platform\/growth\/voice\/"\)/,
  "operator browser APIs must receive middleware session refresh",
)

const growthCallWorkspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(growthCallWorkspace, /fetch\("\/api\/platform\/growth\/calls\/answer"/)
assert.doesNotMatch(
  growthCallWorkspace,
  /buildVoiceBrowserFetchInit[\s\S]*fetch\("\/api\/platform\/growth\/calls\/answer"/,
  "answer reconcile must not reuse browser fetch init with bearer",
)

const inboundProvisionSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/inbound-workspace-provision.ts"),
  "utf8",
)
assert.doesNotMatch(inboundProvisionSource, /workspace-bridge/)
assert.doesNotMatch(inboundProvisionSource, /resolveInboundBrowserOfferForUser/)
assert.doesNotMatch(inboundProvisionSource, /reconcileStaleRingingOfferCandidates/)

assert.equal(
  formatBrowserVoiceApiError({ error: "membership_lookup_failed", message: "ignored" }, "fallback"),
  "Could not verify organization membership. Wait a moment and try again.",
)

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
