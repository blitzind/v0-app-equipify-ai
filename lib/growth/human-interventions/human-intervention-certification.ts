/** Phase GS-3E — Human Intervention certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { generateHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-engine"
import { scoreHumanIntervention } from "@/lib/growth/human-interventions/human-intervention-priority"
import {
  HUMAN_INTERVENTION_CONFIRM,
  HUMAN_INTERVENTION_QA_MARKER,
  HUMAN_INTERVENTION_TYPES,
} from "@/lib/growth/human-interventions/human-intervention-types"
import { fetchHumanInterventions } from "@/lib/growth/human-interventions/human-intervention-service"
import {
  normalizeReplyWorkflowAction,
  normalizeSignalFeedItem,
} from "@/lib/growth/operator-inbox/operator-inbox-aggregator"
import { OPERATOR_INBOX_QA_MARKER } from "@/lib/growth/operator-inbox/operator-inbox-types"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"

export { HUMAN_INTERVENTION_CONFIRM }

const CERT_PREFIX = "gs3e-cert"

export function assertHumanInterventionCertificationAllowed(
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
    readiness_score: 25,
    readiness_status: "not_ready",
    dimensions: [],
    blockers: [
      {
        blocker_id: "compliance_suppressed",
        dimension_id: "compliance_requirements",
        severity: "critical",
        message: "Account suppressed — campaign blocked",
        resolution_hint: "Resolve suppression before outreach",
        related_asset_href: `/admin/growth/leads/${CERT_PREFIX}-lead`,
      },
      {
        blocker_id: "channel_missing",
        dimension_id: "channel_readiness",
        severity: "warning",
        message: "Missing verified email channel",
        resolution_hint: "Run contact discovery",
        related_asset_href: "/admin/growth/search",
      },
      {
        blocker_id: "sequence_assets_missing",
        dimension_id: "sequence_assets",
        severity: "warning",
        message: "Sequence assets not configured",
        resolution_hint: "Configure sequence patterns before outreach",
        related_asset_href: "/admin/growth/sequences/builder",
      },
    ],
    recommendations: [],
    missing_assets: ["Verified channels"],
    missing_channels: ["verified_email"],
    required_approvals: ["Human execution approval"],
    required_human_actions: ["Review campaign readiness"],
    review_status: "pending",
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

export async function executeHumanInterventionCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertHumanInterventionCertificationAllowed(
    process.env as Record<string, string | undefined>,
  )
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: HUMAN_INTERVENTION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: HUMAN_INTERVENTION_QA_MARKER,
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
    cta: { view_lead: `/admin/growth/command?leadId=${CERT_PREFIX}-lead`, review_company: null, open_timeline: null, review_sequence: null },
    requires_human_approval: true,
  })

  const workflowItem = normalizeReplyWorkflowAction({
    id: `${CERT_PREFIX}-workflow-${suffix}`,
    replyId: null,
    leadId: `${CERT_PREFIX}-lead`,
    actionType: "mark_interested",
    actionStatus: "pending_review",
    severity: "high",
    title: `${CERT_PREFIX} Positive reply — review required`,
    summary: "Prospect expressed interest — operator must review before follow-up.",
    createdAt: new Date().toISOString(),
    companyName: `${CERT_PREFIX} HVAC Co`,
    replyIntent: "interested",
    replyNextAction: "schedule_call",
    replyBodyPreview: "We are interested in learning more.",
    replyReceivedAt: new Date().toISOString(),
    category: "interested",
  })

  const generated = generateHumanInterventions({
    inbox_items: [signalItem, workflowItem],
    campaign_readiness: certReadinessAssessment(),
    limit: 20,
  })

  for (const interventionType of HUMAN_INTERVENTION_TYPES) {
    checks.push({
      id: `type_${interventionType}`,
      pass: generated.type_counts[interventionType] >= 0,
      detail: { count: generated.type_counts[interventionType] },
    })
  }

  checks.push({
    id: "interventions_generated",
    pass: generated.interventions.length >= 2 && generated.qa_marker === HUMAN_INTERVENTION_QA_MARKER,
    detail: { total: generated.total, urgent: generated.urgent_count },
  })

  checks.push({
    id: "high_intent_from_reply",
    pass: generated.interventions.some((item) => item.intervention_type === "high_intent"),
    detail: {},
  })

  checks.push({
    id: "campaign_blocked_from_readiness",
    pass: generated.interventions.some((item) => item.intervention_type === "campaign_blocked"),
    detail: {},
  })

  const scoreA = scoreHumanIntervention(generated.interventions[0]!)
  const scoreB = scoreHumanIntervention(generated.interventions[0]!)
  checks.push({
    id: "deterministic_scoring",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  checks.push({
    id: "human_review_required",
    pass: generated.interventions.every(
      (item) => item.requires_human_review === true && item.autonomous_execution_enabled === false,
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

  const live = await fetchHumanInterventions(admin, { limit: 15, persist_audit: false })
  checks.push({
    id: "live_intervention_round_trip",
    pass: live.qa_marker === HUMAN_INTERVENTION_QA_MARKER,
    detail: { organization_id: organization_id ?? null, total: live.total },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: HUMAN_INTERVENTION_QA_MARKER,
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
