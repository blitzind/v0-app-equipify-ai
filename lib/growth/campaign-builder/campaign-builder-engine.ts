/** Phase GS-5D — Deterministic Campaign Builder Wizard Engine (client-safe). */

import type { CampaignReadinessAssessment } from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import {
  CAMPAIGN_BUILDER_CHANNELS,
  CAMPAIGN_BUILDER_QA_MARKER,
  CAMPAIGN_BUILDER_STATUSES,
  CAMPAIGN_BUILDER_STATUS_LABELS,
  CAMPAIGN_BUILDER_STEP_IDS,
  CAMPAIGN_BUILDER_STEP_LABELS,
  type CampaignBuilderChannel,
  type CampaignBuilderFilter,
  type CampaignBuilderWizard,
  type CampaignBuilderWizardApprovalRequirement,
  type CampaignBuilderWizardConfiguration,
  type CampaignBuilderWizardRecommendation,
  type CampaignBuilderWizardResponse,
  type CampaignBuilderWizardRisk,
  type CampaignBuilderWizardStatus,
  type CampaignBuilderWizardStep,
  type CampaignBuilderWizardStepId,
} from "@/lib/growth/campaign-builder/campaign-builder-types"
import {
  filterCampaignBuilderWizards,
  rankCampaignBuilderWizards,
} from "@/lib/growth/campaign-builder/campaign-builder-priority"
import type { SmartFollowUpPolicy } from "@/lib/growth/follow-up-policies/follow-up-policy-types"
import type { HumanIntervention } from "@/lib/growth/human-interventions/human-intervention-types"
import type { SequencePreview } from "@/lib/growth/sequence-preview/sequence-preview-types"
import type { GrowthSequencePattern } from "@/lib/growth/sequence-types"
import { listVoiceDropStepsMissingCampaign } from "@/lib/growth/sequences/sequence-voice-drop-pattern-readiness"

function countByStatus(wizards: CampaignBuilderWizard[]): Record<CampaignBuilderWizardStatus, number> {
  const counts = Object.fromEntries(CAMPAIGN_BUILDER_STATUSES.map((s) => [s, 0])) as Record<
    CampaignBuilderWizardStatus,
    number
  >
  for (const wizard of wizards) counts[wizard.wizard_status] += 1
  return counts
}

function resolveRecommendedChannels(
  readiness: CampaignReadinessAssessment | null | undefined,
  preview: SequencePreview | null | undefined,
  policies: SmartFollowUpPolicy[],
): CampaignBuilderChannel[] {
  const channels = new Set<CampaignBuilderChannel>()
  const missing = new Set(readiness?.missing_channels ?? [])

  if (!missing.has("verified_email")) channels.add("email")
  if (!missing.has("verified_phone")) {
    channels.add("sms")
    channels.add("call")
  }

  for (const step of preview?.steps ?? []) {
    if (step.channel_status !== "blocked" && CAMPAIGN_BUILDER_CHANNELS.includes(step.channel as CampaignBuilderChannel)) {
      channels.add(step.channel as CampaignBuilderChannel)
    }
  }

  for (const policy of policies) {
    for (const ch of policy.recommended_channels) {
      if (CAMPAIGN_BUILDER_CHANNELS.includes(ch as CampaignBuilderChannel)) {
        channels.add(ch as CampaignBuilderChannel)
      }
    }
  }

  if (channels.size === 0 && readiness?.readiness_status !== "not_ready") {
    channels.add("email")
  }

  return [...channels]
}

function pickSuggestedPattern(
  patterns: GrowthSequencePattern[],
  preview: SequencePreview | null | undefined,
  pattern_id?: string | null,
): GrowthSequencePattern | null {
  if (pattern_id) {
    return patterns.find((p) => p.id === pattern_id) ?? null
  }
  if (preview) {
    return patterns.find((p) => p.id === preview.pattern_id) ?? null
  }
  return (
    patterns.find((p) => p.isActive && p.sequenceQualityScore >= 60) ??
    patterns.find((p) => p.isActive) ??
    patterns[0] ??
    null
  )
}

