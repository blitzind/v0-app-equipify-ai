/**
 * GE-AIOS-REVENUE-STRATEGY-1A — Autonomous sales strategy intelligence (client-safe).
 * VP-of-Sales judgment before outreach: readiness, entry, timing, channel, committee.
 * No new persistence. Extends Conversation Intelligence inside Sales Strategy Brief.
 */

import type { GrowthOutreachConsultantDiscoveryIntelligence } from "@/lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import type {
  GrowthOutreachConversationRisk,
  GrowthOutreachEvidenceIntelligence,
  GrowthOutreachPersonaInference,
} from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type {
  GrowthOutreachRelationshipStage,
  GrowthOutreachSellerTruth,
} from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { GrowthOutreachSellerKnowledgeQuality } from "@/lib/growth/business-profile/equipify-master-knowledge-quality"
import {
  relationshipAssessmentSuggestsDelay,
  type GrowthOutreachRelationshipAssessment,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import { applyInstitutionalConfidenceBoost } from "@/lib/growth/aios/growth/growth-institutional-learning-1a"
import type { GrowthInstitutionalSalesIntelligence } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"

export const GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER =
  "ge-aios-revenue-strategy-1a-autonomous-sales-strategy-intelligence-v1" as const

export type RevenueStrategyRecommendation = "proceed" | "delay" | "research" | "disqualify"

export type RevenueStrategyTimingDecision =
  | "contact_now"
  | "wait"
  | "research_further"
  | "wait_for_signal"

export type RevenueStrategyEntryRole =
  | "service_director"
  | "operations_leader"
  | "coo"
  | "president"
  | "owner"
  | "ceo"
  | "dispatch"
  | "finance"
  | "technician_leadership"
  | "regional_manager"
  | "sales"
  | "customer_success"

export type RevenueStrategyEntryPoint = {
  role: RevenueStrategyEntryRole
  label: string
  matchedTitle: string | null
  score: number
  rationale: string
}

export type RevenueStrategyCommitteeRole =
  | "primary_champion"
  | "economic_buyer"
  | "technical_approver"
  | "operational_influencer"
  | "potential_blocker"
  | "missing_stakeholder"

export type RevenueStrategyCommitteeStakeholder = {
  role: RevenueStrategyCommitteeRole
  label: string
  present: boolean
  recommendation: string | null
}

export type RevenueStrategyThreadPlan = {
  contactName: string | null
  contactTitle: string | null
  conversationAngle: string
  sequenceApproach: string
  priority: number
}

export type RevenueStrategyChannelPlan = {
  primaryChannel: "email" | "linkedin" | "phone" | "video" | "combination" | "none"
  rationale: string
  backupChannel: string | null
}

export type RevenueStrategySequenceApproach =
  | "operational_insight"
  | "curiosity"
  | "educational"
  | "relationship"
  | "referral"
  | "social"
  | "video"
  | "phone"

export type RevenueStrategySequencePlan = {
  approach: RevenueStrategySequenceApproach
  rationale: string
  steps: string[]
}

export type RevenueStrategyRisk = {
  key: string
  label: string
  severity: "high" | "medium" | "low"
  present: boolean
}

export type RevenueStrategyCompetitivePosture = {
  likelyIncumbent: string | null
  replacementDifficulty: "high" | "medium" | "low"
  competitiveWedge: string | null
  trustBarriers: string[]
  migrationConcerns: string[]
}

export type RevenueStrategyOpportunityReadiness = {
  businessUnderstanding: number
  decisionMakerConfidence: number
  relationshipMaturity: number
  evidenceQuality: number
  businessPressure: number
  buyingTrigger: number
  operationalUrgency: number
  timingConfidence: number
  successConfidence: number
  overall: number
}

export type GrowthOutreachRevenueStrategyIntelligence = {
  recommendation: RevenueStrategyRecommendation
  recommendationSummary: string
  vpSalesJudgment: string
  opportunityReadiness: RevenueStrategyOpportunityReadiness
  timingDecision: RevenueStrategyTimingDecision
  timingRationale: string
  timingSignals: string[]
  primaryEntryPoint: RevenueStrategyEntryPoint
  backupEntryPoint: RevenueStrategyEntryPoint | null
  committeeStrategy: "single_thread" | "multi_thread"
  committeeStakeholders: RevenueStrategyCommitteeStakeholder[]
  threadPlan: RevenueStrategyThreadPlan[]
  channelPlan: RevenueStrategyChannelPlan
  sequencePlan: RevenueStrategySequencePlan
  risks: RevenueStrategyRisk[]
  competitivePosture: RevenueStrategyCompetitivePosture
  confidenceLevel: "high" | "medium" | "low"
  confidenceScore: number
  conversationApproach: string
  delayReasons: string[]
  researchGaps: string[]
}

export type RevenueStrategyBuyingCommitteeSnapshot = {
  hasVerifiedCommittee: boolean
  discoveryPending: boolean
  discoveryFailed: boolean
  singleThreadRisk: boolean
  coverageScore: number
  rolesPresent: string[]
  rolesMissing: string[]
  verifiedMemberCount: number
}

export type RevenueStrategyDecisionMakerCandidate = {
  name: string | null
  title: string | null
  isPrimary?: boolean
}

const ENTRY_ROLE_PATTERNS: Array<{
  role: RevenueStrategyEntryRole
  label: string
  pattern: RegExp
  operationalEntryBoost: number
  executiveEntryBoost: number
}> = [
  {
    role: "service_director",
    label: "Service Director",
    pattern: /\b(director of service|service director|vp service|vice president service|head of service)\b/i,
    operationalEntryBoost: 0.92,
    executiveEntryBoost: 0.55,
  },
  {
    role: "operations_leader",
    label: "Operations Leader",
    pattern: /\b(director of operations|operations director|operations manager|vp operations|head of operations)\b/i,
    operationalEntryBoost: 0.9,
    executiveEntryBoost: 0.58,
  },
  {
    role: "coo",
    label: "COO",
    pattern: /\b(coo|chief operating officer)\b/i,
    operationalEntryBoost: 0.88,
    executiveEntryBoost: 0.72,
  },
  {
    role: "dispatch",
    label: "Dispatch Leadership",
    pattern: /\b(dispatch manager|dispatch supervisor|dispatch lead|service coordinator)\b/i,
    operationalEntryBoost: 0.84,
    executiveEntryBoost: 0.4,
  },
  {
    role: "president",
    label: "President",
    pattern: /\b(president)\b/i,
    operationalEntryBoost: 0.62,
    executiveEntryBoost: 0.88,
  },
  {
    role: "owner",
    label: "Owner",
    pattern: /\b(owner|founder|co-founder|cofounder|principal)\b/i,
    operationalEntryBoost: 0.58,
    executiveEntryBoost: 0.9,
  },
  {
    role: "ceo",
    label: "CEO",
    pattern: /\b(ceo|chief executive)\b/i,
    operationalEntryBoost: 0.55,
    executiveEntryBoost: 0.92,
  },
  {
    role: "finance",
    label: "Finance",
    pattern: /\b(cfo|finance director|controller|vp finance)\b/i,
    operationalEntryBoost: 0.35,
    executiveEntryBoost: 0.7,
  },
  {
    role: "technician_leadership",
    label: "Technician Leadership",
    pattern: /\b(lead technician|service manager|field supervisor|biomedical manager)\b/i,
    operationalEntryBoost: 0.78,
    executiveEntryBoost: 0.45,
  },
  {
    role: "regional_manager",
    label: "Regional Manager",
    pattern: /\b(regional manager|area manager|district manager)\b/i,
    operationalEntryBoost: 0.72,
    executiveEntryBoost: 0.6,
  },
  {
    role: "sales",
    label: "Sales",
    pattern: /\b(sales director|vp sales|business development)\b/i,
    operationalEntryBoost: 0.3,
    executiveEntryBoost: 0.5,
  },
  {
    role: "customer_success",
    label: "Customer Success",
    pattern: /\b(customer success|client services|account manager)\b/i,
    operationalEntryBoost: 0.45,
    executiveEntryBoost: 0.48,
  },
]

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.replace(/\s+/g, " ") : null
}

