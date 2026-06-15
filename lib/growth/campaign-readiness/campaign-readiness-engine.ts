/** Phase GS-2E — Deterministic Campaign Readiness Engine (client-safe). */

import {
  CAMPAIGN_READINESS_DIMENSION_LABELS,
  CAMPAIGN_READINESS_QA_MARKER,
  type CampaignReadinessAssessment,
  type CampaignReadinessBlocker,
  type CampaignReadinessDimension,
  type CampaignReadinessDimensionId,
  type CampaignReadinessDimensionLevel,
  type CampaignReadinessRecommendation,
  type CampaignReadinessStatus,
  type CampaignReadinessSubjectType,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"
import type { GrowthProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { ProspectSearchSequenceReadiness } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"

const DIMENSION_WEIGHTS: Record<CampaignReadinessDimensionId, number> = {
  company_intelligence: 0.14,
  decision_maker_coverage: 0.14,
  verified_contact_channels: 0.12,
  personalization_assets: 0.1,
  knowledge_assets: 0.08,
  sequence_assets: 0.1,
  compliance_requirements: 0.12,
  channel_readiness: 0.12,
  required_approvals: 0.08,
}

function levelFromScore(score: number): CampaignReadinessDimensionLevel {
  if (score >= 80) return "ready"
  if (score >= 50) return "partial"
  if (score > 0) return "blocked"
  return "missing"
}

function dim(
  dimension_id: CampaignReadinessDimensionId,
  score: number,
  summary: string,
  evidence: string[],
  gaps: string[],
): CampaignReadinessDimension {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  return {
    dimension_id,
    label: CAMPAIGN_READINESS_DIMENSION_LABELS[dimension_id],
    score: clamped,
    level: levelFromScore(clamped),
    summary,
    evidence,
    gaps,
  }
}

function resolveReadinessStatus(
  score: number,
  blockers: CampaignReadinessBlocker[],
): CampaignReadinessStatus {
  if (blockers.some((b) => b.severity === "critical")) return "not_ready"
  if (score >= 80) return "ready"
  if (score >= 50) return "partially_ready"
  return "not_ready"
}

export type CampaignReadinessEngineInput = {
  assessment_id: string
  subject_type: CampaignReadinessSubjectType
  subject_ref: string
  lead_id?: string | null
  company_name?: string | null
  execution_run_id?: string | null
  engine_readiness?: GrowthProspectSearchEngineReadiness | null
  sequence_readiness?: ProspectSearchSequenceReadiness | null
  knowledge_document_count?: number
  has_account_playbook?: boolean
  sequence_pattern_count?: number
  voice_drop_pattern_ready?: boolean
  is_suppressed?: boolean
  compliance_orchestration_enabled?: boolean
  human_approval_pending_count?: number
  execution_plan_approved?: boolean
  missing_channels?: string[]
}

function buildCompanyIntelligenceDimension(
  engine: GrowthProspectSearchEngineReadiness | null | undefined,
): CampaignReadinessDimension {
  const score = engine?.company_intelligence.score ?? 0
  const gaps = engine?.missing_intelligence_categories ?? []
  return dim(
    "company_intelligence",
    score,
    engine?.company_intelligence.summary ?? "Company intelligence not evaluated",
    engine?.company_intelligence.evidence ?? [],
    gaps.length ? gaps : engine?.company_intelligence.reasons ?? [],
  )
}

function buildDecisionMakerDimension(
  engine: GrowthProspectSearchEngineReadiness | null | undefined,
): CampaignReadinessDimension {
  const score = engine?.committee.score ?? 0
  const gaps = engine?.missing_critical_committee_roles ?? []
  return dim(
    "decision_maker_coverage",
    score,
    engine?.committee.summary ?? "Buying committee not evaluated",
    engine?.committee.evidence ?? [],
    gaps.length ? gaps : engine?.committee.reasons ?? [],
  )
}

function buildVerifiedChannelsDimension(
  engine: GrowthProspectSearchEngineReadiness | null | undefined,
): CampaignReadinessDimension {
  const score = engine?.channel.score ?? 0
  return dim(
    "verified_contact_channels",
    score,
    engine?.channel.summary ?? "Verified channels not evaluated",
    engine?.channel.evidence ?? [],
    engine?.channel.reasons ?? [],
  )
}

function buildPersonalizationDimension(input: CampaignReadinessEngineInput): CampaignReadinessDimension {
  let score = 0
  const evidence: string[] = []
  const gaps: string[] = []

  if (input.has_account_playbook) {
    score += 45
    evidence.push("Account playbook available for personalization")
  } else {
    gaps.push("No account playbook linked")
  }

  const reachable = input.engine_readiness?.reachable_decision_maker_count ?? 0
  if (reachable > 0) {
    score += 35
    evidence.push(`${reachable} reachable decision maker(s) for personalized outreach`)
  } else {
    gaps.push("No reachable verified decision makers for personalization")
  }

  if ((input.engine_readiness?.contactability.score ?? 0) >= 50) {
    score += 20
    evidence.push("Contactability evidence supports personalization")
  } else {
    gaps.push("Insufficient contactability for personalized messaging")
  }

  return dim(
    "personalization_assets",
    score,
    input.has_account_playbook && reachable > 0
      ? "Personalization assets available"
      : "Personalization assets incomplete",
    evidence,
    gaps,
  )
}

function buildKnowledgeDimension(input: CampaignReadinessEngineInput): CampaignReadinessDimension {
  const count = input.knowledge_document_count ?? 0
  let score = 0
  const evidence: string[] = []
  const gaps: string[] = []

  if (count >= 10) {
    score = 100
    evidence.push(`${count} knowledge documents available`)
  } else if (count >= 3) {
    score = 70
    evidence.push(`${count} knowledge documents available`)
  } else if (count >= 1) {
    score = 40
    evidence.push(`${count} knowledge document(s) available`)
    gaps.push("Expand knowledge base for richer messaging references")
  } else {
    gaps.push("No knowledge documents ingested")
  }

  return dim(
    "knowledge_assets",
    score,
    count > 0 ? "Knowledge assets present" : "Knowledge assets missing",
    evidence,
    gaps,
  )
}

function buildSequenceAssetsDimension(input: CampaignReadinessEngineInput): CampaignReadinessDimension {
  let score = 0
  const evidence: string[] = []
  const gaps: string[] = []

  const patternCount = input.sequence_pattern_count ?? 0
  if (patternCount > 0) {
    score += 50
    evidence.push(`${patternCount} sequence pattern(s) configured`)
  } else {
    gaps.push("No sequence patterns configured")
  }

  if (input.voice_drop_pattern_ready) {
    score += 30
    evidence.push("Voice Drop sequence pattern operator-ready")
  } else if (patternCount > 0) {
    gaps.push("Voice Drop steps missing approved campaign linkage")
  }

  const seqScore = input.sequence_readiness?.readiness_score ?? 0
  if (seqScore >= 60) {
    score += 20
    evidence.push(`Account sequence readiness score ${seqScore}/100`)
  } else if (input.sequence_readiness) {
    gaps.push(...(input.sequence_readiness.missing_requirements ?? []).slice(0, 2))
  }

  return dim(
    "sequence_assets",
    Math.min(100, score),
    patternCount > 0 ? "Sequence assets partially configured" : "Sequence assets missing",
    evidence,
    gaps,
  )
}

function buildComplianceDimension(input: CampaignReadinessEngineInput): CampaignReadinessDimension {
  let score = 100
  const evidence: string[] = []
  const gaps: string[] = []

  if (input.is_suppressed) {
    score = 0
    gaps.push("Account or contact suppression active — outreach blocked")
  } else {
    evidence.push("No active suppression flags")
  }

  if (input.compliance_orchestration_enabled) {
    evidence.push("Compliance orchestration enabled")
  } else {
    score = Math.min(score, 55)
    gaps.push("Compliance orchestration not confirmed for multichannel outreach")
  }

  return dim(
    "compliance_requirements",
    score,
    input.is_suppressed ? "Compliance blocked" : "Compliance requirements evaluated",
    evidence,
    gaps,
  )
}

function buildChannelReadinessDimension(
  input: CampaignReadinessEngineInput,
): CampaignReadinessDimension {
  const seq = input.sequence_readiness
  let score = seq?.readiness_score ?? input.engine_readiness?.channel.score ?? 0
  const evidence: string[] = []
  const gaps: string[] = []

  if (seq?.safest_recommended_channel && seq.safest_recommended_channel !== "blocked") {
    evidence.push(`Safest channel: ${seq.safest_recommended_channel}`)
  }
  if (seq?.readiness_state === "ready" || seq?.readiness_state === "ready_with_review") {
    score = Math.max(score, 75)
    evidence.push(`Sequence readiness state: ${seq.readiness_state}`)
  } else if (seq) {
    gaps.push(...seq.blockers.slice(0, 2))
    gaps.push(...seq.missing_requirements.slice(0, 2))
  }

  const missingChannels = input.missing_channels ?? []
  if (missingChannels.length) {
    score = Math.min(score, 45)
    gaps.push(`Missing channels: ${missingChannels.join(", ")}`)
  } else if ((input.engine_readiness?.channel.score ?? 0) >= 40) {
    evidence.push("Verified outreach channels present")
  }

  return dim(
    "channel_readiness",
    score,
    seq?.suggested_sequence_type ?? "Channel readiness not fully evaluated",
    evidence,
    [...new Set(gaps)],
  )
}

function buildApprovalsDimension(input: CampaignReadinessEngineInput): CampaignReadinessDimension {
  let score = 100
  const evidence: string[] = []
  const gaps: string[] = []

  const pending = input.human_approval_pending_count ?? 0
  if (pending > 0) {
    score -= Math.min(60, pending * 20)
    gaps.push(`${pending} human approval(s) pending in execution queue`)
  } else {
    evidence.push("No pending human approvals in execution queue")
  }

  if (input.execution_plan_approved === false) {
    score = Math.min(score, 40)
    gaps.push("Prospect discovery execution plan not approved")
  } else if (input.execution_plan_approved) {
    evidence.push("Prospect discovery execution plan approved")
  }

  return dim(
    "required_approvals",
    score,
    pending > 0 ? "Human approvals required before campaign launch" : "Approval gates satisfied",
    evidence,
    gaps,
  )
}

function buildBlockers(
  dimensions: CampaignReadinessDimension[],
  input: CampaignReadinessEngineInput,
  leadHref: string | null,
): CampaignReadinessBlocker[] {
  const blockers: CampaignReadinessBlocker[] = []

  if (input.is_suppressed) {
    blockers.push({
      blocker_id: "compliance_suppressed",
      dimension_id: "compliance_requirements",
      severity: "critical",
      message: "Account or contact is suppressed — campaign outreach blocked",
      resolution_hint: "Resolve suppression before assessing campaign readiness",
      related_asset_href: leadHref,
    })
  }

  for (const dimension of dimensions) {
    if (dimension.level === "missing" || (dimension.level === "blocked" && dimension.score < 30)) {
      blockers.push({
        blocker_id: `blocker_${dimension.dimension_id}`,
        dimension_id: dimension.dimension_id,
        severity: dimension.score === 0 ? "critical" : "warning",
        message: dimension.gaps[0] ?? `${dimension.label} incomplete`,
        resolution_hint: dimension.summary,
        related_asset_href: leadHref,
      })
    }
  }

  return blockers
}

function buildRecommendations(
  dimensions: CampaignReadinessDimension[],
  input: CampaignReadinessEngineInput,
  leadHref: string | null,
): CampaignReadinessRecommendation[] {
  const recommendations: CampaignReadinessRecommendation[] = []

  for (const dimension of dimensions) {
    if (dimension.level === "ready") continue

    const priority =
      dimension.level === "missing" || dimension.score < 30
        ? "high"
        : dimension.score < 60
          ? "medium"
          : "low"

    for (const gap of dimension.gaps.slice(0, 2)) {
      recommendations.push({
        recommendation_id: `rec_${dimension.dimension_id}_${recommendations.length}`,
        dimension_id: dimension.dimension_id,
        priority,
        title: `Address ${dimension.label.toLowerCase()} gap`,
        description: gap,
        related_asset_href: resolveAssetHref(dimension.dimension_id, input, leadHref),
        action_type: "open_asset",
      })
    }
  }

  if ((input.human_approval_pending_count ?? 0) > 0) {
    recommendations.push({
      recommendation_id: "rec_pending_approvals",
      dimension_id: "required_approvals",
      priority: "high",
      title: "Review pending human approvals",
      description: `${input.human_approval_pending_count} approval(s) require operator review before campaign execution.`,
      related_asset_href: "/admin/growth/outreach/approval",
      action_type: "view_details",
    })
  }

  return recommendations.slice(0, 12)
}

function resolveAssetHref(
  dimensionId: CampaignReadinessDimensionId,
  input: CampaignReadinessEngineInput,
  leadHref: string | null,
): string | null {
  switch (dimensionId) {
    case "company_intelligence":
      return leadHref ? `${leadHref}#company-intelligence` : "/admin/growth/search"
    case "decision_maker_coverage":
      return leadHref ?? "/admin/growth/search"
    case "verified_contact_channels":
      return "/admin/growth/search"
    case "personalization_assets":
      return "/admin/growth/revenue-execution"
    case "knowledge_assets":
      return "/admin/growth/knowledge"
    case "sequence_assets":
      return "/admin/growth/sequences/builder"
    case "compliance_requirements":
      return "/admin/growth/providers/compliance"
    case "channel_readiness":
      return "/admin/growth/multichannel"
    case "required_approvals":
      return "/admin/growth/outreach/approval"
    default:
      return leadHref
  }
}

function collectMissingAssets(dimensions: CampaignReadinessDimension[]): string[] {
  const assets: string[] = []
  for (const dimension of dimensions) {
    if (dimension.level === "missing" || dimension.level === "blocked") {
      assets.push(dimension.label)
    }
    for (const gap of dimension.gaps) {
      if (/playbook|knowledge|sequence|intelligence|committee|channel|approval/i.test(gap)) {
        assets.push(gap)
      }
    }
  }
  return [...new Set(assets)].slice(0, 10)
}

function collectRequiredApprovals(input: CampaignReadinessEngineInput): string[] {
  const approvals: string[] = []
  if ((input.human_approval_pending_count ?? 0) > 0) {
    approvals.push(`${input.human_approval_pending_count} human execution approval(s)`)
  }
  if (input.execution_plan_approved === false) {
    approvals.push("Prospect discovery execution plan approval")
  }
  if (!input.compliance_orchestration_enabled) {
    approvals.push("Compliance orchestration confirmation")
  }
  return approvals
}

function collectRequiredHumanActions(
  blockers: CampaignReadinessBlocker[],
  recommendations: CampaignReadinessRecommendation[],
): string[] {
  const actions = new Set<string>()
  for (const blocker of blockers) {
    actions.add(`Resolve: ${blocker.message}`)
  }
  for (const rec of recommendations.filter((r) => r.priority === "high").slice(0, 4)) {
    actions.add(rec.title)
  }
  actions.add("Review campaign readiness assessment before any outreach")
  return [...actions]
}

/**
 * Deterministic campaign readiness evaluation — no LLMs, embeddings, or vector DB.
 */
export function evaluateCampaignReadiness(input: CampaignReadinessEngineInput): CampaignReadinessAssessment {
  const leadHref = input.lead_id ? `/admin/growth/leads/${input.lead_id}` : null

  const dimensions: CampaignReadinessDimension[] = [
    buildCompanyIntelligenceDimension(input.engine_readiness),
    buildDecisionMakerDimension(input.engine_readiness),
    buildVerifiedChannelsDimension(input.engine_readiness),
    buildPersonalizationDimension(input),
    buildKnowledgeDimension(input),
    buildSequenceAssetsDimension(input),
    buildComplianceDimension(input),
    buildChannelReadinessDimension(input),
    buildApprovalsDimension(input),
  ]

  const readiness_score = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (DIMENSION_WEIGHTS[d.dimension_id] ?? 0), 0),
  )

  const blockers = buildBlockers(dimensions, input, leadHref)
  const recommendations = buildRecommendations(dimensions, input, leadHref)
  const readiness_status = resolveReadinessStatus(readiness_score, blockers)

  const missing_channels =
    input.missing_channels ??
    (input.engine_readiness?.channel.score !== undefined && input.engine_readiness.channel.score < 40
      ? ["verified_email", "verified_phone"].filter((ch) => {
          const evidence = input.engine_readiness?.channel.evidence.join(" ") ?? ""
          if (ch === "verified_email") return !evidence.includes("verified email")
          return !evidence.includes("verified phone")
        })
      : [])

  return {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: input.assessment_id,
    subject_type: input.subject_type,
    subject_ref: input.subject_ref,
    lead_id: input.lead_id ?? null,
    company_name: input.company_name ?? null,
    execution_run_id: input.execution_run_id ?? null,
    generated_at: new Date().toISOString(),
    readiness_score,
    readiness_status,
    dimensions,
    blockers,
    recommendations,
    missing_assets: collectMissingAssets(dimensions),
    missing_channels,
    required_approvals: collectRequiredApprovals(input),
    required_human_actions: collectRequiredHumanActions(blockers, recommendations),
    review_status: "pending",
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
}