function buildConfiguration(input: {
  readiness: CampaignReadinessAssessment | null | undefined
  preview: SequencePreview | null | undefined
  policies: SmartFollowUpPolicy[]
  pattern: GrowthSequencePattern | null
}): CampaignBuilderWizardConfiguration {
  const recommended_channels = resolveRecommendedChannels(input.readiness, input.preview, input.policies)
  const pattern = input.pattern
  const patternSteps = pattern?.steps ?? []
  let suggested_sequence_structure =
    patternSteps.length > 0
      ? [...patternSteps]
          .sort((a, b) => a.stepOrder - b.stepOrder)
          .map(
            (step) =>
              `Step ${step.stepOrder}: ${step.channel.replace(/_/g, " ")} (day ${step.delayDaysMin}+)`,
          )
      : (input.preview?.steps ?? []).map(
          (step) =>
            `Step ${step.step_order}: ${step.channel.replace(/_/g, " ")} (${step.scheduled_window_label})`,
        )

  if (suggested_sequence_structure.length === 0) {
    suggested_sequence_structure = ["Configure sequence pattern in Sequence Builder before campaign approval"]
  }

  const timing_recommendations: string[] = []
  if (input.preview?.steps.length) {
    for (const step of input.preview.steps) {
      if (step.timing_gap_days > 0) {
        timing_recommendations.push(`Step ${step.step_order}: ${step.scheduled_window_label} (${step.timing_gap_days}d gap)`)
      }
    }
  }
  for (const policy of input.policies.slice(0, 3)) {
    timing_recommendations.push(`Follow-up (${policy.policy_type.replace(/_/g, " ")}): ${policy.follow_up_window.label}`)
  }
  if (timing_recommendations.length === 0) {
    timing_recommendations.push("Default cadence: 2–4 day gaps between touches — operator confirms final timing")
  }

  const required_assets = [
    ...(input.readiness?.missing_assets ?? []),
    ...(input.readiness?.required_human_actions ?? []),
  ].slice(0, 6)

  const hasPlaybook = patternSteps.some((s) => s.playbookCategory)
  const personalization_coverage: CampaignBuilderWizardConfiguration["personalization_coverage"] =
    hasPlaybook && (input.readiness?.missing_assets ?? []).length === 0
      ? "covered"
      : hasPlaybook || (input.readiness?.missing_assets ?? []).length <= 1
        ? "partial"
        : "missing"

  return {
    recommended_channels,
    suggested_pattern_id: pattern?.id ?? input.preview?.pattern_id ?? null,
    suggested_pattern_label: pattern?.label ?? input.preview?.pattern_label ?? null,
    suggested_sequence_structure,
    timing_recommendations: timing_recommendations.slice(0, 8),
    required_assets: required_assets.length ? required_assets : ["Review campaign readiness assets"],
    personalization_coverage,
  }
}

