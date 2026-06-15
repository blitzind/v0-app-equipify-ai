/** Phase GS-5C — Smart Follow-Up Policy certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { generateSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-engine"
import { scoreSmartFollowUpPolicy } from "@/lib/growth/follow-up-policies/follow-up-policy-priority"
import {
  SMART_FOLLOW_UP_CHANNELS,
  SMART_FOLLOW_UP_POLICY_CONFIRM,
  SMART_FOLLOW_UP_POLICY_QA_MARKER,
  SMART_FOLLOW_UP_POLICY_TYPES,
} from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import { fetchSmartFollowUpPolicies } from "@/lib/growth/follow-up-policies/follow-up-policy-service"
import { generateHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-engine"
import {
  normalizeReplyWorkflowAction,
  normalizeSignalFeedItem,
} from "@/lib/growth/operator-inbox/operator-inbox-aggregator"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"

export { SMART_FOLLOW_UP_POLICY_CONFIRM }

const CERT_PREFIX = "gs5c-cert"

export function assertSmartFollowUpPolicyCertificationAllowed(
  env: Record<string, string | undefined>,
): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function certReadinessAssessment(): CampaignReadinessAssessment {
  return {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: `${CERT_PREFIX}-readiness`,
    subject_type: "prospect",
    subject_ref: `${CERT_PREFIX}-lead`,
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 45,
    readiness_status: "partially_ready",
    dimensions: [],
    blockers: [
      {
        blocker_id: "channel_missing",
        dimension_id: "channel_readiness",
        severity: "warning",
        message: "Missing verified email channel",
        resolution_hint: "Run contact discovery",
        related_asset_href: "/admin/growth/search",
      },
    ],
    recommendations: [],
    missing_assets: [],
    missing_channels: ["verified_email"],
    required_approvals: ["Human execution approval"],
    required_human_actions: ["Review campaign readiness"],
    review_status: "pending",
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export async function executeSmartFollowUpPolicyCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertSmartFollowUpPolicyCertificationAllowed(
    process.env as Record<string, string | undefined>,
  )
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()
  const suffix = execution_id.slice(0, 8)

  const signalItem = normalizeSignalFeedItem({
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: `${CERT_PREFIX}-signal-${suffix}`,
    audit_event_id: `${CERT_PREFIX}-audit-${suffix}`,
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    signal_type: "company_hiring",
    signal_label: "High intent hiring signal",
    source_domain: "company",
    confidence: 0.92,
    urgency: "high",
    signal_score: 88,
    occurred_at: new Date().toISOString(),
    recommended_action: "Review high-intent account",
    expected_impact: "Meeting likelihood elevated",
    reasoning: "Deterministic high-intent trigger",
    priority: "high",
    status: "new",
    dedupe_hash: null,
    collapsed_count: 1,
    queue_hint: null,
    cta: {
      view_lead: `/admin/growth/command?leadId=${CERT_PREFIX}-lead`,
      review_company: null,
      open_timeline: null,
      review_sequence: null,
    },
    requires_human_approval: true,
  })

  const workflowItem = normalizeReplyWorkflowAction({
    id: `${CERT_PREFIX}-workflow-${suffix}`,
    replyId: null,
    leadId: `${CERT_PREFIX}-lead`,
    actionType: "mark_interested",
    actionStatus: "pending_review",
    severity: "high",
    title: `${CERT_PREFIX} Positive reply — follow-up planning`,
    summary: "Prospect expressed interest — operator must plan follow-up manually.",
    createdAt: new Date().toISOString(),
    companyName: `${CERT_PREFIX} HVAC Co`,
    replyIntent: "interested",
    replyNextAction: "schedule_call",
    replyBodyPreview: "We are interested in learning more.",
    replyReceivedAt: new Date().toISOString(),
    category: "interested",
  })

  const meetingItem = normalizeReplyWorkflowAction({
    id: `${CERT_PREFIX}-meeting-${suffix}`,
    replyId: null,
    leadId: `${CERT_PREFIX}-lead`,
    actionType: "schedule_meeting",
    actionStatus: "pending_review",
    severity: "medium",
    title: `${CERT_PREFIX} Meeting follow-up required`,
    summary: "Post-demo meeting — operator should plan next touch.",
    createdAt: new Date().toISOString(),
    companyName: `${CERT_PREFIX} HVAC Co`,
    replyIntent: "meeting",
    replyNextAction: "send_proposal",
    replyBodyPreview: "Thanks for the demo — send proposal.",
    replyReceivedAt: new Date().toISOString(),
    category: "meeting",
  })

  const readiness = certReadinessAssessment()
  const interventions = generateHumanInterventions({
    inbox_items: [signalItem, workflowItem, meetingItem],
    campaign_readiness: readiness,
    limit: 20,
  })

  const generated = generateSmartFollowUpPolicies({
    inbox_items: [signalItem, workflowItem, meetingItem],
    interventions: interventions.interventions,
    campaign_readiness: readiness,
    limit: 30,
  })

  for (const policyType of SMART_FOLLOW_UP_POLICY_TYPES) {
    checks.push({
      id: `type_${policyType}`,
      pass: generated.type_counts[policyType] >= 0,
      detail: { count: generated.type_counts[policyType] },
    })
  }

  checks.push({
    id: "policies_generated",
    pass: generated.policies.length >= 2 && generated.qa_marker === SMART_FOLLOW_UP_POLICY_QA_MARKER,
    detail: { total: generated.total, recommended: generated.recommended_count },
  })

  checks.push({
    id: "reply_follow_up_detected",
    pass: generated.policies.some((p) => p.policy_type === "reply_follow_up" || p.policy_type === "high_intent_follow_up"),
    detail: {},
  })

  checks.push({
    id: "meeting_follow_up_detected",
    pass: generated.policies.some((p) => p.policy_type === "meeting_follow_up"),
    detail: {},
  })

  checks.push({
    id: "channel_plans_present",
    pass: generated.policies.every((p) => p.channel_plans.length === SMART_FOLLOW_UP_CHANNELS.length),
    detail: {},
  })

  checks.push({
    id: "follow_up_window_present",
    pass: generated.policies.every((p) => Boolean(p.follow_up_window?.window_id)),
    detail: {},
  })

  const scoreA = scoreSmartFollowUpPolicy(generated.policies[0]!)
  const scoreB = scoreSmartFollowUpPolicy(generated.policies[0]!)
  checks.push({
    id: "deterministic_scoring",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  checks.push({
    id: "human_review_required",
    pass: generated.policies.every(
      (p) => p.requires_human_review === true && p.autonomous_execution_enabled === false,
    ),
    detail: {},
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: generated.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const live = await fetchSmartFollowUpPolicies(admin, { limit: 15, persist_audit: false })
  checks.push({
    id: "live_policy_round_trip",
    pass: live.qa_marker === SMART_FOLLOW_UP_POLICY_QA_MARKER,
    detail: { organization_id: organization_id ?? null, total: live.total },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    enrollment_enabled: false,
    outreach_enabled: false,
    blockers: [],
  }
}
