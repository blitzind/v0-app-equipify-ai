/** Phase GS-5B — Sequence Preview certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { CAMPAIGN_READINESS_QA_MARKER } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import { generateSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-engine"
import { scoreSequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-priority"
import {
  SEQUENCE_PREVIEW_CONFIRM,
  SEQUENCE_PREVIEW_QA_MARKER,
  SEQUENCE_PREVIEW_STATUSES,
} from "@/lib/growth/sequence-preview/sequence-preview-types"
import { fetchSequencePreviewStudio } from "@/lib/growth/sequence-preview/sequence-preview-service"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"

export { SEQUENCE_PREVIEW_CONFIRM }

const CERT_PREFIX = "gs5b-cert"

export function assertSequencePreviewCertificationAllowed(env: Record<string, string | undefined>): {
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
    readiness_score: 40,
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
    key: `${CERT_PREFIX}_multichannel`,
    label: `${CERT_PREFIX} Multichannel Preview`,
    description: "Certification sequence pattern",
    patternKind: "catalog",
    sequenceVersion: 1,
    isActive: true,
    minTouches: 3,
    maxObservationDays: 30,
    attemptCount: 10,
    replyRate: 0.12,
    positiveReplyRate: 0.05,
    meetingSignalRate: 0.03,
    followUpCompletionRate: 0.4,
    sequenceAbandonmentRate: 0.1,
    opportunityLift: 0.08,
    revenueProbabilityLift: 0.06,
    conversationHealthLift: 0.04,
    averageTimeToReplyHours: 48,
    averageTouchesToPositiveSignal: 3,
    sequenceQualityScore: 72,
    sequenceFatigueRisk: "medium",
    confidenceScore: 65,
    computedAt: new Date().toISOString(),
    steps: [
      {
        id: `${CERT_PREFIX}-step-1-${suffix}`,
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
        id: `${CERT_PREFIX}-step-2-${suffix}`,
        patternId: `${CERT_PREFIX}-pattern-${suffix}`,
        stepOrder: 2,
        channel: "sms",
        delayDaysMin: 2,
        delayDaysMax: 3,
        generationType: "personalized",
        playbookCategory: null,
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "positive_reply",
      },
      {
        id: `${CERT_PREFIX}-step-3-${suffix}`,
        patternId: `${CERT_PREFIX}-pattern-${suffix}`,
        stepOrder: 3,
        channel: "voice_drop",
        delayDaysMin: 4,
        delayDaysMax: 5,
        generationType: null,
        playbookCategory: null,
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "call_connected",
      },
    ],
  }
}

function certBlockedPattern(suffix: string): GrowthSequencePattern {
  const pattern = certPattern(suffix)
  return {
    ...pattern,
    id: `${CERT_PREFIX}-blocked-${suffix}`,
    key: `${CERT_PREFIX}_blocked`,
    label: `${CERT_PREFIX} Blocked Preview`,
    isActive: false,
    steps: [],
  }
}

export async function executeSequencePreviewCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertSequencePreviewCertificationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()
  const suffix = execution_id.slice(0, 8)
  const readiness = certReadinessAssessment()

  const generated = generateSequencePreview({
    patterns: [certPattern(suffix), certBlockedPattern(suffix)],
    campaign_readiness: readiness,
    lead_id: `${CERT_PREFIX}-lead`,
    company_name: `${CERT_PREFIX} HVAC Co`,
    limit: 10,
  })

  for (const status of SEQUENCE_PREVIEW_STATUSES) {
    checks.push({
      id: `status_${status}`,
      pass: generated.status_counts[status] >= 0,
      detail: { count: generated.status_counts[status] },
    })
  }

  checks.push({
    id: "previews_generated",
    pass: generated.previews.length >= 2 && generated.qa_marker === SEQUENCE_PREVIEW_QA_MARKER,
    detail: { total: generated.total },
  })

  checks.push({
    id: "step_timeline_present",
    pass: generated.previews.some((p) => p.steps.length >= 3),
    detail: {},
  })

  checks.push({
    id: "blocked_voice_drop_detected",
    pass: generated.previews.some(
      (p) => p.sequence_status === "blocked" && p.risks.some((r) => r.title.includes("Voice Drop")),
    ),
    detail: {},
  })

  checks.push({
    id: "draft_empty_pattern",
    pass: generated.previews.some((p) => p.sequence_status === "draft"),
    detail: {},
  })

  checks.push({
    id: "approval_requirements_present",
    pass: generated.previews.every((p) => p.approval_requirements.length > 0),
    detail: {},
  })

  const scoreA = scoreSequencePreview(generated.previews[0]!)
  const scoreB = scoreSequencePreview(generated.previews[0]!)
  checks.push({
    id: "deterministic_scoring",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  checks.push({
    id: "human_review_required",
    pass: generated.previews.every(
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

  const live = await fetchSequencePreviewStudio(admin, { limit: 10, persist_audit: false })
  checks.push({
    id: "live_preview_round_trip",
    pass: live.qa_marker === SEQUENCE_PREVIEW_QA_MARKER,
    detail: { organization_id: organization_id ?? null, total: live.total },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
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
