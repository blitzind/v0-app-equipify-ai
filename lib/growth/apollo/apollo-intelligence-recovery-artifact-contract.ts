/** Recovery qualification context — align scorer with orchestrator run artifacts (client-safe merge). */

import type { GrowthBuyingCommitteeIntelligenceRunResult } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthCompanyIntelligenceRunResult } from "@/lib/growth/company-intelligence/company-intelligence-types"
import {
  buildApolloIntelligenceRecoveryQualificationContext,
  resolveApolloIntelligenceRecoveryFitScores,
  type ApolloIntelligenceRecoveryQualificationContext,
} from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

function highestVerifiedConfidence(
  findings: GrowthCompanyIntelligenceRunResult["findings"] | undefined,
): number | null {
  let max: number | null = null
  for (const finding of findings ?? []) {
    if (finding.verification_status !== "verified") continue
    const confidence = asNumber(finding.confidence)
    if (confidence == null) continue
    if (max == null || confidence > max) max = confidence
  }
  return max
}

export function mergeApolloIntelligenceRecoveryQualificationContext(input: {
  engine: GrowthProspectSearchEngineIntelligence | null | undefined
  company_intelligence_run?: GrowthCompanyIntelligenceRunResult | null
  buying_committee_run?: GrowthBuyingCommitteeIntelligenceRunResult | null
}): ApolloIntelligenceRecoveryQualificationContext {
  const fromEngine = buildApolloIntelligenceRecoveryQualificationContext(input.engine)

  let company_intelligence_present = fromEngine.company_intelligence_present
  let buying_committee_present = fromEngine.buying_committee_present
  let buying_committee_coverage = fromEngine.buying_committee_coverage
  let fit_score = fromEngine.fit_score
  let research_score = fromEngine.research_score

  const ciRun = input.company_intelligence_run
  if (!company_intelligence_present && ciRun) {
    const verifiedFindings = ciRun.findings.filter((f) => f.verification_status === "verified")
    const promotedFindings = ciRun.findings.filter((f) => f.promotion_status === "promoted")
    if (ciRun.verified_count > 0 || ciRun.promoted_count > 0 || verifiedFindings.length > 0) {
      company_intelligence_present = true
    }
    const runConfidence = highestVerifiedConfidence(ciRun.findings)
    if (runConfidence != null) {
      const scaled = Math.max(0, Math.min(100, runConfidence * 100))
      fit_score = fit_score ?? scaled
      research_score = research_score ?? scaled
    } else if (promotedFindings.length > 0) {
      const promotedConfidence = highestVerifiedConfidence(promotedFindings)
      if (promotedConfidence != null) {
        const scaled = Math.max(0, Math.min(100, promotedConfidence * 100))
        fit_score = fit_score ?? scaled
        research_score = research_score ?? scaled
      }
    }
  }

  const bcRun = input.buying_committee_run
  if (!buying_committee_present && bcRun) {
    const verifiedAssignments = bcRun.assignments.filter((a) => a.verification_status === "verified")
    if (bcRun.promoted_count > 0 || verifiedAssignments.length > 0) {
      buying_committee_present = true
      buying_committee_coverage =
        buying_committee_coverage ?? asNumber(bcRun.coverage?.coverage_score)
    }
  }

  if (!company_intelligence_present && input.engine?.company_intelligence) {
    const nonVerifiedSnapshots = input.engine.company_intelligence.snapshots ?? []
    if (nonVerifiedSnapshots.length > 0) {
      company_intelligence_present = true
      const engineFit = resolveApolloIntelligenceRecoveryFitScores(input.engine)
      fit_score = fit_score ?? engineFit.fit_score
      research_score = research_score ?? engineFit.research_score
    }
  }

  return {
    company_intelligence_present,
    buying_committee_present,
    buying_committee_coverage,
    fit_score,
    research_score,
  }
}

export function classifyCompanyIntelligenceRecoveryOutcome(input: {
  had_verified_before: boolean
  engine_has_verified_after: boolean
  run_result?: GrowthCompanyIntelligenceRunResult | null
}): {
  outcome: "created" | "reused" | "failed"
  error: string | null
} {
  if (input.engine_has_verified_after && !input.had_verified_before) {
    return { outcome: "created", error: null }
  }
  if (input.engine_has_verified_after) {
    return { outcome: "reused", error: null }
  }
  if (input.run_result?.promoted_count > 0) {
    return {
      outcome: "failed",
      error: "company_intelligence_promoted_snapshots_not_loaded_by_engine",
    }
  }
  if (input.run_result?.verified_count > 0) {
    return {
      outcome: "failed",
      error: "company_intelligence_verified_findings_not_promoted_to_snapshots",
    }
  }
  return {
    outcome: "failed",
    error: "company_intelligence_run_completed_without_verified_promotion",
  }
}

export function classifyBuyingCommitteeRecoveryOutcome(input: {
  had_members_before: boolean
  engine_member_count_after: number
  run_result?: GrowthBuyingCommitteeIntelligenceRunResult | null
}): {
  outcome: "created" | "reused" | "failed"
  error: string | null
} {
  if (input.engine_member_count_after > 0 && !input.had_members_before) {
    return { outcome: "created", error: null }
  }
  if (input.engine_member_count_after > 0) {
    return { outcome: "reused", error: null }
  }
  if (input.run_result?.promoted_count > 0) {
    return {
      outcome: "failed",
      error: "buying_committee_promoted_members_not_loaded_by_engine",
    }
  }
  const verifiedCount =
    input.run_result?.assignments.filter((a) => a.verification_status === "verified").length ?? 0
  if (verifiedCount > 0) {
    return {
      outcome: "failed",
      error: "buying_committee_verified_assignments_not_promoted_to_members",
    }
  }
  return {
    outcome: "failed",
    error: "buying_committee_run_completed_without_members",
  }
}
