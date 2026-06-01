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

assert.match(platformRoute, /probeVoiceSchemaHealthCached/)

assert.match(schemaHealth, /probeVoiceSchemaHealthCached/)
assert.match(schemaHealth, /probeVoiceSchemaHealthWithBudget/)

assert.match(inboundRoute, /probeVoiceSchemaHealthWithBudget/)
assert.match(inboundRoute, /VoiceRouteTimer/)

assert.match(inboundHandler, /runVoiceBackgroundTask\("inbound_browser_provision"/)
assert.match(inboundHandler, /provisionInboundBrowserWorkspaceOffers/)

console.log("voice-browser-sync-performance checks passed")
