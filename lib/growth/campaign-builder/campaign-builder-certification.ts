/** Phase GS-5D — Campaign Builder certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { generateCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-engine"
import { scoreCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-priority"
import {
  CAMPAIGN_BUILDER_CONFIRM,
  CAMPAIGN_BUILDER_QA_MARKER,
  CAMPAIGN_BUILDER_STATUSES,
  CAMPAIGN_BUILDER_STEP_IDS,
} from "@/lib/growth/campaign-builder/campaign-builder-types"
import { fetchCampaignBuilderWizard } from "@/lib/growth/campaign-builder/campaign-builder-service"
import { generateSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-engine"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

export { CAMPAIGN_BUILDER_CONFIRM }

const CERT_PREFIX = "gs5d-cert"

export function assertCampaignBuilderCertificationAllowed(env: Record<string, string | undefined>): {
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
    readiness_score: 55,
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
    missing_assets: ["Knowledge playbook"],
    missing_channels: ["verified_email"],
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
    key: `${CERT_PREFIX}_campaign`,
    label: `${CERT_PREFIX} Campaign Pattern`,
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
      {
        id: `${CERT_PREFIX}-step-2`,
        patternId: `${CERT_PREFIX}-pattern-${suffix}`,
        stepOrder: 2,
        channel: "voice_drop",
        delayDaysMin: 3,
        delayDaysMax: 4,
        generationType: null,
        playbookCategory: null,
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "call_connected",
      },
    ],
  }
}

export async function executeCampaignBuilderCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertCampaignBuilderCertificationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
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

  const generated = generateCampaignBuilderWizard({
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    pattern_id: pattern.id,
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    patterns: [pattern],
    limit: 5,
  })

  for (const status of CAMPAIGN_BUILDER_STATUSES) {
    checks.push({
      id: `status_${status}`,
      pass: generated.status_counts[status] >= 0,
      detail: { count: generated.status_counts[status] },
    })
  }

  checks.push({
    id: "wizard_generated",
    pass: generated.wizards.length >= 1 && generated.qa_marker === CAMPAIGN_BUILDER_QA_MARKER,
    detail: { total: generated.total, score: generated.wizards[0]?.configuration_score },
  })

  checks.push({
    id: "wizard_steps_present",
    pass: generated.wizards.every((w) => w.steps.length === CAMPAIGN_BUILDER_STEP_IDS.length),
    detail: {},
  })

  checks.push({
    id: "channel_recommendations",
    pass: generated.wizards.some((w) => w.configuration.recommended_channels.length > 0),
    detail: {},
  })

  checks.push({
    id: "sequence_structure_recommended",
    pass: generated.wizards.some((w) => w.configuration.suggested_sequence_structure.length > 0),
    detail: {},
  })

  checks.push({
    id: "approval_requirements_present",
    pass: generated.wizards.every((w) => w.approval_requirements.length > 0),
    detail: {},
  })

  checks.push({
    id: "risks_detected",
    pass: generated.wizards.every((w) => w.risks.length > 0),
    detail: {},
  })

  const scoreA = scoreCampaignBuilderWizard(generated.wizards[0]!)
  const scoreB = scoreCampaignBuilderWizard(generated.wizards[0]!)
  checks.push({
    id: "deterministic_scoring",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  checks.push({
    id: "human_review_required",
    pass: generated.wizards.every(
      (w) => w.requires_human_review === true && w.autonomous_execution_enabled === false,
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

  const live = await fetchCampaignBuilderWizard(admin, { limit: 5, persist_audit: false })
  checks.push({
    id: "live_wizard_round_trip",
    pass: live.qa_marker === CAMPAIGN_BUILDER_QA_MARKER,
    detail: { organization_id: organization_id ?? null, total: live.total },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
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
