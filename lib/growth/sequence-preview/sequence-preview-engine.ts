/** Phase GS-5B — Deterministic Sequence Preview Engine (client-safe). */

import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import type { HumanIntervention } from "@/lib/growth/human-interventions/human-intervention-types"
import {
  filterSequencePreviews,
  rankSequencePreviews,
} from "@/lib/growth/sequence-preview/sequence-preview-priority"
import {
  SEQUENCE_PREVIEW_QA_MARKER,
  SEQUENCE_PREVIEW_STATUSES,
  SEQUENCE_PREVIEW_STATUS_LABELS,
  type SequencePreview,
  type SequencePreviewApprovalRequirement,
  type SequencePreviewChannel,
  type SequencePreviewFilter,
  type SequencePreviewRecommendation,
  type SequencePreviewRisk,
  type SequencePreviewStatus,
  type SequencePreviewStep,
  type SequencePreviewStudioResponse,
} from "@/lib/growth/sequence-preview/sequence-preview-types"
import type { GrowthSequencePattern, GrowthSequencePatternStep, GrowthSequenceStepChannel } from "@/lib/growth/sequence-types"
import {
  listVoiceDropStepsMissingCampaign,
  VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING,
} from "@/lib/growth/sequences/sequence-voice-drop-pattern-readiness"

function mapPreviewChannel(channel: GrowthSequenceStepChannel): SequencePreviewChannel {
  switch (channel) {
    case "email":
      return "email"
    case "sms":
    case "sms_task":
      return "sms"
    case "voice_drop":
      return "voice_drop"
    case "call":
    case "manual_call":
    case "voicemail":
      return "call"
    case "manual_task":
    case "manual_follow_up":
    case "meeting_followup":
      return "manual"
    default:
      return "other"
  }
}

function formatStepLabel(step: GrowthSequencePatternStep): string {
  const channel = step.channel.replace(/_/g, " ")
  if (step.generationType) return `Step ${step.stepOrder}: ${channel} (${step.generationType})`
  return `Step ${step.stepOrder}: ${channel}`
}

function buildScheduledWindow(cumulativeMin: number, cumulativeMax: number): string {
  if (cumulativeMin === cumulativeMax) return `Day ${cumulativeMin}`
  return `Day ${cumulativeMin}–${cumulativeMax}`
}

function evaluateChannelStatus(
  channel: SequencePreviewChannel,
  readiness: CampaignReadinessAssessment | null | undefined,
  step: GrowthSequencePatternStep,
): { status: SequencePreviewStep["channel_status"]; blockers: string[] } {
  const blockers: string[] = []
  const missing = new Set(readiness?.missing_channels ?? [])

  if (readiness?.readiness_status === "not_ready") {
    blockers.push("Campaign readiness not ready")
  }

  if (channel === "email" && missing.has("verified_email")) {
    blockers.push("No verified email channel")
  }
  if ((channel === "sms" || channel === "voice_drop" || channel === "call") && missing.has("verified_phone")) {
    blockers.push("No verified phone channel")
  }
  if (channel === "voice_drop" && !step.voiceDropCampaignId) {
    blockers.push("Voice Drop campaign not linked")
  }
  if (channel === "voice_drop") {
    blockers.push(VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING)
  }
  if (channel === "sms") {
    blockers.push("SMS requires compliance review and human approval before send")
  }

  const criticalBlocker = blockers.some(
    (b) => b.includes("not ready") || b.includes("not linked") || b.includes("No verified"),
  )
  if (criticalBlocker) return { status: "blocked", blockers }
  if (blockers.length > 0) return { status: "conditional", blockers }
  return { status: "ready", blockers }
}

function evaluatePersonalization(
  step: GrowthSequencePatternStep,
  readiness: CampaignReadinessAssessment | null | undefined,
): SequencePreviewStep["personalization_status"] {
  if (step.playbookCategory) return "covered"
  if (step.generationType && step.generationType !== "static") return "partial"
  if ((readiness?.missing_assets ?? []).some((a) => /playbook|knowledge|messaging/i.test(a))) return "missing"
  return step.channel === "email" || step.channel === "sms" ? "partial" : "covered"
}