function buildWizardSteps(input: {
  readiness: CampaignReadinessAssessment | null | undefined
  preview: SequencePreview | null | undefined
  policies: SmartFollowUpPolicy[]
  interventions: HumanIntervention[]
  configuration: CampaignBuilderWizardConfiguration
  lead_id?: string | null
}): CampaignBuilderWizardStep[] {
  const leadQuery = input.lead_id ? `?leadId=${encodeURIComponent(input.lead_id)}` : ""

  const stepBuilders: Record<CampaignBuilderWizardStepId, () => CampaignBuilderWizardStep> = {
    readiness_review: () => {
      const status = input.readiness?.readiness_status
      let stepStatus: CampaignBuilderWizardStep["status"] = "pending"
      if (status === "ready") stepStatus = "complete"
      else if (status === "not_ready") stepStatus = "blocked"
      else if (status === "partially_ready") stepStatus = "needs_review"
      return {
        step_id: "readiness_review",
        label: CAMPAIGN_BUILDER_STEP_LABELS.readiness_review,
        status: stepStatus,
        summary: input.readiness
          ? `Readiness: ${status} (score ${input.readiness.readiness_score})`
          : "No readiness assessment — run campaign readiness for lead context",
        details: (input.readiness?.blockers ?? []).map((b) => b.message).slice(0, 4),
        related_href: `/admin/growth/command${leadQuery}`,
      }
    },
    sequence_selection: () => {
      const previewStatus = input.preview?.sequence_status
      let stepStatus: CampaignBuilderWizardStep["status"] = "pending"
      if (previewStatus === "ready_for_human_approval") stepStatus = "complete"
      else if (previewStatus === "blocked") stepStatus = "blocked"
      else if (previewStatus === "needs_review") stepStatus = "needs_review"
      return {
        step_id: "sequence_selection",
        label: CAMPAIGN_BUILDER_STEP_LABELS.sequence_selection,
        status: stepStatus,
        summary: input.configuration.suggested_pattern_label
          ? `Suggested pattern: ${input.configuration.suggested_pattern_label}`
          : "Select sequence pattern in Sequence Builder",
        details: input.configuration.suggested_sequence_structure.slice(0, 4),
        related_href: input.preview?.related_href ?? `/admin/growth/sequences/builder${leadQuery}`,
      }
    },
    channel_planning: () => {
      const blocked = (input.preview?.steps ?? []).filter((s) => s.channel_status === "blocked").length
      const stepStatus: CampaignBuilderWizardStep["status"] =
        blocked > 0 ? "blocked" : input.configuration.recommended_channels.length > 0 ? "complete" : "needs_review"
      return {
        step_id: "channel_planning",
        label: CAMPAIGN_BUILDER_STEP_LABELS.channel_planning,
        status: stepStatus,
        summary: `Recommended channels: ${input.configuration.recommended_channels.join(", ") || "none eligible"}`,
        details: (input.readiness?.missing_channels ?? []).map((c) => `Missing: ${c.replace(/_/g, " ")}`),
        related_href: `/admin/growth/sequences/builder${leadQuery}`,
      }
    },
    follow_up_alignment: () => {
      const urgent = input.policies.filter((p) => p.priority === "urgent" || p.priority === "high").length
      const stepStatus: CampaignBuilderWizardStep["status"] =
        urgent > 0 ? "needs_review" : input.policies.length > 0 ? "complete" : "pending"
      return {
        step_id: "follow_up_alignment",
        label: CAMPAIGN_BUILDER_STEP_LABELS.follow_up_alignment,
        status: stepStatus,
        summary: `${input.policies.length} follow-up polic${input.policies.length === 1 ? "y" : "ies"} aligned`,
        details: input.policies.slice(0, 3).map((p) => p.title),
        related_href: `/admin/growth/command${leadQuery}`,
      }
    },
    playbook_knowledge: () => {
      const coverage = input.configuration.personalization_coverage
      const stepStatus: CampaignBuilderWizardStep["status"] =
        coverage === "covered" ? "complete" : coverage === "partial" ? "needs_review" : "blocked"
      return {
        step_id: "playbook_knowledge",
        label: CAMPAIGN_BUILDER_STEP_LABELS.playbook_knowledge,
        status: stepStatus,
        summary: `Personalization coverage: ${coverage}`,
        details: input.configuration.required_assets.slice(0, 3),
        related_href: `/admin/growth/knowledge${leadQuery}`,
      }
    },
    approval_checklist: () => {
      const blockedInterventions = input.interventions.filter(
        (i) => i.intervention_type === "campaign_blocked" || i.intervention_type === "risk_detected",
      ).length
      const stepStatus: CampaignBuilderWizardStep["status"] =
        blockedInterventions > 0 ? "blocked" : input.interventions.length > 0 ? "needs_review" : "pending"
      return {
        step_id: "approval_checklist",
        label: CAMPAIGN_BUILDER_STEP_LABELS.approval_checklist,
        status: stepStatus,
        summary: "Human approval required before any campaign launch or enrollment",
        details: input.interventions.slice(0, 3).map((i) => i.title),
        related_href: `/admin/growth/command${leadQuery}`,
      }
    },
  }

  return CAMPAIGN_BUILDER_STEP_IDS.map((id) => stepBuilders[id]())
}

function buildRisks(input: {
  readiness: CampaignReadinessAssessment | null | undefined
  preview: SequencePreview | null | undefined
  policies: SmartFollowUpPolicy[]
  interventions: HumanIntervention[]
  pattern: GrowthSequencePattern | null
}): CampaignBuilderWizardRisk[] {
  const risks: CampaignBuilderWizardRisk[] = [
    {
      risk_id: "risk_planning_only",
      severity: "medium",
      title: "Configuration and planning only",
      description: "Campaign Builder Wizard does not launch, enroll, or send. Operator must approve all actions.",
      source: "campaign_builder_engine",
    },
  ]

  for (const blocker of input.readiness?.blockers.filter((b) => b.severity === "critical") ?? []) {
    risks.push({
      risk_id: `risk_readiness_${blocker.blocker_id}`,
      severity: "critical",
      title: blocker.message,
      description: blocker.resolution_hint,
      source: "campaign_readiness",
    })
  }

  for (const risk of input.preview?.risks.filter((r) => r.severity === "critical" || r.severity === "high") ?? []) {
    risks.push({
      risk_id: `risk_preview_${risk.risk_id}`,
      severity: risk.severity,
      title: risk.title,
      description: risk.description,
      source: "sequence_preview",
    })
  }

  for (const policy of input.policies.filter((p) => p.priority === "urgent")) {
    risks.push({
      risk_id: `risk_policy_${policy.policy_id}`,
      severity: "high",
      title: policy.title,
      description: policy.description,
      source: "follow_up_policies",
    })
  }

  for (const intervention of input.interventions.filter(
    (i) => i.intervention_type === "campaign_blocked" || i.intervention_type === "risk_detected",
  )) {
    risks.push({
      risk_id: `risk_intervention_${intervention.intervention_id}`,
      severity: "high",
      title: intervention.title,
      description: intervention.description,
      source: "human_interventions",
    })
  }

  if (input.pattern && listVoiceDropStepsMissingCampaign(input.pattern.steps).length > 0) {
    risks.push({
      risk_id: `risk_vd_${input.pattern.id}`,
      severity: "critical",
      title: "Voice Drop campaign linkage incomplete",
      description: "Link approved Voice Drop campaigns before campaign approval.",
      source: "voice_drop_readiness",
    })
  }

  return risks.slice(0, 14)
}

