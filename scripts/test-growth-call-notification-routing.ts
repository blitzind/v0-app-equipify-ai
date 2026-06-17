/**
 * Growth call notification workspace link routing audit (Phase 7L — local only).
 *
 * Usage: pnpm test:growth-call-notification-routing
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cadenceCallQueueHref } from "../lib/growth/cadence/cadence-channel-engine"
import { GROWTH_INBOX_CALL_NOTIFICATION_ROUTING_AUDIT } from "../lib/growth/inbox/inbox-call-communication-inventory"
import {
  GROWTH_CALL_NOTIFICATION_LINKS_QA_MARKER,
  growthCallNotificationActionHref,
  growthWorkspaceCallWorkspaceHref,
  growthWorkspaceCallsCoachingHref,
  growthWorkspaceInboxCallViewHref,
  growthWorkspaceLeadQueueHref,
} from "../lib/growth/navigation/growth-call-notification-links"
import { nativeCallWorkspaceHref } from "../lib/growth/native-dialer/native-dialer-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth call notification routing audit (${GROWTH_CALL_NOTIFICATION_LINKS_QA_MARKER}) ===\n`)

  const manualCallHref = growthCallNotificationActionHref({
    notificationType: "manual_call_due",
    leadId: "lead-1",
  })
  assert.match(manualCallHref, /^\/growth\/inbox\?/)
  assert.match(manualCallHref, /view=call_follow_up/)
  assert.match(manualCallHref, /leadId=lead-1/)
  console.log("  ✓ manual_call_due routes to inbox call follow-up")

  const followUpHref = growthCallNotificationActionHref({
    notificationType: "call_followup_due",
    leadId: "lead-2",
  })
  assert.match(followUpHref, /view=call_follow_up/)
  console.log("  ✓ call_followup_due routes to inbox call follow-up")

  const callbackHref = growthCallNotificationActionHref({
    notificationType: "callback_due",
    leadId: "lead-3",
    queueItemId: "queue-1",
    phone: "+15551234567",
  })
  assert.match(callbackHref, /^\/growth\/calls\/workspace\?/)
  assert.match(callbackHref, /dialMode=callback/)
  assert.match(callbackHref, /queueItemId=queue-1/)
  console.log("  ✓ callback_due routes to calls workspace callback dial mode")

  const missedCallbackHref = growthCallNotificationActionHref({
    notificationType: "missed_callback",
    leadId: "lead-4",
    queueItemId: "queue-2",
  })
  assert.match(missedCallbackHref, /dialMode=missed_callback/)
  console.log("  ✓ missed_callback routes to calls workspace missed callback dial mode")

  const voicemailHref = growthCallNotificationActionHref({
    notificationType: "voicemail",
    leadId: "lead-5",
    channel: "voicemail",
  })
  assert.match(voicemailHref, /view=voicemail/)
  console.log("  ✓ voicemail routes to inbox voicemail queue")

  const coachingHref = growthWorkspaceCallsCoachingHref({
    leadId: "lead-6",
    callSessionId: "session-1",
  })
  assert.equal(coachingHref, "/growth/calls/coaching?leadId=lead-6&callSessionId=session-1")
  console.log("  ✓ coaching routes to calls coaching workspace")

  assert.equal(nativeCallWorkspaceHref({ leadId: "lead-7" }), "/growth/calls/workspace?leadId=lead-7")
  assert.equal(cadenceCallQueueHref("lead-8"), "/growth/leads/queue?highlight=lead-8")
  assert.equal(growthWorkspaceLeadQueueHref("lead-9"), "/growth/leads/queue?highlight=lead-9")
  assert.match(growthWorkspaceInboxCallViewHref("callback_requested", { leadId: "lead-10" }), /view=callback_requested/)
  console.log("  ✓ shared call workspace and queue href helpers resolve workspace paths")

  const callIntelligence = readSource("lib/growth/call-intelligence/call-intelligence-notifications.ts")
  assert.match(callIntelligence, /growthWorkspaceCallsCoachingHref/)
  assert.match(callIntelligence, /growthCallNotificationActionHref/)
  assert.doesNotMatch(callIntelligence, /commandLeadFocusHref/)
  console.log("  ✓ call intelligence notifications use workspace coaching and follow-up links")

  const nativeDialer = readSource("lib/growth/native-dialer/native-dialer-notifications.ts")
  assert.match(nativeDialer, /growthCallNotificationActionHref/)
  assert.doesNotMatch(nativeDialer, /\/admin\/growth\/calls\/workspace/)
  console.log("  ✓ native dialer notifications use workspace call action links")

  const cadenceNotifications = readSource("lib/growth/cadence/cadence-notifications.ts")
  assert.match(cadenceNotifications, /growthCallNotificationActionHref/)
  assert.doesNotMatch(cadenceNotifications, /cadenceCallQueueHref/)
  console.log("  ✓ cadence notifications use workspace call notification hrefs")

  const executionPriority = readSource("lib/growth/execution/execution-priority-engine.ts")
  assert.match(executionPriority, /growthWorkspaceCallsCoachingHref/)
  assert.doesNotMatch(executionPriority, /commandLeadFocusHref\(ctx\.id, "call-copilot"\)/)
  console.log("  ✓ execution priority coaching CTAs use workspace coaching")

  const notificationIntegrations = readSource("lib/growth/notifications/notification-integrations.ts")
  assert.match(notificationIntegrations, /growthWorkspaceCallsCoachingHref/)
  assert.doesNotMatch(notificationIntegrations, /commandLeadFocusHref\(input\.leadId, "calls"\)/)
  console.log("  ✓ live call coaching integrations use workspace coaching")

  const commandDashboard = readSource("lib/growth/command/command-dashboard-repository.ts")
  assert.match(commandDashboard, /commandLeadFocusHref/)
  console.log("  ✓ admin command dashboard coaching links preserved")

  const callEmitterPaths = [
    "lib/growth/call-intelligence/call-intelligence-notifications.ts",
    "lib/growth/native-dialer/native-dialer-notifications.ts",
    "lib/growth/cadence/cadence-notifications.ts",
    "lib/growth/navigation/growth-call-notification-links.ts",
  ]
  for (const relativePath of callEmitterPaths) {
    assert.doesNotMatch(readSource(relativePath), /\/growth\/replies/)
  }
  console.log("  ✓ no /growth/replies route introduced in call notification emitters")

  for (const row of GROWTH_INBOX_CALL_NOTIFICATION_ROUTING_AUDIT) {
    assert.equal(row.status, "workspace-aligned", `${row.notificationType} should be workspace-aligned`)
  }
  console.log("  ✓ inbox call notification routing inventory marked workspace-aligned")

  console.log("\nGrowth call notification routing audit passed.\n")
}

runAudit()