function buildPreviewSteps(
  pattern: GrowthSequencePattern,
  readiness: CampaignReadinessAssessment | null | undefined,
): SequencePreviewStep[] {
  const sorted = [...pattern.steps].sort((a, b) => a.stepOrder - b.stepOrder)
  let cumulativeMin = 0
  let cumulativeMax = 0
  let previousMax = 0

  return sorted.map((step) => {
    cumulativeMin += step.delayDaysMin
    cumulativeMax += step.delayDaysMax
    const timingGap = step.delayDaysMin > 0 ? step.delayDaysMin : step.delayDaysMax - previousMax
    previousMax = step.delayDaysMax

    const previewChannel = mapPreviewChannel(step.channel)
    const { status, blockers } = evaluateChannelStatus(previewChannel, readiness, step)
    const notes: string[] = []
    if (step.expectedSignal !== "no_signal") {
      notes.push(`Expected signal: ${step.expectedSignal.replace(/_/g, " ")}`)
    }
    if (step.requiredHumanApproval) {
      notes.push("Human approval required before this step executes")
    }
    if (step.delayDaysMin !== step.delayDaysMax) {
      notes.push(`Timing window: ${step.delayDaysMin}–${step.delayDaysMax} days after prior step`)
    }

    return {
      step_id: step.id,
      step_order: step.stepOrder,
      channel: previewChannel,
      raw_channel: step.channel,
      label: formatStepLabel(step),
      delay_days_min: step.delayDaysMin,
      delay_days_max: step.delayDaysMax,
      timing_gap_days: Math.max(0, timingGap),
      cumulative_day_min: cumulativeMin,
      cumulative_day_max: cumulativeMax,
      scheduled_window_label: buildScheduledWindow(cumulativeMin, cumulativeMax),
      channel_status: status,
      personalization_status: evaluatePersonalization(step, readiness),
      playbook_category: step.playbookCategory,
      requires_human_approval: step.requiredHumanApproval,
      blockers,
      notes,
    }
  })
}

function buildRisks(
  pattern: GrowthSequencePattern,
  steps: SequencePreviewStep[],
  readiness: CampaignReadinessAssessment | null | undefined,
  interventions: HumanIntervention[],
): SequencePreviewRisk[] {
  const risks: SequencePreviewRisk[] = [
    {
      risk_id: `risk_preview_only_${pattern.id}`,
      severity: "medium",
      title: "Preview only — no autonomous execution",
      description: "Sequence Preview Studio is planning and review only. Operator must approve each step manually.",
      related_step_order: null,
    },
  ]

  if (pattern.sequenceFatigueRisk === "high" || pattern.sequenceFatigueRisk === "medium") {
    risks.push({
      risk_id: `risk_fatigue_${pattern.id}`,
      severity: pattern.sequenceFatigueRisk === "high" ? "high" : "medium",
      title: "Sequence fatigue risk",
      description: `Pattern fatigue risk is ${pattern.sequenceFatigueRisk} based on historical sequence intelligence.`,
      related_step_order: null,
    })
  }

  for (const step of steps) {
    if (step.channel_status === "blocked") {
      risks.push({
        risk_id: `risk_channel_${step.step_id}`,
        severity: "critical",
        title: `Step ${step.step_order} channel blocked`,
        description: step.blockers.join(" · "),
        related_step_order: step.step_order,
      })
    }
  }

  const missingVoiceDrop = listVoiceDropStepsMissingCampaign(pattern.steps)
  for (const step of missingVoiceDrop) {
    risks.push({
      risk_id: `risk_vd_${step.id}`,
      severity: "critical",
      title: "Voice Drop campaign missing",
      description: `Step ${step.stepOrder} requires an approved Voice Drop campaign linkage.`,
      related_step_order: step.stepOrder,
    })
  }

  for (const blocker of readiness?.blockers.filter((b) => b.severity === "critical") ?? []) {
    risks.push({
      risk_id: `risk_readiness_${blocker.blocker_id}`,
      severity: "critical",
      title: blocker.message,
      description: blocker.resolution_hint,
      related_step_order: null,
    })
  }

  for (const intervention of interventions.filter(
    (i) => i.intervention_type === "risk_detected" || i.intervention_type === "campaign_blocked",
  )) {
    risks.push({
      risk_id: `risk_intervention_${intervention.intervention_id}`,
      severity: "high",
      title: intervention.title,
      description: intervention.description,
      related_step_order: null,
    })
  }

  const tightGaps = steps.filter((s) => s.timing_gap_days > 0 && s.timing_gap_days < 2 && s.channel !== "manual")
  if (tightGaps.length > 0) {
    risks.push({
      risk_id: `risk_timing_${pattern.id}`,
      severity: "medium",
      title: "Aggressive step timing",
      description: `${tightGaps.length} step(s) have gaps under 2 days — review cadence before approval.`,
      related_step_order: tightGaps[0]?.step_order ?? null,
    })
  }

  return risks.slice(0, 12)
}

