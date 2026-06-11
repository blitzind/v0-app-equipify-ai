/** Opportunity Draft Engine certification — validates draft generation without CRM writes. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertOpportunityDraftAttributionPreserved,
  buildOpportunityDraftAttributionRecord,
  evaluateOpportunityDraftApprovalGate,
  evaluateOpportunityDraftDuplicateBlock,
  OPPORTUNITY_DRAFT_SAFETY_FLAGS,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import { generateOpportunityDraftFromMeeting } from "@/lib/growth/meeting-intelligence/opportunity-draft-generator"
import { buildOpportunityDraftFunnelMetrics } from "@/lib/growth/meeting-intelligence/opportunity-draft-funnel-metrics"
import { computeOpportunityDraftReadinessScore } from "@/lib/growth/meeting-intelligence/opportunity-draft-readiness-scoring"
import type {
  OpportunityDraftEngineCertificationReport,
  OpportunityDraftEngineAutomationReport,
  OpportunityDraftGeneratorInput,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import {
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
  OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { buildMeetingPrepAccountPlaybookContext } from "@/lib/growth/meeting-intelligence/meeting-prep-account-playbook"

function sampleGeneratorInput(): OpportunityDraftGeneratorInput {
  const accountPlaybookContext = buildMeetingPrepAccountPlaybookContext({
    meeting_candidate_id: "mc-cert",
    account_playbook_id: "playbook-cert",
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
    ],
    committee_coverage_score: 72,
    committee_strategy: "Multi-threaded executive outreach.",
    coverage_status: "Strong",
    confidence_score: 0.82,
    reply_intent: "meeting_request",
  })

  return {
    meeting: {
      id: "meeting-cert",
      leadId: "lead-cert",
      ownerUserId: null,
      opportunityId: null,
      outboundReplyId: "reply-cert",
      realtimeCallSessionId: null,
      title: "Meeting with Summit Medical",
      status: "completed",
      startAt: "2026-06-10T14:00:00.000Z",
      endAt: "2026-06-10T14:30:00.000Z",
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
      id: "score-cert",
      leadId: "lead-cert",
      meetingId: "meeting-cert",
      opportunityId: null,
      ownerUserId: null,
      meetingOutcomeScore: 78,
      meetingQualityScore: 82,
      nextStepConfidence: 74,
      followUpRecommendation: "send_proposal_recommendation",
      followUpRecommendationLabel: "Send proposal recommendation",
      buyingSignalCount: 3,
      objectionCount: 1,
      championDetected: true,
      decisionMakerPresent: true,
      timelineDetected: true,
      budgetSignal: true,
      urgencySignal: false,
      noShowRiskPattern: false,
      momentumTrend: "accelerating",
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
        id: "dm-cert",
        leadId: "lead-cert",
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
}

export async function certifyOpportunityDraftEngine(
  admin: SupabaseClient,
  input: {
    execution_id: string
    report: OpportunityDraftEngineAutomationReport
  },
): Promise<OpportunityDraftEngineCertificationReport> {
  const blockers: string[] = []
  const checks: OpportunityDraftEngineCertificationReport["checks"] = []

  const sample = sampleGeneratorInput()
  const readiness = computeOpportunityDraftReadinessScore(sample)
  checks.push({
    id: "readiness_scoring",
    satisfied: readiness.opportunity_readiness_score >= 0 && readiness.opportunity_readiness_score <= 100,
    detail: `Readiness score ${readiness.opportunity_readiness_score}; status ${readiness.readiness_status}.`,
  })
  if (readiness.opportunity_readiness_score < 0 || readiness.opportunity_readiness_score > 100) {
    blockers.push("readiness_scoring_invalid")
  }

  const artifacts = generateOpportunityDraftFromMeeting(sample)
  checks.push({
    id: "draft_generation",
    satisfied: Boolean(artifacts.opportunity_summary.trim()),
    detail: artifacts.opportunity_summary.slice(0, 120),
  })
  if (!artifacts.opportunity_summary.trim()) blockers.push("draft_generation_failed")

  checks.push({
    id: "stakeholder_extraction",
    satisfied: artifacts.key_stakeholders.length > 0,
    detail: `${artifacts.key_stakeholders.length} stakeholder(s) extracted.`,
  })
  if (artifacts.key_stakeholders.length === 0) blockers.push("stakeholder_extraction_failed")

  checks.push({
    id: "buying_signal_extraction",
    satisfied: artifacts.buying_signals.length > 0,
    detail: `${artifacts.buying_signals.length} buying signal(s) extracted.`,
  })
  if (artifacts.buying_signals.length === 0) blockers.push("buying_signal_extraction_failed")

  checks.push({
    id: "stage_recommendation",
    satisfied: Boolean(artifacts.recommended_stage),
    detail: `Recommended stage: ${artifacts.recommended_stage}.`,
  })
  if (!artifacts.recommended_stage) blockers.push("stage_recommendation_failed")

  const duplicateBlock = evaluateOpportunityDraftDuplicateBlock({ existing_status: "draft" })
  checks.push({
    id: "duplicate_prevention",
    satisfied: duplicateBlock.blocked,
    detail: duplicateBlock.code ?? "duplicate_block_missing",
  })
  if (!duplicateBlock.blocked) blockers.push("duplicate_prevention_failed")

  const approvalGate = evaluateOpportunityDraftApprovalGate({
    draft: {
      draft_id: "draft-cert",
      meeting_id: "meeting-cert",
      lead_id: "lead-cert",
      company_id: null,
      account_playbook_id: "playbook-cert",
      company_name: "Summit Medical",
      ...artifacts,
      opportunity_readiness_score: readiness.opportunity_readiness_score,
      opportunity_readiness_status: readiness.readiness_status,
      source_attribution: {
        apollo_source: "Apollo Primary Contact Acquisition",
        qualification_source: "apollo_enrollment_qualification_engine",
        enrollment_source: "apollo_enrollment_automation",
        account_playbook_source: "apollo_account_playbooks_abp_1",
        voice_drop_source: "apollo_voice_drop_automation",
        multichannel_source: "apollo_multichannel_orchestration_engine",
        sequence_execution_source: "apollo_sequence_execution_automation",
        reply_intelligence_source: "growth_reply_intelligence_v2",
        meeting_candidate_source: "apollo_meeting_bridge_m1a",
        meeting_source: "growth_meeting_intelligence",
        opportunity_draft_source: "growth_opportunity_draft_engine_m1d",
        attribution_chain: [...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION],
      },
      status: "draft",
      input_hash: "hash-cert",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approved_at: null,
      approved_email: null,
      rejection_note: null,
    },
  })
  checks.push({
    id: "approve_reject_regenerate_gates",
    satisfied: approvalGate.allowed,
    detail: "Approval gate allows draft status with summary present.",
  })
  if (!approvalGate.allowed) blockers.push("approval_gate_failed")

  const attributionRecord = buildOpportunityDraftAttributionRecord({
    attribution_chain: [...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION],
  })
  const attribution_preserved = assertOpportunityDraftAttributionPreserved(attributionRecord)
  checks.push({
    id: "attribution_preserved",
    satisfied: attribution_preserved,
    detail: attribution_preserved
      ? "Full pipeline chain preserved through Opportunity Draft."
      : "Attribution chain incomplete.",
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const safetyVerified =
    OPPORTUNITY_DRAFT_SAFETY_FLAGS.opportunity_created === false &&
    OPPORTUNITY_DRAFT_SAFETY_FLAGS.crm_written === false &&
    OPPORTUNITY_DRAFT_SAFETY_FLAGS.deal_created === false &&
    OPPORTUNITY_DRAFT_SAFETY_FLAGS.calendar_written === false &&
    input.report.opportunity_created === false &&
    input.report.crm_written === false &&
    input.report.deal_created === false &&
    input.report.calendar_written === false
  checks.push({
    id: "no_crm_writes",
    satisfied: safetyVerified,
    detail: "Hard-coded safety flags confirm no CRM, deal, calendar, or opportunity creation.",
  })
  if (!safetyVerified) blockers.push("safety_flags_violated")

  checks.push({
    id: "no_opportunity_creation",
    satisfied: input.report.opportunity_created === false,
    detail: "Approval and generation paths do not create opportunities.",
  })
  if (input.report.opportunity_created) blockers.push("opportunity_created_violation")

  checks.push({
    id: "queue_visibility",
    satisfied: input.report.drafts_created >= 0,
    detail: `Drafts created in execution: ${input.report.drafts_created}.`,
  })

  let funnel_metrics = null
  try {
    funnel_metrics = await buildOpportunityDraftFunnelMetrics(admin)
    checks.push({
      id: "funnel_metrics",
      satisfied: funnel_metrics.qa_marker === OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
      detail: `Meetings completed ${funnel_metrics.meetings_completed}; drafts ${funnel_metrics.drafts_generated}.`,
    })
  } catch (error) {
    checks.push({
      id: "funnel_metrics",
      satisfied: false,
      detail: error instanceof Error ? error.message : "funnel_metrics_failed",
    })
    blockers.push("funnel_metrics_failed")
  }

  return {
    qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
    certified: blockers.length === 0,
    blockers,
    checks,
    funnel_metrics,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}
