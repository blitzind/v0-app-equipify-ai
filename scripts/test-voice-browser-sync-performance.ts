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
assert.match(workspaceBridge, /const includeEnrichment = syncMode === "enrichment"/)
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

assert.match(platformRoute, /probeVoiceSchemaHealthCached/)
assert.match(operatorRoute, /createServerSupabaseClient/)
assert.match(operatorRoute, /createServiceRoleSupabaseClient/)
assert.match(operatorRoute, /\.from\("organization_members"\)[\s\S]*\.eq\("status", "active"\)/)
assert.match(operatorRoute, /options\.requireSessionOwner && session\.owner_user_id !== user\.id/)
assert.match(browserSyncRoute, /requireVoiceOperatorRouteContext/)
assert.doesNotMatch(browserSyncRoute, /requireVoicePlatformRouteContext/)
assert.match(browserSyncRoute, /sessionId: workspaceSessionId/)
assert.match(browserSyncRoute, /requireSessionOwner: Boolean\(workspaceSessionId\)/)
assert.match(browserSyncRoute, /probeVoiceSchemaHealthCached/)

assert.match(schemaHealth, /probeVoiceSchemaHealthCached/)
assert.match(schemaHealth, /probeVoiceSchemaHealthWithBudget/)

assert.match(inboundRoute, /probeVoiceSchemaHealthWithBudget/)
assert.match(inboundRoute, /VoiceRouteTimer/)

assert.match(inboundHandler, /runVoiceBackgroundTask\("inbound_browser_provision"/)
assert.match(inboundHandler, /provisionInboundBrowserWorkspaceOffers/)

const browserRepository = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/voice-browser-calling-repository.ts"),
  "utf8",
)
assert.match(browserRepository, /VOICE_BROWSER_DEVICE_SELECT/)
assert.match(browserRepository, /VOICE_OPERATOR_PRESENCE_SELECT/)
assert.doesNotMatch(browserRepository, /\.select\("\*"\)/)

const relationshipRepository = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/voice-relationship-memory-repository.ts"),
  "utf8",
)
assert.match(relationshipRepository, /RELATIONSHIP_MEMORY_PROFILE_SELECT/)
assert.match(relationshipRepository, /RELATIONSHIP_MEMORY_EVENT_SELECT/)

console.log("voice-browser-sync-performance checks passed")