function relationshipMaturityScore(stage: GrowthOutreachRelationshipStage | null | undefined): number {
  switch (stage) {
    case "Customer":
      return 0.95
    case "Engaged":
      return 0.88
    case "Interested":
      return 0.78
    case "Aware":
      return 0.62
    case "Cold":
    default:
      return 0.42
  }
}

function relationshipTierBoost(tier: string | null | undefined): number {
  if (!tier) return 0
  const lower = tier.toLowerCase()
  if (/strong|hot|warm/.test(lower)) return 0.14
  if (/neutral|developing/.test(lower)) return 0.06
  if (/weak|cold|unknown/.test(lower)) return -0.04
  return 0
}

function scoreEntryCandidates(input: {
  candidates: RevenueStrategyDecisionMakerCandidate[]
  sequenceApproach: RevenueStrategySequenceApproach
  primaryDmTitle: string | null
}): RevenueStrategyEntryPoint[] {
  const operationalFirst =
    input.sequenceApproach === "operational_insight" || input.sequenceApproach === "curiosity"

  return input.candidates
    .map((candidate) => {
      const title = clean(candidate.title) ?? ""
      let best: (typeof ENTRY_ROLE_PATTERNS)[number] | null = null
      for (const row of ENTRY_ROLE_PATTERNS) {
        if (row.pattern.test(title)) {
          best = row
          break
        }
      }
      if (!best) return null

      const base = operationalFirst ? best.operationalEntryBoost : best.executiveEntryBoost
      const primaryBoost = candidate.isPrimary ? 0.06 : 0
      const score = clamp01(base + primaryBoost)

      return {
        role: best.role,
        label: best.label,
        matchedTitle: title || null,
        score,
        rationale:
          operationalFirst && best.operationalEntryBoost >= 0.8
            ? `${best.label} is the most likely operational entry for this conversation angle.`
            : `${best.label} can sponsor the conversation from an executive posture.`,
      } satisfies RevenueStrategyEntryPoint
    })
    .filter((row): row is RevenueStrategyEntryPoint => Boolean(row))
    .sort((a, b) => b.score - a.score)
}