function buildApprovalRequirements(
  readiness: CampaignReadinessAssessment | null | undefined,
  interventions: HumanIntervention[],
): CampaignBuilderWizardApprovalRequirement[] {
  const requirements: CampaignBuilderWizardApprovalRequirement[] = [
    {
      requirement_id: "human_operator_review",
      label: "Human operator review",
      description: "Operator must complete wizard review before any campaign execution.",
      status: "pending",
    },
    {
      requirement_id: "no_autonomous_launch",
      label: "No autonomous launch",
      description: "Campaign configuration does not trigger enrollment or outreach automatically.",
      status: "satisfied",
    },
  ]

  for (const approval of readiness?.required_approvals ?? []) {
    requirements.push({
      requirement_id: `readiness_${approval.slice(0, 20).replace(/\s+/g, "_")}`,
      label: approval,
      description: "From campaign readiness assessment.",
      status: readiness?.readiness_status === "ready" ? "satisfied" : "pending",
    })
  }

  if (interventions.some((i) => i.intervention_type === "approval_required")) {
    requirements.push({
      requirement_id: "intervention_approval",
      label: "Pending human intervention approval",
      description: "Resolve approval-required interventions before campaign launch.",
      status: "blocked",
    })
  }

  return requirements.slice(0, 8)
}

function buildRecommendations(wizard: Pick<CampaignBuilderWizard, "wizard_id" | "related_href" | "wizard_status">): CampaignBuilderWizardRecommendation[] {
  return [
    {
      recommendation_id: `rec_open_${wizard.wizard_id}`,
      title: "Open related campaign assets",
      description: `Review ${CAMPAIGN_BUILDER_STATUS_LABELS[wizard.wizard_status].toLowerCase()} configuration across readiness, sequences, and playbooks.`,
      priority: "medium",
      related_href: wizard.related_href,
      action_type: "open_related",
    },
    {
      recommendation_id: `rec_review_${wizard.wizard_id}`,
      title: "Mark wizard reviewed",
      description: "Confirm operator has reviewed all wizard steps — no autonomous execution.",
      priority: "high",
      related_href: wizard.related_href,
      action_type: "mark_reviewed",
    },
  ]
}

function computeConfigurationScore(
  steps: CampaignBuilderWizardStep[],
  configuration: CampaignBuilderWizardConfiguration,
  readiness: CampaignReadinessAssessment | null | undefined,
  risks: CampaignBuilderWizardRisk[],
): number {
  let score = 40
  score += (readiness?.readiness_score ?? 0) * 0.3
  score += steps.filter((s) => s.status === "complete").length * 8
  score -= steps.filter((s) => s.status === "blocked").length * 12
  score += configuration.recommended_channels.length * 4
  score -= risks.filter((r) => r.severity === "critical").length * 15
  if (configuration.personalization_coverage === "covered") score += 10
  if (configuration.personalization_coverage === "missing") score -= 10
  return Math.max(0, Math.min(100, Math.round(score)))
}

function resolveWizardStatus(
  steps: CampaignBuilderWizardStep[],
  risks: CampaignBuilderWizardRisk[],
  readiness: CampaignReadinessAssessment | null | undefined,
): CampaignBuilderWizardStatus {
  if (!readiness && steps.every((s) => s.status === "pending")) return "draft"
  if (risks.some((r) => r.severity === "critical")) return "blocked"
  if (readiness?.readiness_status === "not_ready") return "blocked"
  if (steps.some((s) => s.status === "blocked")) return "blocked"
  if (steps.some((s) => s.status === "needs_review") || risks.some((r) => r.severity === "high")) {
    return "needs_review"
  }
  if (steps.filter((s) => s.status === "complete").length >= 4) return "ready_for_human_approval"
  return "needs_review"
}

