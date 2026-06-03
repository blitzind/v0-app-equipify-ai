/**
 * Voice browser sync + inbound webhook performance guardrails.
 * Run: pnpm test:voice-browser-sync-performance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const workspaceBridge = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"),
  "utf8",
)
const platformRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/api/voice-platform-route.ts"),
  "utf8",
)
const operatorRoute = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/api/voice-operator-route.ts"),
  "utf8",
)
const browserSyncRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/browser/sync/route.ts"),
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
const inboundRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/inbound/twilio/route.ts"),
  "utf8",
)
const inboundHandler = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/call-control/inbound-handler.ts"),
  "utf8",
)
const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")

assert.match(workspaceBridge, /emptyVoiceBrowserSyncSnapshot/)
assert.match(workspaceBridge, /mode: "idle"/)
assert.match(workspaceBridge, /mode: "ringing"/)
assert.match(workspaceBridge, /VoiceRouteTimer/)
assert.match(workspaceBridge, /isLiveBrowserWorkspaceSession/)
assert.match(workspaceBridge, /type VoiceBrowserSyncMode = "fast" \| "enrichment"/)
assert.match(workspaceBridge, /buildVoiceBrowserEnrichmentSnapshot/)
assert.match(workspaceBridge, /RELATIONSHIP_MEMORY_SYNC_CACHE_TTL_MS = 30_000/)
assert.match(workspaceBridge, /relationshipMemorySyncCache/)
assert.match(workspaceBridge, /queryCount/)
assert.match(workspaceBridge, /rowsReturned/)
assert.match(workspaceBridge, /relationshipMemoryCache/)
assert.doesNotMatch(workspaceBridge, /\.select\("\*"\)/)

const voiceBrowserHook = fs.readFileSync(
  path.join(process.cwd(), "hooks/voice/use-voice-browser-calling.ts"),
  "utf8",
)
assert.match(voiceBrowserHook, /VOICE_BROWSER_ENRICHMENT_SYNC_INTERVAL_MS = 12_000/)
assert.match(voiceBrowserHook, /params\.set\("mode", mode\)/)
assert.match(voiceBrowserHook, /syncRef\.current\("fast"\)/)
assert.match(voiceBrowserHook, /syncRef\.current\("enrichment"\)/)
assert.match(voiceBrowserHook, /mergeVoiceBrowserSyncSnapshot/)
assert.match(voiceBrowserHook, /enrichmentWarning/)
assert.match(voiceBrowserHook, /CALL_WORKSPACE_ENRICHMENT_SYNC_FAILED_COPY/)
assert.match(voiceBrowserHook, /next\.diagnostics\?\.enrichmentTimedOut/)

assert.match(platformRoute, /probeVoiceSchemaHealthCached/)
assert.match(operatorRoute, /createServerSupabaseClient/)
assert.match(operatorRoute, /createServiceRoleSupabaseClient/)
assert.match(operatorRoute, /\.from\("organization_members"\)[\s\S]*\.eq\("status", "active"\)/)
assert.match(operatorRoute, /options\.requireSessionOwner && session\.owner_user_id !== auth\.userId/)
assert.match(browserSyncRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.doesNotMatch(browserSyncRoute, /requireVoiceOperatorRouteContext/)
assert.doesNotMatch(browserSyncRoute, /requireSessionOwner: Boolean\(workspaceSessionId\)/)
assert.doesNotMatch(browserSyncRoute, /sessionId: workspaceSessionId/)
assert.match(browserSyncRoute, /buildVoiceBrowserSyncSnapshot\(ctx\.admin/)
assert.match(browserSyncRoute, /probeVoiceSchemaHealthCached/)
assert.match(browserSyncRoute, /voice_browser_sync_auth_success/)
assert.doesNotMatch(browserSyncRoute, /UUID_RE\.test\(rawWorkspaceSessionId\)/)

assert.match(browserTokenRoute, /requireVoiceBrowserLightweightOperatorContext/)
assert.doesNotMatch(browserTokenRoute, /requireVoiceOperatorRouteContext/)
assert.match(browserRegisterRoute, /requireVoiceBrowserLightweightOperatorContext/)

assert.match(workspaceBridge, /voice_browser_sync_session_pin_rejected/)
assert.match(workspaceBridge, /pinned_session_lookup_error/)
assert.match(workspaceBridge, /sessionPinRejected/)

assert.match(voiceBrowserHook, /RECOVERABLE_BROWSER_SYNC_SESSION_ERRORS/)
assert.match(voiceBrowserHook, /recoverableSessionError/)

assert.match(schemaHealth, /probeVoiceSchemaHealthCached/)
assert.match(schemaHealth, /probeVoiceSchemaHealthWithBudget/)

assert.match(inboundRoute, /probeVoiceSchemaHealthWithBudget/)
assert.match(inboundRoute, /VoiceRouteTimer/)

assert.match(inboundHandler, /runVoiceBackgroundTask\("inbound_browser_provision"/)
assert.match(inboundHandler, /inbound-workspace-provision/)
assert.doesNotMatch(inboundHandler, /from "@\/lib\/voice\/browser-calling\/workspace-bridge"/)
assert.match(inboundHandler, /voice_inbound_routing_timeout/)
assert.match(inboundHandler, /INBOUND_ROUTING_BUNDLE_TIMEOUT_MS = 5_000/)
assert.match(inboundHandler, /InboundRoutingBundleTimer/)
assert.match(inboundHandler, /bundleTimer\.finish\("routing_timeout"/)
assert.match(inboundHandler, /bundleSteps: bundleTimer\.snapshot\(\)/)
assert.match(inboundHandler, /selectRoundRobinMemberForwardNumber/)
assert.match(inboundHandler, /runVoiceBackgroundTask\("inbound_round_robin_cursor"/)
assert.match(inboundHandler, /fetchVoiceVoicemailBoxById/)
assert.doesNotMatch(inboundHandler, /pickRoundRobinMemberForwardNumber/)
assert.doesNotMatch(inboundHandler, /fetchVoiceVoicemailBoxes/)

const inboundBrowserRouting = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/inbound-browser-routing.ts"),
  "utf8",
)
assert.match(inboundBrowserRouting, /voice-browser-devices-repository/)
assert.doesNotMatch(inboundBrowserRouting, /await import\("@\/lib\/voice\/repository\/voice-browser-calling-repository"\)/)

const inboundRoutingBundleTiming = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/call-control/inbound-routing-bundle-timing.ts"),
  "utf8",
)
assert.match(inboundRoutingBundleTiming, /voice_inbound_routing_bundle_step/)
assert.match(inboundRoutingBundleTiming, /voice_inbound_routing_bundle_timing/)

const browserRepository = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/voice-browser-calling-repository.ts"),
  "utf8",
)
assert.match(browserRepository, /resolveInboundBrowserOfferForUser/)
assert.match(browserRepository, /VOICE_BROWSER_DEVICE_SELECT/)
assert.match(browserRepository, /VOICE_OPERATOR_PRESENCE_SELECT/)
assert.doesNotMatch(browserRepository, /\.select\("\*"\)/)

assert.match(workspaceBridge, /resolveInboundBrowserOfferForUser/)
assert.match(workspaceBridge, /reconcileBrowserSyncInboundSelection/)
assert.match(workspaceBridge, /voice_browser_sync_call_selected/)
assert.match(workspaceBridge, /voice_browser_sync_timing/)
assert.match(workspaceBridge, /scheduleStaleRingingCleanupIfNeeded/)
assert.match(workspaceBridge, /runVoiceBackgroundTask\("browser_sync_stale_ringing_cleanup"/)
assert.doesNotMatch(workspaceBridge, /void reconcileStaleRingingOfferCandidates/)
assert.match(workspaceBridge, /buildVoiceBrowserEnrichmentSnapshot/)
assert.match(workspaceBridge, /runVoiceBackgroundTask\("browser_sync_session_sync"/)
assert.match(workspaceBridge, /BrowserSyncEnrichmentTimer/)
assert.match(workspaceBridge, /voice_browser_sync_enrichment_timeout/)
assert.match(workspaceBridge, /ENRICHMENT_SYNC_BUDGET_MS = 8_000/)

const growthCallWorkspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(growthCallWorkspace, /wasSdkAnswerAlreadyAccepted/)
assert.match(growthCallWorkspace, /CALL_WORKSPACE_ANSWER_RECONCILE_FAILED_COPY/)
assert.match(growthCallWorkspace, /enrichmentWarning/)
assert.match(growthCallWorkspace, /resolveWorkspaceSessionPinForBrowserSync/)
assert.match(growthCallWorkspace, /reason: "sync_idle"/)

const browserSyncEnrichmentTiming = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/browser-sync-enrichment-timing.ts"),
  "utf8",
)
assert.match(browserSyncEnrichmentTiming, /voice_browser_sync_enrichment_timing/)

const middleware = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8")
assert.match(middleware, /shouldSkipSupabaseSessionRefresh/)
assert.doesNotMatch(
  middleware,
  /pathname\.startsWith\("\/api\/platform\/growth\/voice\/"\)/,
  "browser sync must not bypass middleware session refresh",
)

const relationshipRepository = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/voice-relationship-memory-repository.ts"),
  "utf8",
)
assert.match(relationshipRepository, /RELATIONSHIP_MEMORY_PROFILE_SELECT/)
assert.match(relationshipRepository, /RELATIONSHIP_MEMORY_EVENT_SELECT/)

console.log("voice-browser-sync-performance checks passed")