function inferSequenceApproach(input: {
  consultantDiscovery: GrowthOutreachConsultantDiscoveryIntelligence | null
  relationshipStage: GrowthOutreachRelationshipStage | null | undefined
}): RevenueStrategySequencePlan {
  const angle = input.consultantDiscovery?.conversationAngle ?? ""
  const operational =
    /depot|field|dispatch|handoff|coordination|uptime|operational/i.test(angle) ||
    Boolean(input.consultantDiscovery?.operationalBottleneck)

  if (input.relationshipStage === "Engaged" || input.relationshipStage === "Interested") {
    return {
      approach: "relationship",
      rationale: "Existing relationship warmth — lead with continuity, not cold discovery.",
      steps: ["Relationship check-in", "Operational question", "Smallest next step"],
    }
  }

  if (operational) {
    return {
      approach: "operational_insight",
      rationale: "Operational complexity is the wedge — earn the conversation with insight before product.",
      steps: [
        "Operational observation",
        "Consultant discovery question",
        "Validate pressure before any product mention",
      ],
    }
  }

  return {
    approach: "curiosity",
    rationale: "Earn curiosity with a specific observation before expanding the thread.",
    steps: ["Observation", "One consultative question", "Soft close"],
  }
}

function buildChannelPlan(input: {
  sequenceApproach: RevenueStrategySequenceApproach
  persona: GrowthOutreachPersonaInference | null
  relationshipStage: GrowthOutreachRelationshipStage | null | undefined
  communicationChannelHint: string | null
  recommendation: RevenueStrategyRecommendation
}): RevenueStrategyChannelPlan {
  if (input.recommendation === "delay" || input.recommendation === "research" || input.recommendation === "disqualify") {
    return {
      primaryChannel: "none",
      rationale: "No outreach channel until strategic recommendation changes to proceed.",
      backupChannel: null,
    }
  }

  const hint = (input.communicationChannelHint ?? "").toLowerCase()
  if (/linkedin/i.test(hint)) {
    return {
      primaryChannel: "linkedin",
      rationale: "Communication engine + persona fit favor a short LinkedIn opener first.",
      backupChannel: "email",
    }
  }

  if (input.sequenceApproach === "phone" || input.persona?.normalizedRole === "Executive decision maker") {
    return {
      primaryChannel: "combination",
      rationale: "Executive entry — email or LinkedIn to earn the call, phone as follow-through.",
      backupChannel: "phone",
    }
  }

  if (input.sequenceApproach === "operational_insight") {
    return {
      primaryChannel: "email",
      rationale: "Operational insight needs room to breathe — email first, LinkedIn as parallel social proof.",
      backupChannel: "linkedin",
    }
  }

  if (input.relationshipStage === "Engaged") {
    return {
      primaryChannel: "email",
      rationale: "Warm relationship — direct email respects existing rapport.",
      backupChannel: "phone",
    }
  }

  return {
    primaryChannel: "email",
    rationale: "Cold-to-warm entry — concise email earns the first reply.",
    backupChannel: "linkedin",
  }
}