function buildSingleWizard(input: {
  lead_id?: string | null
  company_name?: string | null
  pattern_id?: string | null
  readiness: CampaignReadinessAssessment | null | undefined
  previews: SequencePreview[]
  policies: SmartFollowUpPolicy[]
  interventions: HumanIntervention[]
  patterns: GrowthSequencePattern[]
}): CampaignBuilderWizard {
  const preview =
    (input.pattern_id ? input.previews.find((p) => p.pattern_id === input.pattern_id) : null) ??
    input.previews[0] ??
    null
  const pattern = pickSuggestedPattern(input.patterns, preview, input.pattern_id)
  const configuration = buildConfiguration({
    readiness: input.readiness,
    preview,
    policies: input.policies,
    pattern,
  })
  const steps = buildWizardSteps({
    readiness: input.readiness,
    preview,
    policies: input.policies,
    interventions: input.interventions,
    configuration,
    lead_id: input.lead_id,
  })
  const risks = buildRisks({
    readiness: input.readiness,
    preview,
    policies: input.policies,
    interventions: input.interventions,
    pattern,
  })
  const approval_requirements = buildApprovalRequirements(input.readiness, input.interventions)
  const configuration_score = computeConfigurationScore(steps, configuration, input.readiness, risks)
  const wizard_status = resolveWizardStatus(steps, risks, input.readiness)

  const wizard_id = `wizard:${input.lead_id ?? "global"}:${pattern?.id ?? preview?.pattern_id ?? "default"}`
  const leadQuery = input.lead_id ? `?leadId=${encodeURIComponent(input.lead_id)}` : ""

  const wizard: CampaignBuilderWizard = {
    qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
    wizard_id,
    wizard_status,
    configuration_score,
    configuration,
    steps,
    recommendations: [],
    risks,
    approval_requirements,
    review_status: "pending",
    lead_id: input.lead_id ?? null,
    company_name: input.company_name ?? null,
    related_href: `/admin/growth/command${leadQuery}`,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    generated_at: new Date().toISOString(),
  }

  wizard.recommendations = buildRecommendations(wizard)
  return wizard
}

/**
 * Deterministic campaign builder wizard — configuration and planning only.
 */
export function generateCampaignBuilderWizard(input: {
  lead_id?: string | null
  company_name?: string | null
  pattern_id?: string | null
  campaign_readiness?: CampaignReadinessAssessment | null
  sequence_previews?: SequencePreview[]
  follow_up_policies?: SmartFollowUpPolicy[]
  interventions?: HumanIntervention[]
  patterns?: GrowthSequencePattern[]
  filter?: CampaignBuilderFilter
  limit?: number
}): CampaignBuilderWizardResponse {
  const patterns = input.patterns ?? []
  const previews = input.sequence_previews ?? []
  const policies = input.follow_up_policies ?? []
  const interventions = input.interventions ?? []

  const wizards: CampaignBuilderWizard[] = []

  if (input.pattern_id) {
    wizards.push(
      buildSingleWizard({
        lead_id: input.lead_id,
        company_name: input.company_name,
        pattern_id: input.pattern_id,
        readiness: input.campaign_readiness,
        previews,
        policies,
        interventions,
        patterns,
      }),
    )
  } else if (previews.length > 0) {
    for (const preview of previews.slice(0, input.limit ?? 10)) {
      wizards.push(
        buildSingleWizard({
          lead_id: input.lead_id,
          company_name: input.company_name,
          pattern_id: preview.pattern_id,
          readiness: input.campaign_readiness,
          previews,
          policies,
          interventions,
          patterns,
        }),
      )
    }
  } else {
    wizards.push(
      buildSingleWizard({
        lead_id: input.lead_id,
        company_name: input.company_name,
        pattern_id: null,
        readiness: input.campaign_readiness,
        previews,
        policies,
        interventions,
        patterns,
      }),
    )
  }

  const filtered = filterCampaignBuilderWizards(wizards, input.filter ?? "all")
  const ranked = rankCampaignBuilderWizards(filtered)
  const limited = ranked.slice(0, input.limit ?? 10)

  return {
    qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: limited.length,
    blocked_count: limited.filter((w) => w.wizard_status === "blocked").length,
    needs_review_count: limited.filter((w) => w.wizard_status === "needs_review").length,
    ready_count: limited.filter((w) => w.wizard_status === "ready_for_human_approval").length,
    status_counts: countByStatus(limited),
    wizards: limited,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
