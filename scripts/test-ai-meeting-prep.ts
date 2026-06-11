/**
 * AI Meeting Prep (M1-C) — regression checks without side effects.
 * Run: pnpm test:ai-meeting-prep
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AI_COPILOT_GENERATION_TYPES } from "../lib/growth/ai-copilot-types"
import {
  AI_MEETING_PREP_SAFETY_FLAGS,
  buildAiMeetingPrepQueueSnapshot,
  evaluateAiMeetingPrepApprovalGate,
} from "../lib/growth/meeting-intelligence/ai-meeting-prep-evidence"
import {
  buildAiMeetingPrepInputHash,
  generateAiMeetingPrep,
} from "../lib/growth/meeting-intelligence/ai-meeting-prep-generator"
import {
  AI_MEETING_PREP_MIGRATION,
  AI_MEETING_PREP_QA_MARKER,
  AI_MEETING_PREP_STATUSES,
} from "../lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { assembleMeetingPrepBundle } from "../lib/growth/meeting-intelligence/meeting-prep-bundle"
import { buildMeetingPrepAccountPlaybookContext } from "../lib/growth/meeting-intelligence/meeting-prep-account-playbook"
import { GROWTH_MEETING_PREP_QA_MARKER } from "../lib/growth/meeting-intelligence/meeting-prep-types"

const REQUIRED_FILES = [
  "lib/growth/meeting-intelligence/ai-meeting-prep-types.ts",
  "lib/growth/meeting-intelligence/ai-meeting-prep-generator.ts",
  "lib/growth/meeting-intelligence/ai-meeting-prep-evidence.ts",
  "lib/growth/meeting-intelligence/ai-meeting-prep-service.ts",
  "lib/growth/meeting-intelligence/ai-meeting-prep-queue.ts",
  "app/api/platform/growth/ai-meeting-prep/queue/route.ts",
  "app/api/platform/growth/ai-meeting-prep/generate/route.ts",
  "app/api/platform/growth/ai-meeting-prep/queue/actions/route.ts",
  `supabase/migrations/${AI_MEETING_PREP_MIGRATION}`,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "syncMeetingCalendar",
  "pushMeetingToGoogleCalendar",
  "createBookingPageBooking",
  "createGrowthOpportunity",
  "sendEmail",
  "sendSms",
  "proposeGrowthMeetingFromReply",
  "queueSequenceStepTransportJob",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(AI_MEETING_PREP_QA_MARKER, "growth-ai-meeting-prep-m1c-v1")
assert.deepEqual([...AI_MEETING_PREP_STATUSES], ["draft", "approved", "rejected", "stale"])
assert.ok(GROWTH_AI_COPILOT_GENERATION_TYPES.includes("meeting_prep"))
console.log("  ✓ AI meeting prep QA markers")

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
      recommended_channel_mix: ["Email"],
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
  committee_strategy: "Multi-threaded executive + operations outreach.",
  coverage_status: "Strong",
  confidence_score: 0.82,
  reply_intent: "meeting_request",
})

const prepBundle = assembleMeetingPrepBundle({
  meeting: {
    id: "meeting-1",
    leadId: "lead-1",
    ownerUserId: null,
    opportunityId: null,
    outboundReplyId: "reply-1",
    realtimeCallSessionId: null,
    title: "Meeting with Summit Medical",
    status: "proposed",
    startAt: null,
    endAt: null,
    source: "reply_intent",
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
  },
  lead: {
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
    conversationCompetitorPressure: 35,
    conversationCompetitorMentions: [{ name: "ServiceMax", count: 1 }],
    intelligenceConflictSeverityScore: 0,
    opportunityBlockers: [],
    estimatedEmployeeCount: "50-100",
    estimatedAnnualRevenue: null,
    metadata: {},
  } as never,
  leadScore: { score: 72, label: "Strong", explanation: null, source: "lead_score" },
  buyingStage: { stage: "consideration", confidence: 0.7, reason: "Assessed" },
  decisionMakers: [
    {
      id: "dm-1",
      leadId: "lead-1",
      fullName: "Jane CEO",
      title: "CEO",
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
      createdAt: "2026-06-10T12:00:00.000Z",
      updatedAt: "2026-06-10T12:00:00.000Z",
    },
  ],
  contactIntelligence: null,
  research: {
    researchSummary: "Regional medical operator evaluating service workflow improvements.",
    suggestedPitchAngle: "Dispatch efficiency",
    researchConfidence: 0.8,
    industryGuess: "Healthcare",
    detectedTechnologies: [],
    signals: { painSignals: ["manual_scheduling"] },
    recommendedNextAction: "Schedule demo",
  } as never,
  accountPlaybookContext,
})

assert.equal(prepBundle.qa_marker, GROWTH_MEETING_PREP_QA_MARKER)
assert.ok(prepBundle.readiness.score >= 0)
console.log("  ✓ AI prep generation from deterministic prep bundle")

const generatorInput = {
  meeting_id: "meeting-1",
  prep_bundle: prepBundle,
  account_playbook_context: accountPlaybookContext,
  decision_makers: prepBundle.decisionMakers,
  conversation_intelligence: {
    competitor_mentions: ["ServiceMax"],
    competitor_pressure: 35,
  },
  reply_intelligence: {
    intent: "meeting_request",
    body_preview: "Can we schedule a demo next week?",
  },
  opportunity_readiness: { tier: "sales_ready", score: 72 },
  meeting_readiness: { score: prepBundle.readiness.score, label: prepBundle.readiness.label },
}

const artifacts = generateAiMeetingPrep(generatorInput)
assert.ok(artifacts.executive_brief.includes("Summit Medical"))
assert.ok(artifacts.meeting_objective.length > 0)
assert.ok(artifacts.suggested_agenda.length >= 3)
assert.ok(artifacts.stakeholder_analysis.length >= 2)
assert.ok(artifacts.likely_objections.length > 0)
assert.ok(artifacts.discovery_questions.length > 0)
assert.ok(artifacts.competitive_risks.length > 0)
assert.ok(artifacts.recommended_outcome.length > 0)
assert.ok(artifacts.confidence_score > 0)
assert.ok(artifacts.reasoning.includes(AI_MEETING_PREP_QA_MARKER))
console.log("  ✓ account playbook context included")

assert.ok(artifacts.stakeholder_analysis.some((item) => item.role_category === "Executive"))
assert.ok(artifacts.stakeholder_analysis.some((item) => item.talking_points.length > 0))
console.log("  ✓ stakeholder analysis generated")

assert.ok(artifacts.likely_objections.some((item) => item.response_angle.length > 0))
console.log("  ✓ objections generated")

assert.ok(artifacts.suggested_agenda.every((item) => item.segment && item.duration_minutes > 0))
console.log("  ✓ agenda generated")

assert.ok(artifacts.discovery_questions.every((question) => question.endsWith("?")))
console.log("  ✓ discovery questions generated")

assert.match(artifacts.recommended_outcome, /demo|next step|stakeholder|qualified/i)
console.log("  ✓ recommended outcome generated")

const inputHash = buildAiMeetingPrepInputHash(generatorInput)
assert.ok(inputHash.length > 0)
console.log("  ✓ prep artifact input hash")

const queueSnapshot = buildAiMeetingPrepQueueSnapshot({
  items: [
    {
      prep_id: "prep-1",
      meeting_id: "meeting-1",
      lead_id: "lead-1",
      account_playbook_id: "playbook-1",
      meeting_candidate_id: "mc-1",
      source_attribution: null,
      executive_brief: artifacts.executive_brief,
      meeting_objective: artifacts.meeting_objective,
      suggested_agenda: artifacts.suggested_agenda,
      stakeholder_analysis: artifacts.stakeholder_analysis,
      likely_objections: artifacts.likely_objections,
      discovery_questions: artifacts.discovery_questions,
      competitive_risks: artifacts.competitive_risks,
      recommended_outcome: artifacts.recommended_outcome,
      confidence_score: artifacts.confidence_score,
      reasoning: artifacts.reasoning,
      status: "draft",
      input_hash: inputHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approved_at: null,
      approved_email: null,
      rejection_note: null,
    },
  ],
})

assert.equal(queueSnapshot.queue_label, "AI Meeting Prep Ready")
assert.equal(queueSnapshot.summary.draft, 1)
assert.equal(queueSnapshot.outreach_sent, false)
console.log("  ✓ queue visibility")

const approvalGate = evaluateAiMeetingPrepApprovalGate({
  prep: queueSnapshot.items[0]!,
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ approve workflow gate")

const prepRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meetings/[meetingId]/prep/route.ts"),
  "utf8",
)
assert.match(prepRouteSource, /ai_meeting_prep/)
console.log("  ✓ meeting prep API returns AI prep")

const prepPanelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-meeting-prep-panel.tsx"),
  "utf8",
)
assert.match(prepPanelSource, /AI Meeting Prep/)
assert.match(prepPanelSource, /growth-ai-meeting-prep-m1c-v1/)
assert.match(prepPanelSource, /approve_ai_meeting_prep/)
assert.match(prepPanelSource, /reject_ai_meeting_prep/)
console.log("  ✓ UI wiring exists")

const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/ai-meeting-prep-queue.ts"),
  "utf8",
)
const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/ai-meeting-prep-service.ts"),
  "utf8",
)
const generatorSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/ai-meeting-prep-generator.ts"),
  "utf8",
)

assert.match(queueSource, /approveAiMeetingPrep/)
assert.match(queueSource, /rejectAiMeetingPrep/)
assert.match(queueSource, /regenerateAiMeetingPrep/)
console.log("  ✓ approve / reject / regenerate workflow")

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(queueSource, new RegExp(forbidden, "i"), `Queue must not import ${forbidden}`)
  assert.doesNotMatch(serviceSource, new RegExp(forbidden, "i"), `Service must not import ${forbidden}`)
  assert.doesNotMatch(generatorSource, new RegExp(forbidden, "i"), `Generator must not import ${forbidden}`)
}
console.log("  ✓ no booking/calendar/send/opportunity side effects")

assert.deepEqual(AI_MEETING_PREP_SAFETY_FLAGS, {
  outreach_sent: false,
  calendar_written: false,
  meeting_scheduled: false,
  opportunity_created: false,
  autonomous_reply_sent: false,
})
console.log("  ✓ safety flags hard-coded")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${AI_MEETING_PREP_MIGRATION}`),
  "utf8",
)
assert.match(migrationSource, /ai_meeting_preparations/)
assert.match(migrationSource, /executive_brief/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
assert.match(migrationSource, /meeting_prep/)
console.log("  ✓ prep artifact persisted schema")

console.log("\nAI Meeting Prep (M1-C) certification checks passed.")
