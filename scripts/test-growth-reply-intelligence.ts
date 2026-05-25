/**
 * Regression checks for Growth Engine reply intelligence (slice 6.22A).
 * Run: pnpm test:growth-reply-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { classifyOutboundReply } from "../lib/growth/outbound/reply-classifier"
import { classifyReplyIntent } from "../lib/growth/reply-intelligence/reply-intent-classifier"
import { resolveReplyNextAction } from "../lib/growth/reply-intelligence/reply-next-action-engine"
import { scoreReplyPriorityFromClassification } from "../lib/growth/reply-intelligence/reply-priority-scorer"
import { computeReplySlaDueAt, isReplyOverdue } from "../lib/growth/reply-intelligence/reply-sla-tracker"
import { computeReplyThreadIntelligence } from "../lib/growth/reply-intelligence/reply-thread-intelligence"
import {
  GROWTH_REPLY_INTELLIGENCE_QA_MARKER,
  GROWTH_REPLY_INTENTS,
} from "../lib/growth/reply-intelligence/reply-intent-types"
import { GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"

assert.equal(GROWTH_REPLY_INTELLIGENCE_QA_MARKER, "reply-intelligence-v1")

const meeting = classifyReplyIntent("Can we schedule a call next Tuesday?")
assert.equal(meeting.intent, "meeting_request")
assert.equal(meeting.classification, "interested")
assert.equal(scoreReplyPriorityFromClassification(meeting, 1), "critical")

const pricing = classifyReplyIntent("What is your pricing for 50 seats?")
assert.equal(pricing.intent, "pricing_question")
assert.ok(pricing.buyingSignals.includes("pricing_asked"))

const competitor = classifyReplyIntent("We already use Salesforce and are comparing vendors.")
assert.equal(competitor.intent, "competitor_mention")
assert.ok(competitor.escalationSignals.includes("competitor_mentioned"))

const legacy = classifyOutboundReply("not interested, please remove me")
assert.equal(legacy.classification, "not_interested")

const nextAction = resolveReplyNextAction({
  intent: "meeting_request",
  priority: "critical",
  hasCallablePhone: false,
  classification: meeting,
})
assert.equal(nextAction, "schedule_meeting")

const thread = computeReplyThreadIntelligence({
  currentReplyReceivedAt: "2026-05-18T14:00:00.000Z",
  priorReplies: [],
  lastOutboundSentAt: "2026-05-18T13:00:00.000Z",
})
assert.equal(thread.threadReplyCount, 1)
assert.equal(thread.responseLatencyMs, 60 * 60 * 1000)
assert.equal(thread.unanswered, true)

const slaDue = computeReplySlaDueAt("2026-05-18T12:00:00.000Z", "high")
assert.ok(new Date(slaDue).getTime() > Date.parse("2026-05-18T12:00:00.000Z"))
assert.equal(isReplyOverdue("2026-05-18T12:00:00.000Z", "critical", Date.parse("2026-05-18T20:00:00.000Z")), true)

for (const type of [
  "reply_waiting",
  "reply_overdue",
  "meeting_request_received",
  "competitor_mentioned",
  "high_priority_reply",
  "owner_response_gap",
] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270229120000_growth_engine_reply_intelligence.sql"),
  "utf8",
)
assert.match(migrationSource, /intent text/)
assert.match(migrationSource, /reply_received/)
assert.match(migrationSource, /idx_growth_outbound_replies_owner_received/)

const inboxRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/replies/inbox/route.ts"),
  "utf8",
)
assert.match(inboxRoute, /requireGrowthEnginePlatformAccess/)

const processEvent = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outbound/process-event.ts"),
  "utf8",
)
assert.match(processEvent, /processReplyIntelligence/)

const inboxRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outbound/reply-repository.ts"),
  "utf8",
)
assert.match(inboxRepo, /listGrowthReplyInbox/)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-reply-inbox-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /Meeting Intent/)
assert.match(uiSource, /No replies match this view/)

console.log("growth-reply-intelligence: all checks passed")
