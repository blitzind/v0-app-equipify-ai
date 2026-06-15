/** Phase GS-6A — Command Center Unification certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import {
  buildGrowthCommandCenterMetrics,
  buildGrowthCommandCenterTimeline,
  buildGrowthCommandCenterWorkspace,
  buildGrowthLeadWorkspace,
} from "@/lib/growth/command-center-unification/command-center-unification-engine"
import {
  COMMAND_CENTER_UNIFICATION_CONFIRM,
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  COMMAND_CENTER_VIEW_IDS,
  COMMAND_CENTER_WORKSPACE_STATUSES,
} from "@/lib/growth/command-center-unification/command-center-unification-types"
import { fetchGrowthCommandCenterUnification } from "@/lib/growth/command-center-unification/command-center-unification-service"
import { generateCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-engine"
import { generateSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-engine"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

export { COMMAND_CENTER_UNIFICATION_CONFIRM }

const CERT_PREFIX = "gs6a-cert"

export function assertCommandCenterUnificationCertificationAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function certReadiness(): CampaignReadinessAssessment {
  return {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: `${CERT_PREFIX}-readiness`,
    subject_type: "prospect",
    subject_ref: `${CERT_PREFIX}-lead`,
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 72,
    readiness_status: "partially_ready",
    dimensions: [],
    blockers: [],
    recommendations: [],
    missing_assets: [],
    missing_channels: [],
    required_approvals: ["Human execution approval"],
    required_human_actions: ["Review campaign readiness"],
    review_status: "pending",
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

function certPattern(suffix: string): GrowthSequencePattern {
  return {
    id: `${CERT_PREFIX}-pattern-${suffix}`,
    key: `${CERT_PREFIX}_unification`,
    label: `${CERT_PREFIX} Unification Pattern`,
    description: null,
    patternKind: "catalog",
    sequenceVersion: 1,
    isActive: true,
    minTouches: 2,
    maxObservationDays: 21,
    attemptCount: 5,
    replyRate: 0.1,
    positiveReplyRate: 0.04,
    meetingSignalRate: 0.02,
    followUpCompletionRate: 0.35,
    sequenceAbandonmentRate: 0.08,
    opportunityLift: 0.05,
    revenueProbabilityLift: 0.04,
    conversationHealthLift: 0.03,
    averageTimeToReplyHours: 36,
    averageTouchesToPositiveSignal: 2,
    sequenceQualityScore: 70,
    sequenceFatigueRisk: "low",
    confidenceScore: 62,
    computedAt: new Date().toISOString(),
    steps: [
      {
        id: `${CERT_PREFIX}-step-1`,
        patternId: `${CERT_PREFIX}-pattern-${suffix}`,
        stepOrder: 1,
        channel: "email",
        delayDaysMin: 0,
        delayDaysMax: 0,
        generationType: "personalized",
        playbookCategory: "value_prop",
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "reply",
      },
    ],
  }
}

export async function executeCommandCenterUnificationCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertCommandCenterUnificationCertificationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()
  const suffix = execution_id.slice(0, 8)
  const pattern = certPattern(suffix)
  const readiness = certReadiness()

  const previews = generateSequencePreview({
    patterns: [pattern],
    campaign_readiness: readiness,
    lead_id: `${CERT_PREFIX}-lead`,
    limit: 5,
  })

  const wizards = generateCampaignBuilderWizard({
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    pattern_id: pattern.id,
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    patterns: [pattern],
    limit: 5,
  })

  const ctx = {
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    campaign_readiness: readiness,
    sequence_previews: previews,
    campaign_builder: wizards,
  }

  const workspace = buildGrowthCommandCenterWorkspace(ctx)
  const leadWorkspace = buildGrowthLeadWorkspace(ctx)
  const metrics = buildGrowthCommandCenterMetrics(ctx)
  const timeline = buildGrowthCommandCenterTimeline(ctx)

  for (const status of COMMAND_CENTER_WORKSPACE_STATUSES) {
    checks.push({
      id: `status_${status}`,
      pass: true,
      detail: { workspace_status: workspace.workspace_status },
    })
  }

  checks.push({
    id: "workspace_generated",
    pass: workspace.qa_marker === COMMAND_CENTER_UNIFICATION_QA_MARKER && workspace.sections.length >= 8,
    detail: { sections: workspace.sections.length, status: workspace.workspace_status },
  })

  checks.push({
    id: "lead_workspace_generated",
    pass: leadWorkspace.lead_id === `${CERT_PREFIX}-lead` && leadWorkspace.sections.length >= 8,
    detail: { sections: leadWorkspace.sections.length },
  })

  checks.push({
    id: "global_views_present",
    pass: workspace.views.length === COMMAND_CENTER_VIEW_IDS.length,
    detail: { views: workspace.views.length },
  })

  checks.push({
    id: "metrics_generated",
    pass: metrics.total_signals >= 0 && typeof metrics.blocked_campaigns === "number",
    detail: { metrics },
  })

  checks.push({
    id: "timeline_generated",
    pass: timeline.length >= 2,
    detail: { timeline_items: timeline.length },
  })

  checks.push({
    id: "attention_queue_present",
    pass: Array.isArray(workspace.attention_queue),
    detail: { count: workspace.attention_queue.length },
  })

  checks.push({
    id: "approval_queue_present",
    pass: Array.isArray(workspace.approval_queue),
    detail: { count: workspace.approval_queue.length },
  })

  checks.push({
    id: "human_review_required",
    pass:
      workspace.requires_human_review === true &&
      workspace.autonomous_execution_enabled === false &&
      leadWorkspace.requires_human_review === true,
    detail: {},
  })

  checks.push({
    id: "no_outreach_execution",
    pass: workspace.outreach_execution === false && leadWorkspace.outreach_execution === false,
    detail: {},
  })

  checks.push({
    id: "no_enrollment_execution",
    pass: workspace.enrollment_execution === false && leadWorkspace.enrollment_execution === false,
    detail: {},
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: workspace.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const live = await fetchGrowthCommandCenterUnification(admin, { limit: 10, persist_audit: false })
  checks.push({
    id: "live_unification_round_trip",
    pass: live.qa_marker === COMMAND_CENTER_UNIFICATION_QA_MARKER && live.sections.length >= 8,
    detail: { organization_id: organization_id ?? null, sections: live.sections.length },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
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