function buildCommitteeStakeholders(input: {
  snapshot: RevenueStrategyBuyingCommitteeSnapshot | null
  primaryEntry: RevenueStrategyEntryPoint
}): RevenueStrategyCommitteeStakeholder[] {
  const presentRoles = new Set((input.snapshot?.rolesPresent ?? []).map((r) => r.toLowerCase()))
  const missingRoles = input.snapshot?.rolesMissing ?? []

  const mk = (
    role: RevenueStrategyCommitteeRole,
    label: string,
    presentKeys: string[],
    recommendation: string | null,
  ): RevenueStrategyCommitteeStakeholder => ({
    role,
    label,
    present: presentKeys.some((key) => presentRoles.has(key)),
    recommendation,
  })

  return [
    mk(
      "primary_champion",
      "Primary Champion",
      ["champion", "influencer", "end_user"],
      input.primaryEntry.label,
    ),
    mk("economic_buyer", "Economic Buyer", ["economic_buyer", "executive_sponsor"], null),
    mk("technical_approver", "Technical Approver", ["technical_buyer"], null),
    mk(
      "operational_influencer",
      "Operational Influencer",
      ["influencer", "end_user"],
      input.primaryEntry.role === "service_director" || input.primaryEntry.role === "operations_leader"
        ? input.primaryEntry.label
        : null,
    ),
    mk("potential_blocker", "Potential Blocker", ["blocker_risk_stakeholder", "procurement"], null),
    ...missingRoles.slice(0, 2).map((role) => ({
      role: "missing_stakeholder" as const,
      label: `Missing: ${role.replace(/_/g, " ")}`,
      present: false,
      recommendation: "Consider research or multi-thread before relying on a single contact.",
    })),
  ]
}

function buildThreadPlan(input: {
  candidates: RevenueStrategyDecisionMakerCandidate[]
  committeeStrategy: "single_thread" | "multi_thread"
  conversationApproach: string
  sequencePlan: RevenueStrategySequencePlan
}): RevenueStrategyThreadPlan[] {
  const scored = scoreEntryCandidates({
    candidates: input.candidates,
    sequenceApproach: input.sequencePlan.approach,
    primaryDmTitle: input.candidates.find((c) => c.isPrimary)?.title ?? null,
  })

  const byTitle = new Map<string, RevenueStrategyDecisionMakerCandidate>()
  for (const c of input.candidates) {
    const key = (c.title ?? "").toLowerCase()
    if (key && !byTitle.has(key)) byTitle.set(key, c)
  }

  const plans: RevenueStrategyThreadPlan[] = []
  for (const entry of scored.slice(0, input.committeeStrategy === "multi_thread" ? 3 : 1)) {
    const match =
      [...byTitle.values()].find((c) => entry.matchedTitle && c.title === entry.matchedTitle) ??
      input.candidates.find((c) => c.isPrimary) ??
      input.candidates[0] ??
      null

    plans.push({
      contactName: match?.name ?? null,
      contactTitle: match?.title ?? entry.matchedTitle,
      conversationAngle: input.conversationApproach,
      sequenceApproach: input.sequencePlan.approach.replace(/_/g, " "),
      priority: plans.length + 1,
    })
  }

  return plans
}

function buildCompetitivePosture(sellerTruth: GrowthOutreachSellerTruth | null | undefined): RevenueStrategyCompetitivePosture {
  const objections = sellerTruth?.objections ?? []
  const incumbentSignal = sellerTruth?.competitiveNotes?.[0] ?? null
  const trustBarriers = objections
    .filter((row) => /already have|built our own|not convinced|disrupt/i.test(row.objection))
    .map((row) => row.objection)
    .slice(0, 3)

  return {
    likelyIncumbent: incumbentSignal ?? "Existing process or homegrown tools",
    replacementDifficulty: trustBarriers.length >= 2 ? "high" : trustBarriers.length === 1 ? "medium" : "low",
    competitiveWedge:
      sellerTruth?.differentiators[0] ??
      sellerTruth?.primaryValueProposition ??
      "Operational visibility without rip-and-replace",
    trustBarriers,
    migrationConcerns: objections
      .filter((row) => /disrupt|implement|migration|switch/i.test(row.objection))
      .map((row) => row.objection)
      .slice(0, 2),
  }
}

