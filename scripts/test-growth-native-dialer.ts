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
import { GROWTH_NATIVE_DIALER_QA_MARKER, GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER } from "../lib/growth/native-dialer/native-dialer-types"

assert.equal(GROWTH_NATIVE_DIALER_QA_MARKER, "native-dialer-v1")
assert.equal(GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER, "native-dialer-layout-v2")

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

const workspaceComponent = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspaceComponent, /GrowthNativeDialer/)
assert.match(workspaceComponent, /GrowthPostCallWrapup/)
assert.match(workspaceComponent, /GrowthIncomingCallPanel/)
assert.match(workspaceComponent, /GROWTH_NATIVE_DIALER_LAYOUT_QA_MARKER/)
assert.match(workspaceComponent, /max-w-\[1600px\]/)
assert.match(workspaceComponent, /lg:grid-cols-\[340px_minmax\(0,1fr\)_320px\]/)
assert.match(workspaceComponent, /Ready to connect/)
assert.match(workspaceComponent, /Prospect Intelligence/)

const dialerComponent = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-native-dialer.tsx"),
  "utf8",
)
assert.match(dialerComponent, /h-16 w-full rounded-xl text-2xl/)
assert.match(dialerComponent, /font-mono text-3xl tracking-wide/)

const queueComponent = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-power-dial-queue.tsx"),
  "utf8",
)
assert.match(queueComponent, /max-h-\[260px\].*overflow-auto/s)

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

console.log("growth-native-dialer-v1 checks passed")
