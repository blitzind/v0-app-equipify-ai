/** Prospect Search — deterministic Growth Engine readiness (7.PS-D). Client-safe. */

import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_CATEGORIES } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthCompanyIntelligenceCategory } from "@/lib/growth/company-intelligence/company-intelligence-types"
import {
  GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER,
  type GrowthProspectSearchEngineReadiness,
  type GrowthProspectSearchPrioritizationTier,
  type GrowthProspectSearchReadinessDimensionScore,
  type GrowthProspectSearchReadinessLevel,
  type GrowthProspectSearchResearchCompleteness,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

const CRITICAL_COMMITTEE_ROLES: GrowthBuyingCommitteeIntelligenceRole[] = [
  "economic_buyer",
  "champion",
]

const KEY_COMPANY_INTELLIGENCE_CATEGORIES: GrowthCompanyIntelligenceCategory[] = [
  "description",
  "industry",
  "technology",
  "contactability",
  "website_signal",
]

const PRIORITIZATION_RANK: Record<GrowthProspectSearchPrioritizationTier, number> = {
  ready_for_outreach: 4,
  outreach_with_gaps: 3,
  research_first: 2,
  insufficient_data: 1,
}

function levelFromScore(score: number): GrowthProspectSearchReadinessLevel {
  if (score >= 80) return "ready"
  if (score >= 50) return "partial"
  if (score > 0) return "gap"
  return "blocked"
}

function dim(
  score: number,
  summary: string,
  reasons: string[],
  evidence: string[],
): GrowthProspectSearchReadinessDimensionScore {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  return {
    score: clamped,
    level: levelFromScore(clamped),
    summary,
    reasons,
    evidence,
  }
}

function countReachableDecisionMakers(
  engine: GrowthProspectSearchEngineIntelligence,
): number {
  const committee = engine.buying_committee
  const channels = engine.verified_channels?.by_person_id ?? {}
  if (!committee?.members.length) return 0

  let count = 0
  for (const member of committee.members) {
    const ch = channels[member.person_id]
    if (ch?.has_verified_email || ch?.has_verified_phone) count += 1
  }
  return count
}

function buildChannelReadiness(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): GrowthProspectSearchReadinessDimensionScore {
  const channels = engine?.verified_channels
  const email = channels?.persons_with_verified_email ?? 0
  const phone = channels?.persons_with_verified_phone ?? 0
  const social = channels?.persons_with_verified_profile ?? 0

  let score = 0
  const reasons: string[] = []
  const evidence: string[] = []

  if (email > 0) {
    score += 40
    evidence.push(`${email} verified email(s) on canonical persons`)
  } else {
    reasons.push("No verified email on canonical persons (7.3)")
  }
  if (phone > 0) {
    score += 35
    evidence.push(`${phone} verified phone(s) on canonical persons`)
  } else {
    reasons.push("No verified phone on canonical persons (7.4)")
  }
  if (social > 0) {
    score += 25
    evidence.push(`${social} verified social profile(s) (7.5)`)
  } else {
    reasons.push("No verified social profile (7.5)")
  }

  return dim(
    score,
    email > 0 && phone > 0
      ? "Email and phone channels verified"
      : email > 0 || phone > 0
        ? "Partial verified channel coverage"
        : "No verified outreach channels",
    reasons,
    evidence,
  )
}

function buildCommitteeReadiness(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): GrowthProspectSearchReadinessDimensionScore {
  const committee = engine?.buying_committee
  const verified = committee?.verified_member_count ?? 0
  const rolesPresent = new Set((committee?.roles_present ?? []).map(String))
  const rolesMissing = committee?.roles_missing ?? []
  const coverage = committee?.coverage_score ?? 0
  const singleThread = committee?.single_thread_risk ?? false

  const missingCritical = CRITICAL_COMMITTEE_ROLES.filter((r) => !rolesPresent.has(r))
  let score = Math.round(coverage * 100)
  const reasons: string[] = []
  const evidence: string[] = []

  if (verified > 0) {
    evidence.push(`${verified} verified buying committee member(s) (7.7)`)
  } else {
    reasons.push("No verified buying committee members (7.7)")
    score = Math.min(score, 15)
  }

  for (const role of CRITICAL_COMMITTEE_ROLES) {
    if (rolesPresent.has(role)) {
      score += 8
      evidence.push(`Critical role present: ${role.replace(/_/g, " ")}`)
    }
  }
  if (missingCritical.length) {
    reasons.push(`Missing critical roles: ${missingCritical.map((r) => r.replace(/_/g, " ")).join(", ")}`)
    score = Math.min(score, 55)
  }
  if (singleThread) {
    reasons.push("Single-thread risk — only one verified stakeholder")
    score = Math.min(score, 45)
  }
  if (rolesMissing.length > 0 && rolesMissing.length <= 4) {
    evidence.push(`Roles still open: ${rolesMissing.slice(0, 3).map((r) => r.replace(/_/g, " ")).join(", ")}`)
  }

  return dim(
    Math.min(100, score),
    verified > 0
      ? singleThread
        ? "Committee mapped but single-threaded"
        : "Buying committee coverage present"
      : "Buying committee not verified",
    reasons,
    evidence,
  )
}

function buildCompanyIntelligenceReadiness(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
): {
  dimension: GrowthProspectSearchReadinessDimensionScore
  missing_categories: string[]
} {
  const companyIntel = engine?.company_intelligence
  const present = new Set((companyIntel?.categories_present ?? []).map(String))
  const missing = GROWTH_COMPANY_INTELLIGENCE_CATEGORIES.filter((c) => !present.has(c))
  const keyMissing = KEY_COMPANY_INTELLIGENCE_CATEGORIES.filter((c) => !present.has(c))

  const categoryScore = Math.round(
    (present.size / GROWTH_COMPANY_INTELLIGENCE_CATEGORIES.length) * 100,
  )
  const keyScore = Math.round(
    ((KEY_COMPANY_INTELLIGENCE_CATEGORIES.length - keyMissing.length) /
      KEY_COMPANY_INTELLIGENCE_CATEGORIES.length) *
      100,
  )
  let score = companyIntel?.has_verified_intelligence
    ? Math.max(categoryScore, keyScore)
    : Math.min(categoryScore, 20)

  const reasons: string[] = []
  const evidence: string[] = []

  if (companyIntel?.has_verified_intelligence) {
    evidence.push(
      `Verified company intelligence — ${present.size}/${GROWTH_COMPANY_INTELLIGENCE_CATEGORIES.length} categories (7.6)`,
    )
  } else {
    reasons.push("No verified company intelligence snapshots (7.6)")
    score = Math.min(score, 25)
  }
  if (keyMissing.length) {
    reasons.push(
      `Missing key categories: ${keyMissing.map((c) => c.replace(/_/g, " ")).join(", ")}`,
    )
  }

  const discovery = companyIntel?.discovery_status ?? "none"
  if (discovery === "running" || discovery === "pending") {
    evidence.push(`Company intelligence job: ${discovery}`)
  }

  return {
    dimension: dim(
      score,
      companyIntel?.has_verified_intelligence
        ? "Verified company intelligence on file"
        : "Company intelligence incomplete",
      reasons,
      evidence,
    ),
    missing_categories: missing.map(String),
  }
}

function buildContactabilityReadiness(
  engine: GrowthProspectSearchEngineIntelligence | null | undefined,
  channel: GrowthProspectSearchReadinessDimensionScore,
  committee: GrowthProspectSearchReadinessDimensionScore,
  reachable: number,
): GrowthProspectSearchReadinessDimensionScore {
  const hasChannel = channel.score >= 40
  const hasCommittee = committee.score >= 40
  let score = Math.round(channel.score * 0.55 + committee.score * 0.25 + Math.min(100, reachable * 25))
  if (reachable > 0) score = Math.max(score, 50)

  const reasons: string[] = []
  const evidence: string[] = [...channel.evidence, ...committee.evidence]

  if (reachable > 0) {
    evidence.push(`${reachable} reachable verified decision maker(s)`)
  } else {
    reasons.push("No verified committee member with email or phone")
  }
  if (!hasChannel) reasons.push("Insufficient verified channel coverage for outreach")
  if (!hasCommittee) reasons.push("Insufficient verified committee coverage")

  return dim(
    Math.min(100, score),
    reachable > 0 && hasChannel
      ? "Contactable verified stakeholders present"
      : hasChannel || reachable > 0
        ? "Partial contactability"
        : "Not contactable via verified channels",
    reasons,
    evidence,
  )
}

function resolveResearchCompleteness(input: {
  has_canonical_company: boolean
  schema_ready: boolean
  is_suppressed: boolean
  overall_score: number
  channel_score: number
  committee_verified: number
  has_verified_company_intel: boolean
}): GrowthProspectSearchResearchCompleteness {
  if (!input.schema_ready || input.is_suppressed) return "research_blocked"
  if (!input.has_canonical_company) return "insufficient_data"
  if (
    input.overall_score >= 85 &&
    input.channel_score >= 60 &&
    input.committee_verified > 0 &&
    input.has_verified_company_intel
  ) {
    return "fully_researched"
  }
  if (input.overall_score >= 50) return "partially_researched"
  return "research_recommended"
}

function resolvePrioritizationTier(input: {
  has_canonical_company: boolean
  schema_ready: boolean
  overall_score: number
  channel_score: number
  committee: GrowthProspectSearchReadinessDimensionScore
  company_intel_ready: boolean
  reachable: number
  research_completeness: GrowthProspectSearchResearchCompleteness
}): GrowthProspectSearchPrioritizationTier {
  if (!input.has_canonical_company || input.research_completeness === "insufficient_data") {
    return "insufficient_data"
  }
  if (input.research_completeness === "research_blocked") {
    return "research_first"
  }

  const hasOutreachChannel = input.channel_score >= 40
  const hasCriticalRole = input.committee.evidence.some((e) => e.startsWith("Critical role present"))
  const committeeOk = input.committee.score >= 50 && input.committee.level !== "blocked"

  if (
    input.overall_score >= 72 &&
    hasOutreachChannel &&
    committeeOk &&
    input.company_intel_ready &&
    input.reachable > 0 &&
    hasCriticalRole
  ) {
    return "ready_for_outreach"
  }

  if (
    input.research_completeness === "research_recommended" ||
    !hasOutreachChannel ||
    input.reachable === 0 ||
    input.overall_score < 45
  ) {
    return "research_first"
  }

  return "outreach_with_gaps"
}

export function buildProspectSearchEngineReadiness(input: {
  company: Pick<
    GrowthProspectSearchCompanyResult,
    "contact_intelligence" | "canonical_company_id" | "is_suppressed"
  >
}): GrowthProspectSearchEngineReadiness {
  const intel = input.company.contact_intelligence
  const engine = intel?.engine_intelligence ?? null
  const has_canonical_company = Boolean(
    engine?.has_canonical_company ?? input.company.canonical_company_id,
  )
  const schema_ready = engine?.schema_ready !== false && intel?.schema_ready !== false

  const channel = buildChannelReadiness(engine)
  const committee = buildCommitteeReadiness(engine)
  const { dimension: company_intelligence, missing_categories } =
    buildCompanyIntelligenceReadiness(engine)
  const reachable = engine ? countReachableDecisionMakers(engine) : 0
  const contactability = buildContactabilityReadiness(engine, channel, committee, reachable)

  const overallScore = Math.round(
    contactability.score * 0.35 +
      committee.score * 0.25 +
      company_intelligence.score * 0.25 +
      channel.score * 0.15,
  )

  const rolesPresent = new Set((engine?.buying_committee?.roles_present ?? []).map(String))
  const missing_critical_committee_roles = CRITICAL_COMMITTEE_ROLES.filter(
    (r) => !rolesPresent.has(r),
  ).map((r) => r.replace(/_/g, " "))

  const research_completeness = resolveResearchCompleteness({
    has_canonical_company,
    schema_ready,
    is_suppressed: Boolean(input.company.is_suppressed),
    overall_score: overallScore,
    channel_score: channel.score,
    committee_verified: engine?.buying_committee?.verified_member_count ?? 0,
    has_verified_company_intel: Boolean(engine?.company_intelligence?.has_verified_intelligence),
  })

  const prioritization_tier = resolvePrioritizationTier({
    has_canonical_company,
    schema_ready,
    overall_score: overallScore,
    channel_score: channel.score,
    committee,
    company_intel_ready: company_intelligence.score >= 55,
    reachable,
    research_completeness,
  })

  const operator_summary = (() => {
    switch (prioritization_tier) {
      case "ready_for_outreach":
        return "Ready for outreach — verified channels and committee evidence support the next touch."
      case "outreach_with_gaps":
        return "Outreach possible with gaps — review readiness breakdown before sequencing."
      case "research_first":
        return "Research first — queue Growth Engine discovery jobs before outreach."
      default:
        return "Insufficient data — link canonical company/person identity before prioritizing."
    }
  })()

  const overall = dim(
    overallScore,
    `Overall research readiness ${overallScore}/100`,
    [
      ...contactability.reasons.slice(0, 2),
      ...committee.reasons.slice(0, 2),
      ...company_intelligence.reasons.slice(0, 1),
    ],
    [
      `Prioritization: ${prioritization_tier.replace(/_/g, " ")}`,
      `Research: ${research_completeness.replace(/_/g, " ")}`,
    ],
  )

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER,
    has_canonical_company,
    schema_ready,
    contactability,
    channel,
    committee,
    company_intelligence,
    overall,
    research_completeness,
    prioritization_tier,
    prioritization_rank: PRIORITIZATION_RANK[prioritization_tier],
    operator_summary,
    missing_critical_committee_roles,
    missing_intelligence_categories: missing_categories.map((c) => c.replace(/_/g, " ")),
    reachable_decision_maker_count: reachable,
  }
}

