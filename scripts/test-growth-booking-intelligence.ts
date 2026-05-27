/**
 * Regression checks for Calendar Booking Intelligence (Phase 2O).
 * Run: pnpm test:growth-booking-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { suggestAvailabilityFoundation, formatAvailabilityHint } from "../lib/growth/booking-intelligence/availability-suggestion"
import {
  detectBookingIntentFromInbox,
  detectBookingIntentFromOpportunitySignals,
  detectBookingIntentFromReplyDraftOutcome,
  hasMinimumBookingEvidence,
} from "../lib/growth/booking-intelligence/booking-intent-detector"
import { generateBookingRecommendations } from "../lib/growth/booking-intelligence/booking-recommendation"
import { resolveRoutingRuleType, selectCalendarRoutingRule } from "../lib/growth/booking-intelligence/calendar-routing"
import {
  detectSequenceMeetingExitCandidates,
  hasMeetingIntentForSequenceBadge,
} from "../lib/growth/booking-intelligence/sequence-meeting-exit"
import {
  GROWTH_BOOKING_INTENT_TYPES,
  GROWTH_BOOKING_RECOMMENDATION_STATUSES,
  GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER,
  GROWTH_CALENDAR_ROUTING_RULE_TYPES,
  sanitizeBookingEvidenceSnippet,
} from "../lib/growth/booking-intelligence/booking-types"
import { GROWTH_CALENDAR_BOOKING_INTELLIGENCE_SCHEMA_MIGRATION } from "../lib/growth/booking-intelligence/schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER, "growth-calendar-booking-intelligence-v1")
  assert.match(GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE, /Human approval required/i)
  assert.match(GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE, /no autonomous/i)
  assert.equal(GROWTH_BOOKING_INTENT_TYPES.length, 7)
  assert.equal(GROWTH_BOOKING_RECOMMENDATION_STATUSES.length, 5)
  assert.equal(GROWTH_CALENDAR_ROUTING_RULE_TYPES.length, 6)

  const migration = readSource(`supabase/migrations/${GROWTH_CALENDAR_BOOKING_INTELLIGENCE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.booking_recommendations/)
  assert.match(migration, /growth\.booking_intent_signals/)
  assert.match(migration, /growth\.calendar_routing_rules/)
  assert.match(migration, /growth\.booking_attribution_events/)
  assert.match(migration, /growth\.meeting_conversion_events/)
  assert.match(migration, /requires_human_approval/)
  assert.match(migration, /service role only/i)

  const meetingIntents = detectBookingIntentFromInbox({
    subject: "Re: Demo next week",
    body: "Can we schedule a call to walk through pricing with our CEO?",
    classification: "meeting_intent",
  })
  assert.ok(meetingIntents.some((intent) => intent.intentType === "meeting_request"))
  assert.ok(meetingIntents.some((intent) => intent.intentType === "demo_request"))
  assert.ok(meetingIntents.some((intent) => intent.intentType === "decision_maker_call"))
  assert.ok(hasMinimumBookingEvidence(meetingIntents))

  const opportunityIntents = detectBookingIntentFromOpportunitySignals([
    { signalType: "meeting_interest", evidenceSnippet: "Let's meet next Tuesday to review the proposal." },
    { signalType: "pricing_interest", evidenceSnippet: "Need pricing details before our budget meeting." },
  ])
  assert.ok(opportunityIntents.some((intent) => intent.intentType === "meeting_request"))
  assert.ok(opportunityIntents.some((intent) => intent.intentType === "pricing_call"))

  const draftIntents = detectBookingIntentFromReplyDraftOutcome({
    classification: "meeting_intent",
    body: "Happy to book a follow-up call this week.",
    draftStatus: "sent",
  })
  assert.ok(draftIntents.length > 0)
  assert.equal(detectBookingIntentFromReplyDraftOutcome({ draftStatus: "discarded" }).length, 0)

  const recommendations = generateBookingRecommendations({
    intents: meetingIntents,
    hasActiveSequence: true,
    engagementScore: 70,
  })
  assert.ok(recommendations.every((entry) => entry.evidence.length > 0))
  assert.ok(recommendations.some((entry) => entry.recommendationType === "book_meeting"))
  assert.ok(recommendations.some((entry) => entry.recommendationType === "sequence_meeting_exit_review"))
  assert.equal(generateBookingRecommendations({ intents: [] }).length, 0)

  const rules = [
    {
      id: "rule-1",
      ruleType: "owner" as const,
      label: "Lead owner",
      priority: 10,
      isActive: true,
      matchCriteria: { scope: "lead_owner" },
      targetOwnerLabel: "Lead owner",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule-2",
      ruleType: "manual" as const,
      label: "Manual",
      priority: 999,
      isActive: true,
      matchCriteria: { scope: "manual" },
      targetOwnerLabel: "Manual review",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  const selected = selectCalendarRoutingRule(rules, { hasLeadOwner: true, hasThreadOwner: false })
  assert.equal(selected?.ruleType, "owner")
  assert.equal(resolveRoutingRuleType(rules, { hasLeadOwner: false, hasThreadOwner: false }), "manual")

  const availability = suggestAvailabilityFoundation()
  assert.match(formatAvailabilityHint(availability), /No live calendar write/i)

  const exitCandidates = detectSequenceMeetingExitCandidates({
    intents: meetingIntents,
    hasActiveSequence: true,
  })
  assert.ok(exitCandidates.length > 0)
  assert.ok(hasMeetingIntentForSequenceBadge(meetingIntents))

  assert.equal(sanitizeBookingEvidenceSnippet("  meet\x00ing  "), "meet ing")

  const eventsSource = readSource("lib/growth/booking-intelligence/booking-events.ts")
  assert.match(eventsSource, /approveBookingRecommendation/)
  assert.match(eventsSource, /dismissBookingRecommendation/)
  assert.match(eventsSource, /completeBookingRecommendation/)
  assert.match(eventsSource, /no_autonomous_booking/)
  assert.match(eventsSource, /no_autonomous_calendar_write/)
  assert.match(eventsSource, /approval_records_intent_only/)
  assert.match(eventsSource, /manually_booked_or_deferred/)
  assert.doesNotMatch(eventsSource, /syncGrowthMeetingToGoogleCalendar|createGrowthMeeting|submitPublicBooking/i)

  const attributionSource = readSource("lib/growth/booking-intelligence/booking-attribution.ts")
  assert.match(attributionSource, /recordBookingAttributionEvent/)

  const threadSource = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(threadSource, /ingestBookingIntelligenceFromInbox/)

  const replyDraftSource = readSource("lib/growth/replies/reply-draft-repository.ts")
  assert.match(replyDraftSource, /ingestBookingIntelligenceFromReplyDraft/)

  for (const route of [
    "app/api/platform/growth/booking-intelligence/dashboard/route.ts",
    "app/api/platform/growth/booking-intelligence/recommendations/route.ts",
    "app/api/platform/growth/booking-intelligence/recommendations/[id]/approve/route.ts",
    "app/api/platform/growth/booking-intelligence/recommendations/[id]/dismiss/route.ts",
    "app/api/platform/growth/booking-intelligence/recommendations/[id]/complete/route.ts",
    "app/api/platform/growth/booking-intelligence/routing-rules/route.ts",
  ]) {
    const source = readSource(route)
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.match(source, /isGrowthCalendarBookingIntelligenceSchemaReady/)
    assert.doesNotMatch(source, /api_key|secret|password|calendar_token/i)
  }

  const approveSource = readSource("app/api/platform/growth/booking-intelligence/recommendations/[id]/approve/route.ts")
  assert.match(approveSource, /humanApprovalConfirmed/)
  assert.match(approveSource, /no autonomous calendar write/)

  const completeSource = readSource("app/api/platform/growth/booking-intelligence/recommendations/[id]/complete/route.ts")
  assert.match(completeSource, /completeBookingRecommendation/)
  assert.match(completeSource, /humanApprovalConfirmed/)

  const uiSource = readSource("components/growth/growth-booking-intelligence-dashboard.tsx")
  assert.match(uiSource, /GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER/)
  assert.match(uiSource, /Meeting Intent/)
  assert.match(uiSource, /Pending Booking Reviews/)
  assert.match(uiSource, /Approved Booking Actions/)
  assert.match(uiSource, /Completed Meetings/)
  assert.match(uiSource, /Sequence Stop Candidates/)
  assert.match(uiSource, /Conversion Attribution/)

  const inboxUiSource = readSource("components/growth/growth-inbox-booking-recommendation-panel.tsx")
  assert.match(inboxUiSource, /Meeting Booking Recommendation/)

  const leadPanelSource = readSource("components/growth/growth-lead-booking-intelligence-panel.tsx")
  assert.match(leadPanelSource, /Booking Intelligence/)

  const sequenceUiSource = readSource("components/growth/growth-sequence-safe-execution-dashboard.tsx")
  assert.match(sequenceUiSource, /meeting intent reviews/)
  assert.match(sequenceUiSource, /sequence stop candidates/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /\/admin\/growth\/booking-intelligence/)

  console.log("growth-calendar-booking-intelligence-v1: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
