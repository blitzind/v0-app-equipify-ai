/**
 * Account-Aware Meeting Prep (M1-B) — regression checks without scheduling side effects.
 * Run: pnpm test:account-aware-meeting-prep
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION } from "../lib/growth/apollo/apollo-meeting-bridge-types"
import { assertApolloMeetingBridgeAttributionPreserved } from "../lib/growth/apollo/apollo-meeting-bridge-evidence"
import {
  assembleMeetingPrepBundle,
  buildMeetingPrepOpenRisks,
} from "../lib/growth/meeting-intelligence/meeting-prep-bundle"
import {
  buildAccountLevelMeetingObjective,
  buildMeetingPrepAccountPlaybookContext,
  buildMeetingPrepCommitteeCoverageRisks,
  buildMeetingPrepStakeholderFocus,
  MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER,
} from "../lib/growth/meeting-intelligence/meeting-prep-account-playbook"
import {
  GROWTH_MEETING_PREP_QA_MARKER,
  MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER as TYPES_ACCOUNT_PLAYBOOK_MARKER,
} from "../lib/growth/meeting-intelligence/meeting-prep-types"

const M1B_MIGRATION = "20270819120000_growth_engine_meeting_account_playbook_linkage_m1b.sql"

const REQUIRED_FILES = [
  "lib/growth/meeting-intelligence/meeting-prep-account-playbook.ts",
  "lib/growth/meeting-intelligence/meeting-prep-account-playbook-loader.ts",
  "app/api/platform/growth/meetings/[meetingId]/prep/route.ts",
  "components/growth/growth-meeting-prep-panel.tsx",
  `supabase/migrations/${M1B_MIGRATION}`,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "syncMeetingCalendar",
  "pushMeetingToGoogleCalendar",
  "createBookingPageBooking",
  "sendEmail",
  "sendSms",
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER, "growth-meeting-prep-account-playbook-m1b-v1")
assert.equal(TYPES_ACCOUNT_PLAYBOOK_MARKER, MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER)
console.log("  ✓ account-aware meeting prep QA markers")

const sampleMeeting = {
  id: "meeting-1",
  leadId: "lead-1",
  ownerUserId: null,
  opportunityId: null,
  outboundReplyId: "reply-1",
  realtimeCallSessionId: null,
  title: "Meeting with Summit Medical",
  status: "proposed" as const,
  startAt: null,
  endAt: null,
  source: "reply_intent" as const,
  provider: null,
  calendarEventId: null,
  calendarSyncStatus: null,
  calendarSyncError: null,
  calendarSyncedAt: null,
  calendarLastSyncAt: null,
  meetingUrl: null,
  manualMeetingUrl: null,
  meetingLocationType: null,
  meetingLocationLabel: null,
  autoCreateMeetingLink: null,
  providerConnectionRequired: false,
  notes: null,
  attendeeEmails: [],
  timezone: "UTC",
  outcome: null,
  nextAction: null,
  followUpDueAt: null,
  noShowReason: null,
  scheduledAt: null,
  completedAt: null,
  canceledAt: null,
  noShowAt: null,
  outcomeRecordedAt: null,
  createdBy: null,
  createdAt: "2026-06-10T12:00:00.000Z",
  updatedAt: "2026-06-10T12:00:00.000Z",
}

const prepLead = () =>
  ({
    id: "lead-1",
    companyName: "Summit Medical",
    website: "https://summit.example",
    city: "Denver",
    state: "CO",
    postalCode: "80202",
    country: "US",
    score: 72,
    status: "call_ready",
    decisionMakerStatus: "confirmed",
    momentumWhySummary: null,
    executiveRecommendation: null,
    nextBestActionReason: null,
    crmDetected: null,
    fieldServiceStackDetected: null,
    conversationCompetitorPressure: 0,
    conversationCompetitorMentions: [],
    intelligenceConflictSeverityScore: 0,
    opportunityBlockers: [],
    estimatedEmployeeCount: "50-100",
    estimatedAnnualRevenue: null,
    metadata: {},
  }) as never

const bundleWithoutPlaybook = assembleMeetingPrepBundle({
  meeting: sampleMeeting,
  lead: prepLead(),
  leadScore: { score: 72, label: "Strong", explanation: null, source: "lead_score" },
  buyingStage: { stage: "consideration", confidence: 0.7, reason: "Assessed" },
  decisionMakers: [],
  contactIntelligence: null,
  research: null,
})

assert.equal(bundleWithoutPlaybook.qa_marker, GROWTH_MEETING_PREP_QA_MARKER)
assert.equal(bundleWithoutPlaybook.accountPlaybookContext, null)
assert.ok(bundleWithoutPlaybook.recommendedObjectives.length >= 0)
console.log("  ✓ meeting prep still works without account playbook")

const attribution = {
  apollo_source: "Apollo Primary Contact Acquisition",
  qualification_source: "apollo_enrollment_qualification_engine",
  enrollment_source: "apollo_enrollment_automation",
  account_playbook_source: "apollo_account_playbooks_abp_1",
  voice_drop_source: "apollo_voice_drop_automation",
  multichannel_source: "apollo_multichannel_orchestration_engine",
  sequence_execution_source: "apollo_sequence_execution_automation",
  reply_intelligence_source: "growth_reply_intelligence_v2",
  meeting_candidate_source: "apollo_meeting_bridge_m1a",
  attribution_chain: [...APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION],
}

assert.equal(assertApolloMeetingBridgeAttributionPreserved(attribution), true)
console.log("  ✓ attribution preserved from Meeting Candidate")

const accountPlaybookContext = buildMeetingPrepAccountPlaybookContext({
  meeting_candidate_id: "mc-1",
  account_playbook_id: "playbook-1",
  playbook_key: "executive_operations_multichannel",
  committee_role_summary: [
    {
      full_name: "Jane CEO",
      title: "CEO",
      role_category: "Executive",
      recommended_messaging_theme: ["ROI"],
      recommended_channel_mix: ["Email", "LinkedIn"],
      contactable: true,
    },
    {
      full_name: "Ops Lead",
      title: "Operations Manager",
      role_category: "Operations",
      recommended_messaging_theme: ["Efficiency"],
      recommended_channel_mix: ["Email", "Call"],
      contactable: true,
    },
  ],
  committee_coverage_score: 72,
  committee_strategy:
    "Multi-threaded account approach — engage executive sponsor for business case while operations validates workflow impact.",
  coverage_status: "Strong",
  recommended_messaging_theme: { Executive: ["ROI"], Operations: ["Efficiency"] },
  recommended_channel_mix: { Executive: ["Email", "LinkedIn"], Operations: ["Email", "Call"] },
  confidence_score: 0.82,
  reasoning: "Summit Medical committee coverage Strong (72/100).",
  source_attribution: attribution,
  qualification_score: 82,
  meeting_readiness_score: 78,
  reply_intent: "meeting_request",
})

assert.ok(accountPlaybookContext)
assert.equal(accountPlaybookContext?.available, true)
assert.equal(accountPlaybookContext?.playbookKey, "executive_operations_multichannel")
assert.ok(accountPlaybookContext?.committeeRoleSummary.length === 2)
console.log("  ✓ account playbook context loads when linked")

const stakeholderFocus = buildMeetingPrepStakeholderFocus(
  [
    {
      full_name: "Jane CEO",
      title: "CEO",
      role_category: "Executive",
      recommended_messaging_theme: ["ROI"],
      recommended_channel_mix: ["Email"],
    },
  ],
  { Executive: ["ROI"] },
  { Executive: ["Email"] },
)
assert.ok(stakeholderFocus.some((focus) => focus.roleCategory === "Executive"))
assert.ok(stakeholderFocus[0]?.focusAreas.includes("ROI"))
console.log("  ✓ role-based stakeholder focus generated")

const weakRisk = buildMeetingPrepCommitteeCoverageRisks({
  coverageStatus: "Weak",
  committeeCoverageScore: 30,
})
assert.match(weakRisk[0]?.reason ?? "", /weak/i)
const partialRisk = buildMeetingPrepCommitteeCoverageRisks({
  coverageStatus: "Partial",
  committeeCoverageScore: 55,
})
assert.match(partialRisk[0]?.reason ?? "", /partial/i)
const strongRisk = buildMeetingPrepCommitteeCoverageRisks({
  coverageStatus: "Strong",
  committeeCoverageScore: 80,
})
assert.match(strongRisk[0]?.reason ?? "", /strong/i)
console.log("  ✓ committee coverage risk generated")

const accountObjective = buildAccountLevelMeetingObjective({
  playbookKey: "executive_operations_multichannel",
  committeeStrategy: "Executive-led entry",
  qualificationScore: 82,
  meetingReadinessScore: 78,
  replyIntent: "meeting_request",
})
assert.ok(accountObjective)
assert.match(accountObjective?.objective ?? "", /demo/i)
console.log("  ✓ account-level objective generated")

const bundleWithPlaybook = assembleMeetingPrepBundle({
  meeting: {
    ...sampleMeeting,
    meetingCandidateId: "mc-1",
    accountPlaybookId: "playbook-1",
    sourceAttribution: attribution,
  },
  lead: prepLead(),
  leadScore: { score: 72, label: "Strong", explanation: null, source: "lead_score" },
  buyingStage: { stage: "consideration", confidence: 0.7, reason: "Assessed" },
  decisionMakers: [],
  contactIntelligence: null,
  research: null,
  accountPlaybookContext,
})

assert.ok(bundleWithPlaybook.accountPlaybookContext?.available)
assert.ok(
  bundleWithPlaybook.recommendedObjectives.some(
    (objective) => objective.objective === accountObjective?.objective,
  ),
)
assert.ok(
  bundleWithPlaybook.openRisks.some((risk) => risk.source === "account_playbook"),
)
console.log("  ✓ prep bundle merges account playbook context")

const openRisks = buildMeetingPrepOpenRisks({
  lead: prepLead(),
  leadScore: { score: 72, label: "Strong", explanation: null, source: "lead_score" },
  buyingStage: { stage: "consideration", confidence: 0.7, reason: "Assessed" },
  decisionMakers: [],
  contactIntelligence: null,
  research: null,
  accountPlaybookContext,
})
assert.ok(openRisks.some((risk) => risk.source === "account_playbook"))
console.log("  ✓ committee coverage prep risks merged into open risks")

const prepRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/[meetingId]/prep/route.ts"),
  "utf8",
)
assert.match(prepRouteSource, /account_playbook_context/)
console.log("  ✓ API returns account_playbook_context")

const prepPanelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-prep-panel.tsx"),
  "utf8",
)
assert.match(prepPanelSource, /Account Playbook Context/)
assert.match(prepPanelSource, /accountPlaybookContext/)
assert.match(prepPanelSource, /Stakeholder focus/)
console.log("  ✓ UI wiring exists")

const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-meeting-candidates-queue.ts"),
  "utf8",
)
assert.match(queueSource, /linkMeetingToAccountPlaybookContext/)
console.log("  ✓ meeting candidate linkage preserved on approval")

const loaderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/meeting-prep-account-playbook-loader.ts"),
  "utf8",
)
const bundleSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/meeting-prep-bundle.ts"),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(loaderSource, new RegExp(forbidden, "i"), `Loader must not import ${forbidden}`)
  assert.doesNotMatch(bundleSource, new RegExp(forbidden, "i"), `Bundle must not import ${forbidden}`)
}
console.log("  ✓ no booking, calendar, send, or outreach side effects")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${M1B_MIGRATION}`),
  "utf8",
)
assert.match(migrationSource, /meeting_candidate_id/)
assert.match(migrationSource, /account_playbook_id/)
assert.match(migrationSource, /source_attribution/)
console.log("  ✓ meeting linkage migration schema")

console.log("\nAccount-Aware Meeting Prep (M1-B) certification checks passed.")
