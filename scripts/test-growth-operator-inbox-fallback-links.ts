/**
 * Growth operator inbox fallback link routing audit (Phase 7M — local only).
 *
 * Usage: pnpm test:growth-operator-inbox-fallback-links
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_OPERATOR_INBOX_FALLBACK_LINKS_QA_MARKER,
  growthOperatorInboxFallbackHref,
} from "../lib/growth/navigation/growth-operator-inbox-fallback-links"
import {
  normalizeAttentionNotification,
  normalizeRecommendedAction,
} from "../lib/growth/operator-inbox/operator-inbox-aggregator"
import type { GrowthNotification } from "../lib/growth/notifications/notification-types"
import { GROWTH_NOTIFICATIONS_QA_MARKER } from "../lib/growth/notifications/notification-types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function mockNotification(overrides: Partial<GrowthNotification>): GrowthNotification {
  return {
    id: "notification-1",
    orgId: null,
    ownerUserId: null,
    leadId: "lead-1",
    opportunityId: null,
    notificationType: "reply_waiting",
    severity: "high",
    title: "Test notification",
    body: "Test body",
    metadata: {},
    createdAt: new Date().toISOString(),
    acknowledgedAt: null,
    completedAt: null,
    expiresAt: null,
    sourceSystem: "intelligence",
    sourceId: "source-1",
    deterministicHash: "hash-1",
    priorityScore: 70,
    actionUrl: null,
    collapseCount: 1,
    ...overrides,
  }
}

function runAudit(): void {
  console.log(`\n=== Growth operator inbox fallback audit (${GROWTH_OPERATOR_INBOX_FALLBACK_LINKS_QA_MARKER}) ===\n`)

  const storedUrl = "/growth/calls/workspace?leadId=stored-lead"
  const withStored = normalizeAttentionNotification(
    mockNotification({ actionUrl: storedUrl, notificationType: "callback_due" }),
  )
  assert.equal(withStored.cta_href, storedUrl)
  console.log("  ✓ stored actionUrl still wins")

  const replyItem = normalizeAttentionNotification(
    mockNotification({ notificationType: "reply_waiting", leadId: "lead-reply" }),
  )
  assert.match(replyItem.cta_href ?? "", /^\/growth\/inbox\?/)
  assert.match(replyItem.cta_href ?? "", /view=needs_action/)
  console.log("  ✓ reply-like notifications fall back to workspace inbox")

  const followUpHref = growthOperatorInboxFallbackHref({
    notificationType: "manual_call_due",
    leadId: "lead-call",
  })
  assert.match(followUpHref, /view=call_follow_up/)
  const followUpItem = normalizeAttentionNotification(
    mockNotification({ notificationType: "manual_call_due", leadId: "lead-call" }),
  )
  assert.match(followUpItem.cta_href ?? "", /view=call_follow_up/)
  console.log("  ✓ call follow-up notifications fall back to inbox call follow-up queue")

  const callbackHref = growthOperatorInboxFallbackHref({
    notificationType: "callback_due",
    leadId: "lead-callback",
  })
  assert.match(callbackHref, /view=callback_requested/)
  console.log("  ✓ callback notifications fall back to inbox callback queue")

  const voicemailHref = growthOperatorInboxFallbackHref({
    notificationType: "manual_call_due",
    leadId: "lead-vm",
    channel: "voicemail",
  })
  assert.match(voicemailHref, /view=voicemail/)
  console.log("  ✓ voicemail channel falls back to inbox voicemail queue")

  const coachingHref = growthOperatorInboxFallbackHref({
    notificationType: "call_score_low",
    leadId: "lead-coach",
    callSessionId: "session-1",
  })
  assert.equal(coachingHref, "/growth/calls/coaching?leadId=lead-coach&callSessionId=session-1")
  const coachingItem = normalizeAttentionNotification(
    mockNotification({
      notificationType: "call_score_low",
      leadId: "lead-coach",
      metadata: { sessionId: "session-1" },
    }),
  )
  assert.match(coachingItem.cta_href ?? "", /^\/growth\/calls\/coaching/)
  console.log("  ✓ coaching notifications fall back to calls coaching workspace")

  const adminFallback = growthOperatorInboxFallbackHref({ notificationType: "sequence_failed" })
  assert.equal(adminFallback, "/growth/campaigns/sequences")
  const providerFallback = growthOperatorInboxFallbackHref({ notificationType: "provider_degraded" })
  assert.equal(providerFallback, "/growth/settings/communications/mailboxes")
  console.log("  ✓ admin control-plane fallbacks remain admin")

  const unknownFallback = growthOperatorInboxFallbackHref({ leadId: "lead-unknown" })
  assert.equal(unknownFallback, "/growth/inbox?leadId=lead-unknown")
  const bareFallback = growthOperatorInboxFallbackHref()
  assert.equal(bareFallback, "/growth/inbox")
  console.log("  ✓ unknown notification types fall back to workspace inbox")

  const recommended = normalizeRecommendedAction(
    {
      title: "Recommended action",
      recommendation: "Follow up",
      whyThisExists: "Signal detected",
      recommendedNextStep: "Call lead",
      evidence: ["Evidence"],
      confidence: "High",
      sourceId: "rec-1",
    },
    "lead-rec",
  )
  assert.equal(recommended.cta_href, "/growth/inbox?leadId=lead-rec")
  console.log("  ✓ recommended actions use workspace inbox fallback")

  const aggregator = readSource("lib/growth/operator-inbox/operator-inbox-aggregator.ts")
  assert.match(aggregator, /notification\.actionUrl \?\?/)
  assert.match(aggregator, /growthOperatorInboxFallbackHref/)
  assert.doesNotMatch(aggregator, /\/admin\/growth\/command\?leadId=/)
  assert.doesNotMatch(aggregator, /\/growth\/replies/)
  console.log("  ✓ operator inbox aggregator uses workspace fallback helper")

  assert.equal(GROWTH_NOTIFICATIONS_QA_MARKER, "growth-notifications-v1")
  console.log("  ✓ notification types module unchanged")

  console.log("\nGrowth operator inbox fallback audit passed.\n")
}

runAudit()