function buildApprovalRequirements(
  pattern: GrowthSequencePattern,
  steps: SequencePreviewStep[],
  readiness: CampaignReadinessAssessment | null | undefined,
): SequencePreviewApprovalRequirement[] {
  const requirements: SequencePreviewApprovalRequirement[] = [
    {
      requirement_id: "human_operator_review",
      label: "Human operator review",
      description: "Operator must review full sequence preview before any enrollment or send.",
      status: "pending",
    },
  ]

  if (steps.some((s) => s.requires_human_approval)) {
    requirements.push({
      requirement_id: "step_human_approval",
      label: "Per-step human approval",
      description: "One or more steps require explicit human approval before execution.",
      status: steps.some((s) => s.requires_human_approval) ? "pending" : "satisfied",
    })
  }

  for (const approval of readiness?.required_approvals ?? []) {
    requirements.push({
      requirement_id: `readiness_${approval.slice(0, 24).replace(/\s+/g, "_")}`,
      label: approval,
      description: "Required by campaign readiness assessment.",
      status: readiness?.readiness_status === "ready" ? "satisfied" : "pending",
    })
  }

  if (steps.some((s) => s.channel === "voice_drop")) {
    requirements.push({
      requirement_id: "voice_drop_compliance",
      label: "Voice Drop compliance pass",
      description: VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING,
      status: listVoiceDropStepsMissingCampaign(pattern.steps).length === 0 ? "pending" : "blocked",
    })
  }

  return requirements.slice(0, 8)
}

function buildRecommendations(preview: Pick<SequencePreview, "preview_id" | "related_href" | "sequence_status">): SequencePreviewRecommendation[] {
  const recs: SequencePreviewRecommendation[] = [
    {
      recommendation_id: `rec_review_${preview.preview_id}`,
      title: "Mark preview reviewed before planning enrollment",
      description: "Human review required — preview does not enroll or send.",
      priority: "high",
      related_href: preview.related_href,
      action_type: "mark_reviewed",
    },
  ]
  if (preview.related_href) {
    recs.unshift({
      recommendation_id: `rec_open_${preview.preview_id}`,
      title: "Open sequence pattern in builder",
      description: `Review ${SEQUENCE_PREVIEW_STATUS_LABELS[preview.sequence_status].toLowerCase()} sequence configuration.`,
      priority: "medium",
      related_href: preview.related_href,
      action_type: "open_related",
    })
  }
  return recs
}

function computePreviewScore(
  steps: SequencePreviewStep[],
  risks: SequencePreviewRisk[],
  pattern: GrowthSequencePattern,
): number {
  let score = 50
  score += Math.min(20, pattern.sequenceQualityScore / 5)
  score += Math.min(10, pattern.confidenceScore / 10)
  score -= risks.filter((r) => r.severity === "critical").length * 12
  score -= risks.filter((r) => r.severity === "high").length * 6
  score -= steps.filter((s) => s.channel_status === "blocked").length * 8
  score += steps.filter((s) => s.channel_status === "ready").length * 3
  return Math.max(0, Math.min(100, Math.round(score)))
}