export function mergeEngineReadinessIntoContactIntelligence(
  intelligence: GrowthProspectSearchContactIntelligence,
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "canonical_company_id" | "is_suppressed">,
): GrowthProspectSearchContactIntelligence {
  const readiness = buildProspectSearchEngineReadiness({ company })
  const source_labels = [
    ...new Set([...(intelligence.source_labels ?? []), "growth.engine_readiness"]),
  ]
  return {
    ...intelligence,
    source_labels,
    engine_readiness: readiness,
  }
}

export function hasActiveProspectSearchEngineReadinessFilters(
  filters: GrowthProspectSearchFilters,
): boolean {
  return (
    (filters.prioritization_tiers?.length ?? 0) > 0 ||
    (filters.research_completeness?.length ?? 0) > 0
  )
}

export function companyMatchesProspectSearchEngineReadinessFilters(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence">,
  filters: GrowthProspectSearchFilters,
): boolean {
  if (!hasActiveProspectSearchEngineReadinessFilters(filters)) return true
  const readiness = company.contact_intelligence?.engine_readiness
  if (!readiness) return false

  if (filters.prioritization_tiers?.length) {
    if (!filters.prioritization_tiers.includes(readiness.prioritization_tier)) return false
  }
  if (filters.research_completeness?.length) {
    if (!filters.research_completeness.includes(readiness.research_completeness)) return false
  }
  return true
}

