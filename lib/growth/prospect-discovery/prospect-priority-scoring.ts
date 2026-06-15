/** Phase GS-2D — Prospect priority scoring (client-safe). */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type {
  ProspectPriorityScoreInput,
  ProspectPriorityScoreResult,
  ProspectRecommendationPriority,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function priorityFromScore(score: number): ProspectRecommendationPriority {
  if (score >= 85) return "urgent"
  if (score >= 70) return "high"
  if (score >= 45) return "medium"
  return "low"
}

function normalizedSignalText(signals: string[]): string {
  return signals.join(" ").toLowerCase()
}

export function detectHiringSignalStrength(signals: string[], company?: GrowthProspectSearchCompanyResult): number {
  const text = normalizedSignalText(signals)
  let strength = 0
  if (/hiring|headcount|recruit|job opening|workforce|technician|expansion/.test(text)) strength += 55
  const growthIndicators = company?.company_signal_summary?.growth_indicators ?? []
  if (growthIndicators.some((item) => /hiring|headcount|expansion|growth/i.test(item))) strength += 30
  if ((company?.signal_momentum_label ?? "").toLowerCase().includes("surge")) strength += 15
  return clamp(strength)
}

export function detectFundingSignalStrength(signals: string[], company?: GrowthProspectSearchCompanyResult): number {
  const text = normalizedSignalText(signals)
  let strength = 0
  if (/funding|series [a-d]|raised|investment|capital|venture/.test(text)) strength += 60
  const growthIndicators = company?.company_signal_summary?.growth_indicators ?? []
  if (growthIndicators.some((item) => /funding|investment|capital|raised/i.test(item))) strength += 35
  return clamp(strength)
}

export function detectWebsiteIntentStrength(signals: string[], company?: GrowthProspectSearchCompanyResult): number {
  const text = normalizedSignalText(signals)
  let strength = 0
  if (/pricing|demo|contact page|website visit|intent|repeat visit/.test(text)) strength += 55
  if ((company?.intent_score ?? 0) >= 70) strength += 25
  if ((company?.intent_score ?? 0) >= 50) strength += 10
  return clamp(strength)
}

export function detectCompetitorSignalStrength(signals: string[]): number {
  const text = normalizedSignalText(signals)
  return /competitor|alternative|vs\.|comparison|switching/.test(text) ? 70 : 0
}

export function estimateAccountPlaybookFit(
  company: GrowthProspectSearchCompanyResult,
  searchIndustryHint?: string | null,
): number {
  const industry = `${company.industry ?? ""} ${company.subindustry ?? ""} ${(company.keywords ?? []).join(" ")}`.toLowerCase()
  const hint = (searchIndustryHint ?? "").toLowerCase()
  let fit = 35

  const biomedical = /biomed|life science|pharma|clinical|medical device|diagnostic/
  const hvac = /hvac|mechanical|plumbing|field service|facilities/
  const playbookPatterns = [biomedical, hvac]

  for (const pattern of playbookPatterns) {
    if (pattern.test(industry)) fit += 25
    if (hint && pattern.test(hint) && pattern.test(industry)) fit += 20
  }

  if ((company.lead_engine_score ?? company.lead_score ?? 0) >= 75) fit += 10
  if ((company.growth_signal_tier ?? "") === "hot") fit += 10
  return clamp(fit)
}

export function estimateDecisionMakerAvailability(company: GrowthProspectSearchCompanyResult): number {
  const coverage = company.decision_maker_coverage ?? company.committee_completion?.completion_pct ?? null
  if (typeof coverage === "number") return clamp(coverage)
  if ((company.contact_intelligence?.contacts?.length ?? 0) > 0) return 55
  if ((company.reachable_human?.score ?? 0) >= 60) return 50
  return 20
}

export function estimateCompanySizeScore(company: GrowthProspectSearchCompanyResult): number {
  const employees = `${company.employees ?? ""}`.toLowerCase()
  if (/1000|500\+|enterprise/.test(employees)) return 85
  if (/200|250|300|500/.test(employees)) return 70
  if (/50|75|100/.test(employees)) return 55
  if (/20|25|30/.test(employees)) return 45
  if (/10|15/.test(employees)) return 35
  return 25
}

export function buildProspectPriorityScoreInputFromCompany(
  company: GrowthProspectSearchCompanyResult,
  searchIndustryHint?: string | null,
): ProspectPriorityScoreInput {
  const signals = company.signals ?? []
  const qualification_score = clamp(
    company.lead_engine_score ?? company.lead_score ?? company.rank_score ?? company.confidence ?? 0,
  )
  const engagement_score = clamp(
    company.intent_score ?? company.signal_momentum_score ?? company.growth_signal_score ?? 0,
  )
  const opportunity_score = clamp(
    company.buying_stage_confidence ?? company.growth_signal_score ?? company.lead_score ?? 0,
  )
  const company_intelligence_score = clamp(
    company.growth_signal_score ?? company.company_confidence?.overall_confidence ?? company.confidence ?? 0,
  )
  const signal_activity_score = clamp(
    (company.signal_count ?? signals.length) * 12 + (company.signal_momentum_score ?? 0) * 0.35,
  )

  return {
    signals,
    qualification_score,
    engagement_score,
    opportunity_score,
    company_intelligence_score,
    hiring_signal_strength: detectHiringSignalStrength(signals, company),
    funding_signal_strength: detectFundingSignalStrength(signals, company),
    website_intent_strength: detectWebsiteIntentStrength(signals, company),
    company_size_score: estimateCompanySizeScore(company),
    account_playbook_fit: estimateAccountPlaybookFit(company, searchIndustryHint),
    decision_maker_availability: estimateDecisionMakerAvailability(company),
    signal_activity_score,
  }
}

export function buildProspectPriorityScore(input: ProspectPriorityScoreInput): ProspectPriorityScoreResult {
  const weighted =
    input.signal_activity_score * 0.2 +
    input.qualification_score * 0.2 +
    input.company_intelligence_score * 0.12 +
    input.hiring_signal_strength * 0.12 +
    input.funding_signal_strength * 0.12 +
    input.website_intent_strength * 0.1 +
    input.company_size_score * 0.06 +
    input.account_playbook_fit * 0.08 +
    input.decision_maker_availability * 0.1

  const score = clamp(Math.round(weighted))
  const priority = priorityFromScore(score)
  const confidence = clamp(Math.round(score * 0.85 + input.qualification_score * 0.15))

  const factors: string[] = []
  if (input.hiring_signal_strength >= 50) factors.push("Hiring surge detected")
  if (input.funding_signal_strength >= 50) factors.push("Funding event detected")
  if (input.website_intent_strength >= 50) factors.push("Website intent signals")
  if (input.account_playbook_fit >= 70) factors.push("Strong account playbook fit")
  if (input.decision_maker_availability >= 60) factors.push("Decision maker coverage available")
  if (input.signal_activity_score >= 60) factors.push("Elevated signal activity")
  if (input.qualification_score >= 70) factors.push("Strong qualification score")

  return { score, priority, confidence, factors }
}
