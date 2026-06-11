/**
 * Opportunity Draft Engine (M1-D) — regression checks without side effects.
 * Run: pnpm test:opportunity-draft-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertOpportunityDraftAttributionPreserved,
  buildOpportunityDraftAttributionRecord,
  buildOpportunityDraftQueueSnapshot,
  evaluateOpportunityDraftApprovalGate,
  evaluateOpportunityDraftDuplicateBlock,
  OPPORTUNITY_DRAFT_SAFETY_FLAGS,
} from "../lib/growth/meeting-intelligence/opportunity-draft-evidence"
import {
  buildOpportunityDraftInputHash,
  generateOpportunityDraftFromMeeting,
} from "../lib/growth/meeting-intelligence/opportunity-draft-generator"
import {
  OPPORTUNITY_DRAFT_ENGINE_MIGRATION,
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
  OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION,
  OPPORTUNITY_DRAFT_STATUSES,
} from "../lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { computeOpportunityDraftReadinessScore } from "../lib/growth/meeting-intelligence/opportunity-draft-readiness-scoring"
import { buildMeetingPrepAccountPlaybookContext } from "../lib/growth/meeting-intelligence/meeting-prep-account-playbook"

const REQUIRED_FILES = [
  "lib/growth/meeting-intelligence/opportunity-draft-engine-types.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-readiness-scoring.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-generator.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-evidence.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-service.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-queue.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-funnel-metrics.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-certification.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-route-gates.ts",
  "lib/growth/meeting-intelligence/opportunity-draft-route.ts",
  "app/api/platform/growth/opportunity-drafts/funnel-metrics/route.ts",
  "app/api/platform/growth/opportunity-drafts/queue/route.ts",
  "app/api/platform/growth/opportunity-drafts/queue/actions/route.ts",
  "app/api/platform/growth/opportunity-drafts/readiness/route.ts",
  "app/api/platform/growth/opportunity-drafts/execute/route.ts",
  `supabase/migrations/${OPPORTUNITY_DRAFT_ENGINE_MIGRATION}`,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "createGrowthOpportunity",
  "syncMeetingCalendar",
  "pushMeetingToGoogleCalendar",
  "createBookingPageBooking",
  "sendEmail",
  "sendSms",
  "queueSequenceStepTransportJob",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(OPPORTUNITY_DRAFT_ENGINE_QA_MARKER, "growth-opportunity-draft-engine-m1d-v1")
assert.deepEqual([...OPPORTUNITY_DRAFT_STATUSES], ["draft", "approved", "rejected", "stale", "converted"])
console.log("  ✓ opportunity draft QA markers")

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

const generatorInput = {
  meeting: {
    id: "meeting-1",
    leadId: "lead-1",
    ownerUserId: null,
    opportunityId: null,
    outboundReplyId: "reply-1",
    realtimeCallSessionId: null,
    title: "Meeting with Summit Medical",
    status: "completed" as const,
    startAt: "2026-06-10T14:00:00.000Z",
    endAt: "2026-06-10T14:30:00.000Z",
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
    notes: "Strong interest in dispatch automation; budget discussion next quarter.",
    attendeeEmails: [],
    timezone: "UTC",
    outcome: "positive",
    nextAction: "Send proposal draft",
    followUpDueAt: null,
    noShowReason: null,
    scheduledAt: "2026-06-10T13:00:00.000Z",
    completedAt: "2026-06-10T14:30:00.000Z",
    canceledAt: null,
    noShowAt: null,
    outcomeRecordedAt: "2026-06-10T14:35:00.000Z",
    createdBy: null,
    createdAt: "2026-06-10T12:00:00.000Z",
    updatedAt: "2026-06-10T14:35:00.000Z",
  },
  meeting_outcome_intelligence: {
    id: "score-1",
    leadId: "lead-1",
    meetingId: "meeting-1",
    opportunityId: null,
    ownerUserId: null,
    meetingOutcomeScore: 78,
    meetingQualityScore: 82,
    nextStepConfidence: 74,
    followUpRecommendation: "send_proposal_recommendation" as const,
    followUpRecommendationLabel: "Send proposal recommendation",
    buyingSignalCount: 3,
    objectionCount: 1,
    championDetected: true,
    decisionMakerPresent: true,
    timelineDetected: true,
    budgetSignal: true,
    urgencySignal: false,
    noShowRiskPattern: false,
    momentumTrend: "accelerating" as const,
    momentumTrendLabel: "Accelerating",
    recommendedNextStep: "Prepare proposal for operator review.",
    safeSummary: "Positive meeting with budget and timeline signals.",
    computedAt: "2026-06-10T14:35:00.000Z",
  },
  meeting_notes: "Strong interest in dispatch automation.",
  meeting_readiness: { score: 74, label: "Ready" },
  account_playbook_context: accountPlaybookContext,
  qualification: { score: 72, tier: "sales_ready" },
  conversation_intelligence: {
    competitor_mentions: ["ServiceMax"],
    competitor_pressure: 35,
    momentum_summary: "Reply momentum positive ahead of meeting.",
  },
  reply_intelligence: {
    intent: "meeting_request",
    body_preview: "Can we schedule a demo next week?",
  },
  decision_makers: [
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
}

const readiness = computeOpportunityDraftReadinessScore(generatorInput)
assert.ok(readiness.opportunity_readiness_score >= 0 && readiness.opportunity_readiness_score <= 100)
assert.ok(["Weak", "Developing", "Qualified", "Opportunity Ready"].includes(readiness.readiness_status))
console.log("  ✓ readiness scoring")

const artifacts = generateOpportunityDraftFromMeeting(generatorInput)
assert.ok(artifacts.opportunity_summary.includes("Summit Medical"))
assert.ok(artifacts.key_stakeholders.length > 0)
assert.ok(artifacts.buying_signals.length > 0)
assert.ok(artifacts.recommended_stage === "proposal" || artifacts.recommended_stage === "qualified")
assert.ok(artifacts.estimated_value > 0)
assert.ok(artifacts.confidence_score > 0)
assert.ok(artifacts.next_steps.length > 0)
assert.ok(artifacts.reasoning.includes(OPPORTUNITY_DRAFT_ENGINE_QA_MARKER))
console.log("  ✓ draft generation")

assert.ok(artifacts.key_stakeholders.some((item) => item.name.includes("Jane")))
console.log("  ✓ stakeholder extraction")

assert.ok(artifacts.buying_signals.some((signal) => /buying signal|timeline|budget|momentum/i.test(signal)))
console.log("  ✓ buying signal extraction")

assert.ok(artifacts.recommended_stage)
console.log("  ✓ stage recommendation")

const inputHash = buildOpportunityDraftInputHash(generatorInput)
assert.ok(inputHash.length > 0)
console.log("  ✓ draft input hash")

const attributionRecord = buildOpportunityDraftAttributionRecord({
  attribution_chain: [...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION],
})
assert.equal(assertOpportunityDraftAttributionPreserved(attributionRecord), true)
assert.deepEqual(attributionRecord.attribution_chain, OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION)
console.log("  ✓ attribution preservation")

const queueSnapshot = buildOpportunityDraftQueueSnapshot({
  items: [
    {
      draft_id: "draft-1",
      meeting_id: "meeting-1",
      lead_id: "lead-1",
      company_id: null,
      account_playbook_id: "playbook-1",
      company_name: "Summit Medical",
      ...artifacts,
      opportunity_readiness_score: readiness.opportunity_readiness_score,
      opportunity_readiness_status: readiness.readiness_status,
      source_attribution: attributionRecord,
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

assert.equal(queueSnapshot.queue_label, "Opportunity Drafts Ready")
assert.equal(queueSnapshot.summary.draft, 1)
assert.equal(queueSnapshot.opportunity_created, false)
console.log("  ✓ queue visibility")

const approvalGate = evaluateOpportunityDraftApprovalGate({ draft: queueSnapshot.items[0]! })
assert.equal(approvalGate.allowed, true)
const duplicateBlock = evaluateOpportunityDraftDuplicateBlock({ existing_status: "draft" })
assert.equal(duplicateBlock.blocked, true)
console.log("  ✓ approve / reject / regenerate workflow gates")

const mutateMeetingSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/mutate-meeting.ts"),
  "utf8",
)
assert.match(mutateMeetingSource, /maybeGenerateOpportunityDraftForMeeting/)
console.log("  ✓ meeting outcome integration hook")

const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-draft-queue.ts"),
  "utf8",
)
const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-draft-service.ts"),
  "utf8",
)
const generatorSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-draft-generator.ts"),
  "utf8",
)

assert.match(queueSource, /approveOpportunityDraft/)
assert.match(queueSource, /rejectOpportunityDraft/)
assert.match(queueSource, /regenerateOpportunityDraft/)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(queueSource, new RegExp(forbidden, "i"), `Queue must not import ${forbidden}`)
  assert.doesNotMatch(serviceSource, new RegExp(forbidden, "i"), `Service must not import ${forbidden}`)
  assert.doesNotMatch(generatorSource, new RegExp(forbidden, "i"), `Generator must not import ${forbidden}`)
}
console.log("  ✓ no CRM writes / no opportunity creation side effects")

assert.deepEqual(OPPORTUNITY_DRAFT_SAFETY_FLAGS, {
  opportunity_created: false,
  crm_written: false,
  deal_created: false,
  calendar_written: false,
})
console.log("  ✓ safety flags hard-coded")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${OPPORTUNITY_DRAFT_ENGINE_MIGRATION}`),
  "utf8",
)
assert.match(migrationSource, /opportunity_drafts/)
assert.match(migrationSource, /opportunity_summary/)
assert.match(migrationSource, /opportunity_created boolean not null default false/)
assert.match(migrationSource, /crm_written boolean not null default false/)
console.log("  ✓ draft artifact persisted schema")

const routeGatesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/opportunity-draft-route-gates.ts"),
  "utf8",
)
assert.match(routeGatesSource, /GROWTH_OPPORTUNITY_DRAFT_ENGINE_ENABLED/)
assert.match(routeGatesSource, /RUN_OPPORTUNITY_DRAFT_ENGINE_CERTIFICATION/)
console.log("  ✓ production certification route gates")

console.log("\nOpportunity Draft Engine (M1-D) certification checks passed.")