function computeOpportunityReadiness(input: {
  evidenceIntelligence: GrowthOutreachEvidenceIntelligence | null
  consultantDiscovery: GrowthOutreachConsultantDiscoveryIntelligence | null
  conversationRisk: GrowthOutreachConversationRisk | null
  sellerKnowledgeQuality: GrowthOutreachSellerKnowledgeQuality | null | undefined
  relationshipStage: GrowthOutreachRelationshipStage | null | undefined
  relationshipStrengthTier: string | null | undefined
  opportunityReadinessScore: number | null | undefined
  hasPrimaryDm: boolean
}): RevenueStrategyOpportunityReadiness {
  const businessUnderstanding = clamp01(
    (input.consultantDiscovery?.reasonConfidence ?? 0.5) * 0.6 +
      (input.evidenceIntelligence?.selectedObservation ? 0.25 : 0) +
      (input.sellerKnowledgeQuality?.overallScore ?? 0.5) * 0.15,
  )
  const decisionMakerConfidence = clamp01(
    (input.conversationRisk?.personaConfidence ?? 0.5) * 0.7 + (input.hasPrimaryDm ? 0.25 : 0),
  )
  const relationshipMaturity = clamp01(
    relationshipMaturityScore(input.relationshipStage) + relationshipTierBoost(input.relationshipStrengthTier),
  )
  const evidenceQuality = clamp01(input.conversationRisk?.evidenceQuality ?? 0.5)
  const businessPressure = clamp01(input.consultantDiscovery?.primaryBusinessPressure?.score ?? 0.45)
  const buyingTrigger = clamp01(input.consultantDiscovery?.primaryBuyingTrigger?.score ?? 0.45)
  const operationalUrgency = clamp01(
    businessPressure * 0.5 +
      buyingTrigger * 0.3 +
      (input.consultantDiscovery?.conversationTiming.confidence === "high" ? 0.15 : 0),
  )
  const timingConfidence =
    input.consultantDiscovery?.conversationTiming.confidence === "high"
      ? 0.88
      : input.consultantDiscovery?.conversationTiming.confidence === "medium"
        ? 0.68
        : input.consultantDiscovery?.conversationTiming.confidence === "low"
          ? 0.48
          : 0.32
  const successConfidence = clamp01(
    businessUnderstanding * 0.22 +
      decisionMakerConfidence * 0.18 +
      evidenceQuality * 0.18 +
      businessPressure * 0.14 +
      buyingTrigger * 0.12 +
      operationalUrgency * 0.1 +
      timingConfidence * 0.06,
  )
  const leadBoost =
    input.opportunityReadinessScore != null ? clamp01(input.opportunityReadinessScore / 100) * 0.08 : 0

  const overall = clamp01(successConfidence + leadBoost)

  return {
    businessUnderstanding,
    decisionMakerConfidence,
    relationshipMaturity,
    evidenceQuality,
    businessPressure,
    buyingTrigger,
    operationalUrgency,
    timingConfidence,
    successConfidence,
    overall,
  }
}

