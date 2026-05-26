/**
 * Regression checks for Google Voice Bridge live coaching fix.
 * Run: pnpm test:growth-google-voice-bridge-coaching
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { emptyGrowthLeadRealtimeIntelligenceInput } from "../lib/growth/realtime/realtime-lead-intelligence"
import {
  CALL_WORKSPACE_COACHING_NO_LEAD_COPY,
  CALL_WORKSPACE_TRANSCRIPT_ONLY_COACHING_COPY,
  GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
} from "../lib/growth/native-dialer/call-workspace-coaching-types"
import { isCallWorkspaceTranscriptAnchorLead } from "../lib/growth/native-dialer/call-workspace-coaching-types"

assert.equal(GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER, "google-voice-bridge-coaching-v1")
assert.deepEqual(emptyGrowthLeadRealtimeIntelligenceInput(), {})
assert.equal(isCallWorkspaceTranscriptAnchorLead({ call_workspace_transcript_anchor: true }), true)
assert.equal(isCallWorkspaceTranscriptAnchorLead({}), false)

const coachingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-live-coaching-panel.tsx"),
  "utf8",
)
assert.match(coachingPanel, /CALL_WORKSPACE_COACHING_NO_LEAD_COPY/)
assert.match(coachingPanel, /call-workspace-start-coaching/)
assert.match(coachingPanel, /disabled=\{!canStartCoaching/)
assert.doesNotMatch(coachingPanel, /Link a lead to this call/)
assert.match(coachingPanel, /GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER/)
assert.match(coachingPanel, /data-google-voice-bridge-coaching-qa-marker/)

const workspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspace, /GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER/)
assert.match(workspace, /data-google-voice-bridge-coaching-qa-marker/)
assert.match(workspace, /coachingMode/)
assert.match(workspace, /transcript_only/)
assert.match(coachingPanel, /calls\/sessions\/\$\{nativeSessionId\}\/live-coaching/)

const intelligenceRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(intelligenceRail, /call-workspace-attach-lead/)
assert.match(intelligenceRail, /attach-lead/)
assert.match(intelligenceRail, /Search company, contact, email, phone, domain/)

const repository = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
assert.match(repository, /resolveCallWorkspaceLeadByPhone/)

const coachingRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/calls/sessions/[sessionId]/live-coaching/route.ts",
  ),
  "utf8",
)
assert.match(coachingRoute, /startCallWorkspaceLiveCoaching/)
assert.match(coachingRoute, /GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER/)

const centerPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-center-panel.tsx"),
  "utf8",
)
assert.match(centerPanel, /coachingMode/)
assert.match(centerPanel, /leadLinked/)

console.log("growth-google-voice-bridge-coaching-v1 checks passed")