function resolveSequenceStatus(
  pattern: GrowthSequencePattern,
  steps: SequencePreviewStep[],
  risks: SequencePreviewRisk[],
  readiness: CampaignReadinessAssessment | null | undefined,
): SequencePreviewStatus {
  if (!pattern.isActive || steps.length === 0) return "draft"
  if (risks.some((r) => r.severity === "critical")) return "blocked"
  if (readiness?.readiness_status === "not_ready") return "blocked"
  if (steps.some((s) => s.channel_status === "blocked")) return "blocked"
  if (
    risks.some((r) => r.severity === "high") ||
    steps.some((s) => s.channel_status === "conditional" || s.personalization_status === "missing")
  ) {
    return "needs_review"
  }
  if (pattern.sequenceFatigueRisk === "high") return "needs_review"
  return "ready_for_human_approval"
}

function countByStatus(previews: SequencePreview[]): Record<SequencePreviewStatus, number> {
  const counts = Object.fromEntries(SEQUENCE_PREVIEW_STATUSES.map((s) => [s, 0])) as Record<
    SequencePreviewStatus,
    number
  >
  for (const preview of previews) counts[preview.sequence_status] += 1
  return counts
}

/**
 * Deterministic sequence preview generation — planning only, no enrollment or outreach.
 */
export function generateSequencePreview(input: {
  patterns: GrowthSequencePattern[]
  campaign_readiness?: CampaignReadinessAssessment | null
  interventions?: HumanIntervention[]
  lead_id?: string | null
  company_name?: string | null
  filter?: SequencePreviewFilter
  limit?: number
}): SequencePreviewStudioResponse {
  const interventions = input.interventions ?? []
  const previews: SequencePreview[] = []

  for (const pattern of input.patterns) {
    const steps = buildPreviewSteps(pattern, input.campaign_readiness)
    const risks = buildRisks(pattern, steps, input.campaign_readiness, interventions)
    const approval_requirements = buildApprovalRequirements(pattern, steps, input.campaign_readiness)
    const sequence_status = resolveSequenceStatus(pattern, steps, risks, input.campaign_readiness)
    const preview_score = computePreviewScore(steps, risks, pattern)

    const preview: SequencePreview = {
      qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
      preview_id: `preview:${pattern.id}:${input.lead_id ?? "global"}`,
      pattern_id: pattern.id,
      pattern_key: pattern.key,
      pattern_label: pattern.label,
      lead_id: input.lead_id ?? null,
      company_name: input.company_name ?? null,
      sequence_status,
      preview_score,
      step_count: steps.length,
      steps,
      risks,
      recommendations: [],
      approval_requirements,
      review_status: "pending",
      related_href: `/admin/growth/sequences/builder?patternId=${encodeURIComponent(pattern.id)}`,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      generated_at: new Date().toISOString(),
    }

    preview.recommendations = buildRecommendations(preview)
    previews.push(preview)
  }

  const filtered = filterSequencePreviews(previews, input.filter ?? "all")
  const ranked = rankSequencePreviews(filtered)
  const limited = ranked.slice(0, input.limit ?? 20)

  return {
    qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: limited.length,
    blocked_count: limited.filter((p) => p.sequence_status === "blocked").length,
    needs_review_count: limited.filter((p) => p.sequence_status === "needs_review").length,
    ready_count: limited.filter((p) => p.sequence_status === "ready_for_human_approval").length,
    status_counts: countByStatus(limited),
    previews: limited,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}

/** Single-pattern convenience wrapper. */
export function generateSequencePreviewForPattern(input: {
  pattern: GrowthSequencePattern
  campaign_readiness?: CampaignReadinessAssessment | null
  interventions?: HumanIntervention[]
  lead_id?: string | null
  company_name?: string | null
}): SequencePreview | null {
  const response = generateSequencePreview({
    patterns: [input.pattern],
    campaign_readiness: input.campaign_readiness,
    interventions: input.interventions,
    lead_id: input.lead_id,
    company_name: input.company_name,
    limit: 1,
  })
  return response.previews[0] ?? null
}