function resolveRecommendation(input: {
  readiness: RevenueStrategyOpportunityReadiness
  sellerKnowledgeQuality: GrowthOutreachSellerKnowledgeQuality | null | undefined
  hasPrimaryDm: boolean
  missingEvidenceCount: number
  committeeSnapshot: RevenueStrategyBuyingCommitteeSnapshot | null
  consultantDiscovery: GrowthOutreachConsultantDiscoveryIntelligence | null
  relationshipAssessment?: GrowthOutreachRelationshipAssessment | null
}): {
  recommendation: RevenueStrategyRecommendation
  timingDecision: RevenueStrategyTimingDecision
  delayReasons: string[]
  researchGaps: string[]
  summary: string
} {
  const delayReasons: string[] = []
  const researchGaps: string[] = []

  if (!input.hasPrimaryDm) {
    researchGaps.push("No verified decision maker on file")
  }
  if (input.missingEvidenceCount >= 3) {
    researchGaps.push("Multiple evidence gaps remain")
  }
  if (input.committeeSnapshot?.discoveryPending) {
    researchGaps.push("Buying committee discovery still running")
  }
  if (input.committeeSnapshot && !input.committeeSnapshot.hasVerifiedCommittee) {
    researchGaps.push("Verified buying committee not established")
  }
  if (input.sellerKnowledgeQuality?.readyForDraftGeneration === false) {
    researchGaps.push("Seller knowledge incomplete for confident positioning")
  }

  const assessment = input.relationshipAssessment
  if (assessment?.available) {
    if (assessment.relationshipGoal.current === "walk_away") {
      return {
        recommendation: "disqualify",
        timingDecision: "wait",
        delayReasons: assessment.relationshipProtection.rationale,
        researchGaps,
        summary: "Walk away — protect the brand and close the loop respectfully.",
      }
    }
    if (relationshipAssessmentSuggestsDelay(assessment)) {
      const delayReasons = [
        ...assessment.relationshipProtection.rationale,
        ...assessment.relationshipImprovementLikelihood.rationale.filter((line) =>
          /wait|pause|patience|weaken/i.test(line),
        ),
      ]
      if (assessment.trustBudget.level === "depleted" || assessment.trustBudget.level === "damaging") {
        delayReasons.push(`Trust budget is ${assessment.trustBudget.level} — protect credibility before another touch.`)
      }
      if (assessment.relationshipMomentum.trend === "reversing" || assessment.relationshipMomentum.trend === "stalling") {
        delayReasons.push(`Relationship momentum is ${assessment.relationshipMomentum.trend}.`)
      }
      return {
        recommendation: "delay",
        timingDecision:
          assessment.relationshipProtection.action === "wait" ? "wait" : "wait_for_signal",
        delayReasons: delayReasons.length ? delayReasons : ["Relationship protection active — wait before proceeding."],
        researchGaps,
        summary: `Given everything known about this relationship, wait — ${assessment.relationshipGoal.label.toLowerCase()} comes first.`,
      }
    }
    if (
      assessment.relationshipGoal.current === "recover_trust" ||
      assessment.relationshipGoal.current === "protect_relationship"
    ) {
      return {
        recommendation: "delay",
        timingDecision: "wait_for_signal",
        delayReasons: [assessment.relationshipGoal.rationale],
        researchGaps,
        summary: `Protect the relationship — focus on ${assessment.relationshipGoal.label.toLowerCase()} before advancing.`,
      }
    }
  }

  if (!input.hasPrimaryDm && input.readiness.evidenceQuality < 0.45) {
    return {
      recommendation: "disqualify",
      timingDecision: "research_further",
      delayReasons: ["Insufficient evidence and no decision-maker context"],
      researchGaps,
      summary: "Not ready — evidence and contact context are too thin for a credible outreach motion.",
    }
  }

  if (researchGaps.length >= 2 || input.committeeSnapshot?.discoveryPending) {
    return {
      recommendation: "research",
      timingDecision: "research_further",
      delayReasons: [],
      researchGaps,
      summary: "Research first — close committee or evidence gaps before spending rep attention.",
    }
  }

  if (
    input.readiness.overall < 0.55 ||
    input.readiness.timingConfidence < 0.4 ||
    (input.consultantDiscovery?.conversationTiming.confidence === "uncertain" &&
      input.readiness.operationalUrgency < 0.55)
  ) {
    if (input.readiness.timingConfidence < 0.4) {
      delayReasons.push("Timing signals are weak — patience may outperform another follow-up")
    }
    if (input.readiness.overall < 0.55) {
      delayReasons.push("Success confidence below the bar for a best-salesperson call this week")
    }
    return {
      recommendation: "delay",
      timingDecision: "wait",
      delayReasons,
      researchGaps,
      summary: "Wait — the account is interesting but not yet worth a best-rep call this week.",
    }
  }

  if (input.consultantDiscovery?.conversationTiming.confidence === "uncertain") {
    delayReasons.push("No defensible 'why now' — monitor for hiring, expansion, or operational signals")
    return {
      recommendation: "delay",
      timingDecision: "wait_for_signal",
      delayReasons,
      researchGaps,
      summary: "Wait for signal — do not invent urgency; monitor for operational or growth triggers.",
    }
  }

  return {
    recommendation: "proceed",
    timingDecision: "contact_now",
    delayReasons,
    researchGaps,
    summary: "Proceed — business pressure, evidence, and timing support a best-rep conversation now.",
  }
}

export function passesRevenueStrategyQuality(
  intelligence: GrowthOutreachRevenueStrategyIntelligence | null,
): boolean {
  if (!intelligence) return false
  if (!intelligence.primaryEntryPoint?.label) return false
  if (!intelligence.recommendationSummary) return false
  if (!intelligence.vpSalesJudgment) return false
  if (intelligence.confidenceScore < 0.35) return false
  return true
}

export function reviewRevenueStrategyQuality(
  intelligence: GrowthOutreachRevenueStrategyIntelligence | null,
): string[] {
  const failures: string[] = []
  if (!intelligence) {
    failures.push("revenue_strategy:not_applied")
    return failures
  }
  if (!passesRevenueStrategyQuality(intelligence)) {
    failures.push("revenue_strategy:quality_gate_failed")
  }
  if (intelligence.recommendation === "proceed" && intelligence.opportunityReadiness.overall < 0.5) {
    failures.push("revenue_strategy:proceed_below_readiness_threshold")
  }
  return failures
}

