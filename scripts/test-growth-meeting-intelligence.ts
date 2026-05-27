/**
 * Regression checks for Growth Engine meeting intelligence (slice 6.23A).
 * Run: pnpm test:growth-meeting-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_MEETING_INTELLIGENCE_QA_MARKER,
  GROWTH_MEETING_INBOX_VIEWS,
  GROWTH_MEETING_PROVIDERS,
  GROWTH_MEETING_SOURCES,
  GROWTH_MEETING_STATUSES,
  type GrowthMeeting,
} from "../lib/growth/meeting-intelligence/meeting-intelligence-types"
import {
  resolveGrowthCalendarSyncReadiness,
} from "../lib/growth/meeting-intelligence/calendar-sync-readiness"
import {
  assembleMeetingPrepBundle,
  buildMeetingPrepOpenRisks,
  buildMeetingPrepObjectives,
  computeMeetingPrepReadiness,
  rankMeetingPrepRisks,
} from "../lib/growth/meeting-intelligence/meeting-prep-bundle"
import { GROWTH_MEETING_PREP_QA_MARKER } from "../lib/growth/meeting-intelligence/meeting-prep-types"
import { GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER } from "../lib/growth/meeting-intelligence/calendar-event-intelligence-types"
import {
  assembleCalendarEventIntelligence,
  buildCalendarFollowUpRisks,
  buildCalendarSuggestedNextAction,
} from "../lib/growth/meeting-intelligence/calendar-event-intelligence"
import { GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"
import type { GrowthLead } from "../lib/growth/types"

assert.equal(GROWTH_MEETING_INTELLIGENCE_QA_MARKER, "meeting-intelligence-v1")
assert.equal(GROWTH_MEETING_STATUSES.length, 5)
assert.equal(GROWTH_MEETING_SOURCES.length, 4)
assert.equal(GROWTH_MEETING_PROVIDERS.length, 5)
assert.ok(GROWTH_MEETING_INBOX_VIEWS.includes("meeting_requests"))

const calendar = resolveGrowthCalendarSyncReadiness()
assert.equal(calendar.ready, false)
assert.match(calendar.setupMessage ?? "", /Connect Google Calendar/)

for (const type of [
  "meeting_requested",
  "meeting_scheduled",
  "meeting_starting_soon",
  "meeting_no_show",
  "post_meeting_followup_due",
  "meeting_outcome_missing",
] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

for (const type of [
  "meeting_created",
  "meeting_scheduled",
  "meeting_completed",
  "meeting_no_show",
  "meeting_canceled",
  "meeting_followup_due",
  "meeting_outcome_recorded",
] as const) {
  assert.ok(GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(type))
}

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270230120000_growth_engine_meeting_intelligence.sql"),
  "utf8",
)
assert.match(migrationSource, /create table if not exists growth\.meetings/)
assert.match(migrationSource, /meeting_outcome_recorded/)
assert.match(migrationSource, /idx_growth_meetings_owner_status_start/)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)

const processReply = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/reply-intelligence/process-reply-intelligence.ts"),
  "utf8",
)
assert.match(processReply, /processReplyMeetingIntelligence/)

const drawerSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-meeting-intelligence.tsx"),
  "utf8",
)
assert.match(drawerSource, /Schedule meeting/)
assert.match(drawerSource, /no automatic stage movement/i)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-intelligence-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /Meeting requests/)
assert.match(uiSource, /GrowthMeetingPrepPanel/)
assert.match(uiSource, /calendar-intelligence/)
assert.match(uiSource, /View prep/)

// --- Sprint 3.1 — Meeting prep polish ---

assert.equal(GROWTH_MEETING_PREP_QA_MARKER, "growth-meeting-prep-v1")

const prepRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/[meetingId]/prep/route.ts"),
  "utf8",
)
assert.match(prepRoute, /requireGrowthEnginePlatformAccess/)
assert.match(prepRoute, /gatherMeetingPrepBundle/)

const prepPanelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-prep-panel.tsx"),
  "utf8",
)
assert.match(prepPanelSource, /data-qa-marker="growth-meeting-prep-v1"/)
assert.match(prepPanelSource, /Meeting ready/)
assert.match(prepPanelSource, /Recommended objectives/)
assert.match(prepPanelSource, /Open risks/)

assert.match(drawerSource, /GrowthMeetingPrepPanel/)

function prepLead(overrides: Partial<GrowthLead> = {}): GrowthLead {
  return {
    id: "lead-1",
    companyName: "Acme HVAC",
    website: "https://acme.example",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US",
    score: 72,
    decisionMakerStatus: "suspected",
    conversationCompetitorPressure: 65,
    conversationCompetitorMentions: [{ name: "ServiceTitan", count: 2 }],
    momentumWhySummary: "Recent reply with pricing interest",
    opportunityBlockers: [],
    intelligenceConflictSeverityScore: 0,
    metadata: {},
    estimatedEmployeeCount: "25",
    estimatedAnnualRevenue: null,
    executiveRecommendation: null,
    nextBestActionReason: null,
    crmDetected: null,
    fieldServiceStackDetected: null,
  } as GrowthLead
}

const sampleMeeting = {
  id: "meeting-1",
  leadId: "lead-1",
  ownerUserId: null,
  opportunityId: null,
  outboundReplyId: null,
  realtimeCallSessionId: null,
  title: "Discovery call",
  status: "scheduled",
  startAt: "2026-05-26T15:00:00.000Z",
  endAt: "2026-05-26T15:30:00.000Z",
  source: "calendar_sync",
  provider: "google_meet",
  calendarEventId: "cal-event-1",
  calendarSyncStatus: null,
  calendarSyncError: null,
  calendarSyncedAt: null,
  calendarLastSyncAt: null,
  attendeeEmails: ["prospect@acme.example"],
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  manualMeetingUrl: null,
  autoCreateMeetingLink: true,
  meetingLocationType: "google_meet",
  meetingLocationLabel: null,
  providerConnectionRequired: false,
  notes: null,
  timezone: "America/Chicago",
  outcome: null,
  nextAction: null,
  noShowReason: null,
  followUpDueAt: null,
  scheduledAt: "2026-05-20T12:00:00.000Z",
  completedAt: null,
  canceledAt: null,
  noShowAt: null,
  outcomeRecordedAt: null,
  createdBy: null,
  createdAt: "2026-05-20T12:00:00.000Z",
  updatedAt: "2026-05-20T12:00:00.000Z",
} as GrowthMeeting

const ranked = rankMeetingPrepRisks([
  { id: "a", label: "Low", priority: "Low", reason: "x", source: "test" },
  { id: "b", label: "Critical", priority: "Critical", reason: "x", source: "test" },
  { id: "c", label: "High", priority: "High", reason: "x", source: "test" },
])
assert.equal(ranked[0]?.priority, "Critical")
assert.equal(ranked[1]?.priority, "High")

const leadScore = { score: 72, label: "Strong", explanation: "Lead engine overlay", source: "lead_engine" as const }
const buyingStage = {
  stage: "active_evaluation",
  confidence: 0.72,
  reason: "Reply intent + research signals",
}

const openRisks = buildMeetingPrepOpenRisks({
  lead: prepLead(),
  buyingStage,
  leadScore,
  decisionMakers: [{ id: "dm-1", name: "Jane Doe", title: "Owner", confidence: 0.8, status: "suspected", isPrimary: true }],
  contactIntelligence: {
    qa_marker: "growth-prospect-search-contact-intelligence-v1",
    schema_ready: true,
    has_contacts: true,
    contacts: [],
    committee_roles: [],
    committee_completeness_pct: 20,
    first_contact: null,
    confidence_explanation: null,
    outreach_recommendation: null,
    source_labels: [],
    empty_reason: null,
  },
  research: {
    researchSummary: "Commercial HVAC operator evaluating dispatch software.",
    suggestedPitchAngle: "Reduce no-shows",
    researchConfidence: 0.75,
    industryGuess: "HVAC",
    detectedTechnologies: [],
    signals: { painSignals: ["missing_online_booking"] },
    recommendedNextAction: "Schedule Demo",
  } as never,
})

assert.ok(openRisks.some((risk) => risk.id === "competitor_risk"))
assert.ok(openRisks.some((risk) => risk.id === "missing_buying_committee"))
assert.equal(openRisks[0]?.priority, "Critical")

const objectives = buildMeetingPrepObjectives({
  lead: prepLead(),
  buyingStage: { stage: "consideration", confidence: 0.72, reason: "Research signals" },
  leadScore,
  contactIntelligence: null,
  research: {
    signals: { painSignals: ["missing_online_booking"] },
  } as never,
  openRisks,
})
assert.ok(objectives.some((item) => item.objective === "Identify incumbent vendor"))
assert.ok(objectives.some((item) => item.objective === "Confirm timeline"))
assert.ok(objectives.some((item) => item.objective === "Validate operational pain"))
assert.ok(objectives.every((item) => item.evidence.length > 0 || item.reasons.length > 0))

const readiness = computeMeetingPrepReadiness({
  lead: prepLead({ decisionMakerStatus: "confirmed" }),
  leadScore,
  buyingStage,
  decisionMakers: [
    { id: "dm-1", name: "Jane Doe", title: "Owner", confidence: 0.9, status: "confirmed", isPrimary: true },
    { id: "dm-2", name: "John Smith", title: "Ops", confidence: 0.7, status: "suspected", isPrimary: false },
  ],
  contactIntelligence: {
    qa_marker: "growth-prospect-search-contact-intelligence-v1",
    schema_ready: true,
    has_contacts: true,
    contacts: [],
    committee_roles: [],
    committee_completeness_pct: 60,
    first_contact: null,
    confidence_explanation: null,
    outreach_recommendation: null,
    source_labels: [],
    empty_reason: null,
  },
  research: { researchSummary: "Ready" } as never,
  openRisks,
})
assert.ok(readiness.score >= 70)
assert.match(readiness.label, /ready|Strong preparation/i)

const bundle = assembleMeetingPrepBundle({
  meeting: sampleMeeting,
  lead: prepLead(),
  leadScore,
  buyingStage,
  decisionMakers: [
    {
      id: "dm-1",
      leadId: "lead-1",
      fullName: "Jane Doe",
      title: "Owner",
      email: null,
      phone: null,
      linkedinUrl: null,
      source: "website",
      sourceDetail: null,
      confidence: 0.9,
      evidenceExcerpt: null,
      status: "confirmed",
      isPrimary: true,
      createdBy: null,
      createdAt: "2026-05-18T12:00:00.000Z",
      updatedAt: "2026-05-18T12:00:00.000Z",
    },
  ],
  contactIntelligence: null,
  research: {
    researchSummary: "Commercial HVAC operator.",
    suggestedPitchAngle: "Dispatch efficiency",
    researchConfidence: 0.8,
    industryGuess: "HVAC",
    detectedTechnologies: ["QuickBooks"],
    signals: { painSignals: ["missing_online_booking"] },
    recommendedNextAction: "Schedule Demo",
  } as never,
})

assert.equal(bundle.qa_marker, GROWTH_MEETING_PREP_QA_MARKER)
assert.equal(bundle.companySnapshot.companyName, "Acme HVAC")
assert.equal(bundle.meeting.calendarEventId, "cal-event-1")
assert.ok(bundle.openRisks.length > 0)
assert.ok(bundle.recommendedObjectives.length > 0)
assert.ok(bundle.readiness.score >= 0 && bundle.readiness.score <= 100)

// --- Sprint 3.2 — Calendar intelligence polish ---

assert.equal(GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER, "growth-calendar-intelligence-v1")

const calendarIntelRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/calendar-intelligence/route.ts"),
  "utf8",
)
assert.match(calendarIntelRoute, /requireGrowthEnginePlatformAccess/)
assert.match(calendarIntelRoute, /gatherCalendarIntelligenceBatch/)

const calendarInlineSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-calendar-intelligence-inline.tsx"),
  "utf8",
)
assert.match(calendarInlineSource, /data-qa-marker="growth-calendar-intelligence-v1"/)
assert.match(calendarInlineSource, /Top objective/)
assert.match(calendarInlineSource, /Top risk/)

const completedMeeting = {
  ...sampleMeeting,
  status: "completed",
  completedAt: "2026-05-25T16:00:00.000Z",
  outcome: null,
  nextAction: null,
  followUpDueAt: null,
} as GrowthMeeting

const followUpRisks = buildCalendarFollowUpRisks({
  meeting: completedMeeting,
  prep: bundle,
  hasFollowUpMeeting: false,
})
assert.ok(followUpRisks.some((risk) => risk.id === "no_follow_up_scheduled"))
assert.ok(followUpRisks.some((risk) => risk.id === "completed_without_next_step"))
assert.ok(followUpRisks.some((risk) => risk.id === "missing_second_meeting"))

const suggestedAction = buildCalendarSuggestedNextAction({
  meeting: completedMeeting,
  prep: bundle,
  followUpRisks,
})
assert.equal(suggestedAction?.action, "Schedule next meeting")
assert.ok((suggestedAction?.evidence.length ?? 0) > 0)

const calendarIntel = assembleCalendarEventIntelligence({
  meeting: sampleMeeting,
  prep: bundle,
  hasFollowUpMeeting: false,
})
assert.equal(calendarIntel.qa_marker, GROWTH_CALENDAR_INTELLIGENCE_QA_MARKER)
assert.equal(calendarIntel.leadScore, 72)
assert.equal(calendarIntel.decisionMakerCount, 1)
assert.ok(calendarIntel.topObjective)
assert.ok(calendarIntel.meetingReadiness >= 0)
assert.equal(calendarIntel.calendarAttached, true)
assert.equal(calendarIntel.prepAvailable, true)

console.log("growth-meeting-intelligence: all checks passed")
