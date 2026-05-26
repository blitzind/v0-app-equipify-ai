/**
 * Regression checks for Growth Native Dialer + Unified Call Workspace slice 6.34A.
 * Run: pnpm test:growth-native-dialer
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildSuggestedWrapupNextActions,
  normalizeWrapupFlags,
} from "../lib/growth/native-dialer/native-dialer-wrapup-engine"
import { nativeCallWorkspaceHref } from "../lib/growth/native-dialer/native-dialer-navigation"
import { createNativeDialerProviderInstance } from "../lib/growth/native-dialer/native-dialer-provider-registry"
import { GROWTH_NATIVE_DIALER_QA_MARKER, GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER, GROWTH_NATIVE_DIALER_CALL_START_FIX_QA_MARKER, GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER, GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER, NATIVE_DIALER_PROVIDER_IDS } from "../lib/growth/native-dialer/native-dialer-types"
import { GOOGLE_VOICE_BRIDGE_CALLS_URL, isGoogleVoiceBridgeProvider } from "../lib/growth/native-dialer/native-dialer-bridge"

assert.equal(GROWTH_NATIVE_DIALER_QA_MARKER, "native-dialer-v1")
assert.equal(GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER, "native-dialer-layout-v3")
assert.equal(GROWTH_NATIVE_DIALER_CALL_START_FIX_QA_MARKER, "native-dialer-call-start-fix-v1")
assert.equal(GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER, "native-dialer-live-coaching-center-v1")
assert.equal(GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER, "google-voice-bridge-v1")
assert.ok(NATIVE_DIALER_PROVIDER_IDS.includes("google_voice_bridge"))
assert.equal(createNativeDialerProviderInstance("google_voice_bridge").providerId, "google_voice_bridge")
assert.equal(isGoogleVoiceBridgeProvider("google_voice_bridge"), true)
assert.equal(GOOGLE_VOICE_BRIDGE_CALLS_URL, "https://voice.google.com/u/0/calls")

assert.match(
  nativeCallWorkspaceHref({ leadId: "00000000-0000-4000-8000-000000000001", phone: "+15551234567" }),
  /\/admin\/growth\/calls\/workspace\?leadId=.*&phone=/,
)

assert.equal(createNativeDialerProviderInstance("retell").providerId, "retell")
assert.equal(createNativeDialerProviderInstance("twilio").providerId, "twilio")
assert.equal(createNativeDialerProviderInstance("stub").providerId, "stub")

const wrapupActions = buildSuggestedWrapupNextActions({
  outcome: "meeting_booked",
  meetingBooked: true,
  connected: true,
})
assert.ok(wrapupActions.some((action) => action.includes("meeting")))

const flags = normalizeWrapupFlags({ outcome: "no_answer", noAnswer: true })
assert.equal(flags.noAnswer, true)
assert.equal(flags.connected, false)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270315120000_growth_engine_native_dialer.sql"),
  "utf8",
)
assert.match(migration, /native_call_workspace_sessions/)
assert.match(migration, /native_dialer_queue_items/)
assert.match(migration, /native_call_wrapups/)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /fetchGrowthNativeCallWorkspaceDashboard/)
assert.match(dashboardRoute, /GROWTH_NATIVE_DIALER_QA_MARKER/)

const startRoute = fs.readFileSync(path.join(process.cwd(), "app/api/platform/growth/calls/start/route.ts"), "utf8")
assert.match(startRoute, /startGrowthNativeCall/)

const wrapupRoute = fs.readFileSync(path.join(process.cwd(), "app/api/platform/growth/calls/wrapup/route.ts"), "utf8")
assert.match(wrapupRoute, /submitGrowthNativeCallWrapup/)

const workspacePage = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/calls/workspace/page.tsx"),
  "utf8",
)
assert.match(workspacePage, /GrowthCallWorkspace/)
assert.match(workspacePage, /max-w-\[1700px\]/)
assert.match(workspacePage, /GROWTH_NATIVE_DIALER_QA_MARKER/)
assert.match(workspacePage, /operator controlled/)

const workspaceComponent = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceComponent, /GrowthCallWorkspaceCenterPanel/)
assert.match(workspaceComponent, /GrowthCallWorkspaceDialerCard/)
assert.match(workspaceComponent, /GrowthCallWorkspaceIntelligenceRail/)
assert.match(workspaceComponent, /GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER/)
assert.match(workspaceComponent, /GROWTH_NATIVE_DIALER_CALL_START_FIX_QA_MARKER/)
assert.match(workspaceComponent, /normalizeDialPhoneForApi/)
assert.match(workspaceComponent, /onStartCall/)
assert.match(workspaceComponent, /\/api\/platform\/growth\/calls\/start/)
assert.match(workspaceComponent, /setActiveSession/)
assert.match(workspaceComponent, /lg:grid-cols-\[320px_minmax\(0,1fr\)_320px\]/)

const centerPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-center-panel.tsx"),
  "utf8",
)
assert.match(centerPanel, /Ready to call/)
assert.match(centerPanel, /GrowthCallWorkspaceLiveCoachingPanel/)
assert.match(centerPanel, /GROWTH_CALL_WORKSPACE_GLASS_DOCK/)

const liveCoachingPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-live-coaching-panel.tsx"),
  "utf8",
)
assert.match(liveCoachingPanel, /GROWTH_NATIVE_DIALER_LIVE_COACHING_CENTER_QA_MARKER/)
assert.match(liveCoachingPanel, /Live Coaching Ready/)
assert.match(liveCoachingPanel, /Start Coaching/)
assert.match(liveCoachingPanel, /No guidance yet/)

const dialerComponent = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-native-dialer.tsx"),
  "utf8",
)
assert.match(dialerComponent, /onStartCall/)
assert.match(dialerComponent, /data-qa-action="native-dialer-start-call"/)
assert.match(dialerComponent, /hasDialablePhone/)
assert.match(dialerComponent, /disabled=\{disabled \|\| !canDial \|\| loading\}/)
assert.match(dialerComponent, /h-14 w-full/)
assert.match(dialerComponent, /font-mono text-3xl/)
assert.match(dialerComponent, /bg-gradient-to-r from-emerald-600/)

const dialerCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-dialer-card.tsx"),
  "utf8",
)
assert.match(dialerCard, /onStartCall/)

const queueCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-queue-card.tsx"),
  "utf8",
)
assert.match(queueCard, /max-h-\[280px\].*overflow-auto/s)
assert.match(queueCard, /View all/)
assert.match(queueCard, /Power Dial/)

const intelligenceRail = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-intelligence-rail.tsx"),
  "utf8",
)
assert.match(intelligenceRail, /Prospect Intelligence/)
assert.match(intelligenceRail, /max-w-\[320px\]/)

const sidebar = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-section-sidebar-nav.tsx"), "utf8")
assert.match(sidebar, /\/admin\/growth\/calls\/workspace/)
assert.match(sidebar, /Call Workspace/)

const callActionSheet = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-action-sheet.tsx"),
  "utf8",
)
assert.match(callActionSheet, /Open in Call Workspace/)

const commandCenter = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-command-center.tsx"),
  "utf8",
)
assert.match(commandCenter, /GrowthNativeDialerLaunchButton/)

const notificationTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/notifications/notification-types.ts"),
  "utf8",
)
assert.match(notificationTypes, /callback_due/)
assert.match(notificationTypes, /priority_call_ready/)
assert.match(notificationTypes, /missed_callback/)
assert.match(notificationTypes, /meeting_booked_from_call/)

const bridgeMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270315130000_growth_engine_native_dialer_google_voice_bridge.sql"),
  "utf8",
)
assert.match(bridgeMigration, /google_voice_bridge/)
assert.match(bridgeMigration, /external_bridge_pending/)

const bridgeStartedRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/bridge-started/route.ts"),
  "utf8",
)
assert.match(bridgeStartedRoute, /markGrowthNativeCallBridgeStarted/)
assert.match(bridgeStartedRoute, /GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER/)

const settingsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/calls/settings/route.ts"),
  "utf8",
)
assert.match(settingsRoute, /NATIVE_DIALER_PROVIDER_IDS/)
assert.match(settingsRoute, /fetchGrowthNativeDialerSettings/)

const bridgePanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-google-voice-bridge-panel.tsx"),
  "utf8",
)
assert.match(bridgePanel, /External Bridge Mode/)
assert.match(bridgePanel, /Open Google Voice/)
assert.match(bridgePanel, /Copy Phone Number/)
assert.match(bridgePanel, /Mark Call Started/)
assert.match(bridgePanel, /Start Live Coaching/)
assert.match(bridgePanel, /End \/ Wrap Up/)

assert.match(centerPanel, /bridge_pending/)
assert.match(centerPanel, /GrowthCallWorkspaceGoogleVoiceBridgePanel/)
assert.match(centerPanel, /externalBridge/)
assert.match(centerPanel, /!externalBridge/)

assert.match(workspaceComponent, /external_bridge_pending/)
assert.match(workspaceComponent, /bridge-started/)
assert.match(workspaceComponent, /openGoogleVoiceBridgeTab/)
assert.match(workspaceComponent, /GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER/)

const nativeDialerSettings = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-native-dialer-settings-panel.tsx"),
  "utf8",
)
assert.match(nativeDialerSettings, /Google Voice Bridge/)

const growthSettingsPage = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/settings/page.tsx"),
  "utf8",
)
assert.match(growthSettingsPage, /GrowthNativeDialerSettingsPanel/)

const repository = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/native-dialer/native-dialer-repository.ts"),
  "utf8",
)
assert.match(repository, /external_bridge_pending/)
assert.match(repository, /markNativeCallBridgeStarted/)

console.log("growth-native-dialer-v1 checks passed")
