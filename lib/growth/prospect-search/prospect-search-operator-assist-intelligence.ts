/** Operator-assist intelligence orchestrator — recommendations, research, refresh, overlays. Client-safe. */

import type { NativeRevenueDecisionAuthoritativeBundle } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import { resolveAuthoritativeOperatorRecommendations } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchContactInfluenceResult } from "@/lib/growth/prospect-search/prospect-search-contact-influence"
import type { ProspectSearchOrgIntelligence } from "@/lib/growth/prospect-search/prospect-search-org-intelligence"
import type { ProspectSearchOperationalIntelligenceBundle } from "@/lib/growth/prospect-search/prospect-search-operational-intelligence"
import type { ProspectSearchRelationshipIntelligenceBundle } from "@/lib/growth/prospect-search/prospect-search-relationship-intelligence"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  buildProspectSearchOperatorRecommendations,
  resolveOperatorRecommendationQueueBoost,
  type ProspectSearchOperatorRecommendationsSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-operator-recommendations"
import {
  buildProspectResearchGaps,
  type ProspectSearchResearchGapsSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-research-gaps"
import {
  computeAdaptiveRefreshPriority,
  resolveAdaptiveRefreshQueueBoost,
  type ProspectSearchAdaptiveRefreshSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-adaptive-refresh"
import {
  resolveProspectSearchCommandOverlays,
  type ProspectSearchCommandOverlaysSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-command-overlays"

export type ProspectSearchOperatorAssistBundle = {
  operator_recommendations: ProspectSearchOperatorRecommendationsSnapshot
  research_gaps: ProspectSearchResearchGapsSnapshot
  adaptive_refresh: ProspectSearchAdaptiveRefreshSnapshot
  command_overlays: ProspectSearchCommandOverlaysSnapshot
}

export function buildProspectSearchOperatorAssistIntelligence(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  accountStrategy: ProspectSearchAccountContactStrategy
  relationshipBundle: ProspectSearchRelationshipIntelligenceBundle
  operationalBundle: ProspectSearchOperationalIntelligenceBundle
  orgIntelligence?: ProspectSearchOrgIntelligence | null
  contactInfluences?: ProspectSearchContactInfluenceResult[]
  territory_score?: number | null
  in_active_queue?: boolean
  nativeDecisionBundle?: NativeRevenueDecisionAuthoritativeBundle | null
}): ProspectSearchOperatorAssistBundle {
  const { company, peopleRows, coverage, accountStrategy, relationshipBundle, operationalBundle } =
    input

  const operator_recommendations = resolveAuthoritativeOperatorRecommendations({
    nativeBundle: input.nativeDecisionBundle,
    legacyBuilder: () =>
      buildProspectSearchOperatorRecommendations({
        company,
        peopleRows,
        coverage,
        accountStrategy,
        relationshipMemory: relationshipBundle.relationship_memory,
        accountProgression: relationshipBundle.account_progression,
        opportunityEmergence: operationalBundle.opportunity_emergence,
        sequenceReadiness: operationalBundle.sequence_readiness,
        orgIntelligence: input.orgIntelligence,
        operatingAlerts: operationalBundle.operating_alerts,
        contactInfluences: input.contactInfluences,
        territory_score: input.territory_score,
        queue_priority_score: accountStrategy.queue_priority_score,
      }),
  })

  const research_gaps = buildProspectResearchGaps({
    company,
    peopleRows,
    coverage,
    accountStrategy,
    orgIntelligence: input.orgIntelligence,
    territory_score: input.territory_score,
    opportunity_score: operationalBundle.opportunity_emergence.emergence_score,
  })

  const adaptive_refresh = computeAdaptiveRefreshPriority({
    company,
    peopleRows,
    coverage,
    relationshipMemory: relationshipBundle.relationship_memory,
    accountProgression: relationshipBundle.account_progression,
    opportunityEmergence: operationalBundle.opportunity_emergence,
    sequenceReadiness: operationalBundle.sequence_readiness,
    territory_score: input.territory_score,
    in_active_queue: input.in_active_queue ?? company.in_lead_inbox ?? false,
  })

  const command_overlays = resolveProspectSearchCommandOverlays({
    company,
    researchGaps: research_gaps,
    adaptiveRefresh: adaptive_refresh,
    territory_score: input.territory_score,
    sequenceReadiness: operationalBundle.sequence_readiness,
    opportunityEmergence: operationalBundle.opportunity_emergence,
    relationshipMemory: relationshipBundle.relationship_memory,
    accountProgression: relationshipBundle.account_progression,
    accountStrategy,
  })

  return {
    operator_recommendations,
    research_gaps,
    adaptive_refresh,
    command_overlays,
  }
}

export function applyOperatorAssistIntelligenceQueueBoost(
  accountStrategy: ProspectSearchAccountContactStrategy,
  bundle: ProspectSearchOperatorAssistBundle,
): ProspectSearchAccountContactStrategy {
  const recBoost = resolveOperatorRecommendationQueueBoost(bundle.operator_recommendations)
  const refreshBoost = resolveAdaptiveRefreshQueueBoost(bundle.adaptive_refresh)
  const total = recBoost + refreshBoost
  if (total === 0) return accountStrategy

  const strategy_reasons = [...accountStrategy.strategy_reasons]
  if (recBoost !== 0) {
    const top = bundle.operator_recommendations.top_recommendation
    strategy_reasons.push(
      `Operator recommendation boost ${recBoost > 0 ? "+" : ""}${recBoost}${top ? ` (${top.recommendation_type.replace(/_/g, " ")})` : ""}`,
    )
  }
  if (refreshBoost !== 0) {
    strategy_reasons.push(`Adaptive refresh boost +${refreshBoost}`)
  }

  return {
    ...accountStrategy,
    queue_priority_score: Math.round(
      Math.min(100, Math.max(0, accountStrategy.queue_priority_score + total)),
    ),
    strategy_reasons,
    queue_prioritization_reason:
      bundle.operator_recommendations.top_recommendation?.recommended_operator_action ??
      accountStrategy.queue_prioritization_reason,
  }
}