export function filterProspectSearchCompaniesByEngineReadiness<
  T extends GrowthProspectSearchCompanyResult,
>(companies: T[], filters: GrowthProspectSearchFilters): T[] {
  if (!hasActiveProspectSearchEngineReadinessFilters(filters)) return companies
  return companies.filter((row) => companyMatchesProspectSearchEngineReadinessFilters(row, filters))
}

export function prioritizeProspectSearchCompaniesByEngineReadiness<
  T extends GrowthProspectSearchCompanyResult,
>(companies: T[]): T[] {
  return [...companies].sort((a, b) => {
    const ra = a.contact_intelligence?.engine_readiness
    const rb = b.contact_intelligence?.engine_readiness
    const tierA = ra?.prioritization_rank ?? 0
    const tierB = rb?.prioritization_rank ?? 0
    if (tierB !== tierA) return tierB - tierA
    const scoreA = ra?.overall.score ?? 0
    const scoreB = rb?.overall.score ?? 0
    return scoreB - scoreA
  })
}

export const PROSPECT_SEARCH_PRIORITIZATION_TIER_LABELS: Record<
  GrowthProspectSearchPrioritizationTier,
  string
> = {
  ready_for_outreach: "Ready for outreach",
  outreach_with_gaps: "Outreach with gaps",
  research_first: "Research first",
  insufficient_data: "Insufficient data",
}

export const PROSPECT_SEARCH_RESEARCH_COMPLETENESS_LABELS: Record<
  GrowthProspectSearchResearchCompleteness,
  string
> = {
  fully_researched: "Fully researched",
  partially_researched: "Partially researched",
  research_recommended: "Research recommended",
  research_blocked: "Research blocked",
  insufficient_data: "Insufficient data",
}

/** Deterministic rank boost for search ordering (not lead scoring). */
export function engineReadinessRankBoost(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence">,
): number {
  const readiness = company.contact_intelligence?.engine_readiness
  if (!readiness) return 0
  return Math.min(0.12, (readiness.prioritization_rank / 4) * 0.08 + (readiness.overall.score / 100) * 0.04)
}