export function buildRevenueStrategyIntelligence(input: {
  leadId: string
  companyName: string
  primaryDmName: string | null
  primaryDmTitle: string | null
  decisionMakers?: RevenueStrategyDecisionMakerCandidate[]
  relationshipStage?: GrowthOutreachRelationshipStage | null
  relationshipStrengthTier?: string | null
  opportunityReadinessScore?: number | null
  missingEvidence?: string[]
  evidenceIntelligence?: GrowthOutreachEvidenceIntelligence | null
  consultantDiscoveryIntelligence?: GrowthOutreachConsultantDiscoveryIntelligence | null
  conversationRisk?: GrowthOutreachConversationRisk | null
  sellerTruth?: GrowthOutreachSellerTruth | null
  sellerKnowledgeQuality?: GrowthOutreachSellerKnowledgeQuality | null
  persona?: GrowthOutreachPersonaInference | null
  buyingCommitteeSnapshot?: RevenueStrategyBuyingCommitteeSnapshot | null
  communicationChannelHint?: string | null
  relationshipAssessment?: GrowthOutreachRelationshipAssessment | null
  institutionalLearning?: GrowthInstitutionalSalesIntelligence | null
}): GrowthOutreachRevenueStrategyIntelligence {
  const candidates: RevenueStrategyDecisionMakerCandidate[] =
    input.decisionMakers && input.decisionMakers.length > 0
      ? input.decisionMakers
      : [
          {
            name: input.primaryDmName,
            title: input.primaryDmTitle,
            isPrimary: true,
          },
        ]

  const sequencePlan = inferSequenceApproach({
    consultantDiscovery: input.consultantDiscoveryIntelligence ?? null,
    relationshipStage: input.relationshipStage,
  })

  const opportunityReadiness = computeOpportunityReadiness({
    evidenceIntelligence: input.evidenceIntelligence ?? null,
    consultantDiscovery: input.consultantDiscoveryIntelligence ?? null,
    conversationRisk: input.conversationRisk ?? null,
    sellerKnowledgeQuality: input.sellerKnowledgeQuality,
    relationshipStage: input.relationshipStage,
    relationshipStrengthTier: input.relationshipStrengthTier,
    opportunityReadinessScore: input.opportunityReadinessScore,
    hasPrimaryDm: Boolean(input.primaryDmName || input.primaryDmTitle),
  })

  const resolved = resolveRecommendation({
    readiness: opportunityReadiness,
    sellerKnowledgeQuality: input.sellerKnowledgeQuality,
    hasPrimaryDm: Boolean(input.primaryDmName || input.primaryDmTitle),
    missingEvidenceCount: input.missingEvidence?.length ?? 0,
    committeeSnapshot: input.buyingCommitteeSnapshot ?? null,
    consultantDiscovery: input.consultantDiscoveryIntelligence ?? null,
    relationshipAssessment: input.relationshipAssessment ?? null,
  })

  const scoredEntries = scoreEntryCandidates({
    candidates,
    sequenceApproach: sequencePlan.approach,
    primaryDmTitle: input.primaryDmTitle,
  })

  const fallbackEntry: RevenueStrategyEntryPoint = {
    role: sequencePlan.approach === "operational_insight" ? "service_director" : "president",
    label: sequencePlan.approach === "operational_insight" ? "Service Director" : "President",
    matchedTitle: input.primaryDmTitle,
    score: 0.62,
    rationale: "Best available title on file — validate entry point with operator before sending.",
  }

  const primaryEntryPoint = scoredEntries[0] ?? fallbackEntry
  const backupEntryPoint = scoredEntries[1] ?? null

  const committeeStrategy: "single_thread" | "multi_thread" =
    (input.buyingCommitteeSnapshot?.singleThreadRisk && opportunityReadiness.overall >= 0.65) ||
    (input.buyingCommitteeSnapshot?.verifiedMemberCount ?? 0) >= 3 ||
    candidates.length >= 3
      ? "multi_thread"
      : "single_thread"

  const conversationApproach =
    input.consultantDiscoveryIntelligence?.conversationAngle ??
    sequencePlan.approach.replace(/_/g, " ")

  const channelPlan = buildChannelPlan({
    sequenceApproach: sequencePlan.approach,
    persona: input.persona ?? null,
    relationshipStage: input.relationshipStage,
    communicationChannelHint: input.communicationChannelHint ?? null,
    recommendation: resolved.recommendation,
  })

  const committeeStakeholders = buildCommitteeStakeholders({
    snapshot: input.buyingCommitteeSnapshot ?? null,
    primaryEntry: primaryEntryPoint,
  })

  const threadPlan = buildThreadPlan({
    candidates,
    committeeStrategy,
    conversationApproach,
    sequencePlan,
  })

  const risks: RevenueStrategyRisk[] = [
    {
      key: "wrong_person",
      label: "Wrong person",
      severity: "high",
      present: opportunityReadiness.decisionMakerConfidence < 0.55,
    },
    {
      key: "weak_evidence",
      label: "Weak evidence",
      severity: "high",
      present: opportunityReadiness.evidenceQuality < 0.5,
    },
    {
      key: "bad_timing",
      label: "Bad timing",
      severity: "medium",
      present: opportunityReadiness.timingConfidence < 0.45,
    },
    {
      key: "low_urgency",
      label: "Low urgency",
      severity: "medium",
      present: opportunityReadiness.operationalUrgency < 0.5,
    },
    {
      key: "relationship_risk",
      label: "Relationship risk",
      severity: "medium",
      present: opportunityReadiness.relationshipMaturity < 0.45 && input.relationshipStage === "Cold",
    },
    {
      key: "single_thread",
      label: "Single-thread risk",
      severity: "medium",
      present: Boolean(input.buyingCommitteeSnapshot?.singleThreadRisk),
    },
  ]

  const competitivePosture = buildCompetitivePosture(input.sellerTruth)

  const confidenceScore = applyInstitutionalConfidenceBoost(
    opportunityReadiness.overall,
    input.institutionalLearning,
  )
  const confidenceLevel: GrowthOutreachRevenueStrategyIntelligence["confidenceLevel"] =
    confidenceScore >= 0.75 ? "high" : confidenceScore >= 0.55 ? "medium" : "low"

  const timingSignals = [
    ...(input.consultantDiscoveryIntelligence?.conversationTiming.signals ?? []),
    ...(input.buyingCommitteeSnapshot?.discoveryPending ? ["Committee discovery in flight"] : []),
    ...(opportunityReadiness.operationalUrgency >= 0.7 ? ["Operational pressure elevated"] : []),
    ...(input.institutionalLearning?.conversationAngleHint
      ? [`Organizational pattern (advisory): ${input.institutionalLearning.conversationAngleHint}`]
      : []),
  ]

  const channelPlanWithInstitutional = {
    ...channelPlan,
    rationale: input.institutionalLearning?.channelHint
      ? `${channelPlan.rationale} Advisory from organizational learning: ${input.institutionalLearning.channelHint}`
      : channelPlan.rationale,
  }

  const vpSalesJudgment =
    input.relationshipAssessment?.available
      ? resolved.recommendation === "proceed"
        ? `Given everything I know about this relationship, ${input.companyName} is worth the next touch — ${input.relationshipAssessment.relationshipGoal.label.toLowerCase()} aligns with timing.`
        : resolved.recommendation === "delay"
          ? `Given everything I know about this relationship, ${input.companyName} should wait — ${resolved.delayReasons[0] ?? input.relationshipAssessment.relationshipGoal.rationale}`
          : resolved.recommendation === "research"
            ? `Given everything I know about this relationship, ${input.companyName} needs more context before another touch.`
            : `Given everything I know about this relationship, ${input.companyName} is off the list until trust recovers.`
      : resolved.recommendation === "proceed"
      ? `If I had only ten calls this week, ${input.companyName} makes the list — ${input.consultantDiscoveryIntelligence?.primaryBusinessPressure?.label ?? "operational pressure"} and timing align.`
      : resolved.recommendation === "delay"
        ? `If I had only ten calls this week, ${input.companyName} waits — ${resolved.delayReasons[0] ?? "success confidence is below the bar"}.`
        : resolved.recommendation === "research"
          ? `If I had only ten calls this week, ${input.companyName} does not make the list yet — close research gaps first.`
          : `If I had only ten calls this week, ${input.companyName} is off the list until contact and evidence improve.`

  return {
    recommendation: resolved.recommendation,
    recommendationSummary: resolved.summary,
    vpSalesJudgment,
    opportunityReadiness,
    timingDecision: resolved.timingDecision,
    timingRationale:
      input.consultantDiscoveryIntelligence?.conversationTiming.reason ??
      (resolved.timingDecision === "contact_now"
        ? "Operational and timing signals support outreach now."
        : "Timing is not strong enough to justify outreach today."),
    timingSignals: [...new Set(timingSignals)],
    primaryEntryPoint,
    backupEntryPoint,
    committeeStrategy,
    committeeStakeholders,
    threadPlan,
    channelPlan: channelPlanWithInstitutional,
    sequencePlan,
    risks: risks.filter((r) => r.present),
    competitivePosture,
    confidenceLevel,
    confidenceScore,
    conversationApproach,
    delayReasons: resolved.delayReasons,
    researchGaps: resolved.researchGaps,
  }
}

export function mapRevenueStrategyChannelToPackage(
  channelPlan: RevenueStrategyChannelPlan,
): string {
  switch (channelPlan.primaryChannel) {
    case "linkedin":
      return "linkedin"
    case "phone":
      return "call"
    case "video":
      return "sendr"
    case "combination":
      return "email"
    case "none":
      return "email"
    default:
      return "email"
  }
}

export function mapRevenueStrategySequenceToPackage(
  sequencePlan: RevenueStrategySequencePlan,
): string {
  if (sequencePlan.approach === "phone") return "phone_first_multichannel"
  if (sequencePlan.approach === "social") return "linkedin_first_multichannel"
  if (sequencePlan.approach === "video") return "video_first_multichannel"
  return "email_first_multichannel"
}
