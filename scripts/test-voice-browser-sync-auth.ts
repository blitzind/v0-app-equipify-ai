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

assert.match(operatorRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.match(operatorRoute, /lightweight_route/)

assert.match(browserTokenRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.match(browserTokenRoute, /voice_browser_token_auth_success/)
assert.match(browserTokenRoute, /voice_browser_token_auth_denied/)
assert.doesNotMatch(browserTokenRoute, /workspace-bridge/)
assert.doesNotMatch(browserTokenRoute, /resolveInboundBrowserOfferForUser/)
assert.doesNotMatch(browserTokenRoute, /reconcileStaleRingingOfferCandidates/)
assert.doesNotMatch(browserTokenRoute, /buildVoiceBrowserSyncSnapshot/)
assert.doesNotMatch(browserTokenRoute, /probeVoiceSchemaHealth/)

assert.match(browserRegisterRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.doesNotMatch(browserRegisterRoute, /workspace-bridge/)
assert.doesNotMatch(browserRegisterRoute, /resolveInboundBrowserOfferForUser/)

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
assert.match(telemetry, /voice_browser_token_auth_denied/)
assert.match(telemetry, /voice_browser_token_auth_success/)
assert.match(telemetry, /voice_inbound_routing_timeout/)
assert.match(telemetry, /voice_inbound_webhook_failed/)

const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8")
assert.match(middlewareSource, /pathname\.startsWith\("\/api\/voice\/"\)/)

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
