/** Operational intelligence orchestrator — emergence, sequence readiness, alerts. Client-safe. */

import type { NativeRevenueDecisionAuthoritativeBundle } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import { resolveAuthoritativeSequenceReadiness } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"

import type { ProspectSearchAccountContactStrategy } from "@/lib/growth/prospect-search/prospect-search-account-contact-strategy"
import type { ProspectSearchCompanyContactCoverageIntelligence } from "@/lib/growth/prospect-search/prospect-search-company-contact-coverage-intelligence"
import type { ProspectSearchRelationshipIntelligenceBundle } from "@/lib/growth/prospect-search/prospect-search-relationship-intelligence"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  detectProspectSearchOpportunityEmergence,
  resolveOpportunityQueueBoost,
  type ProspectSearchOpportunityEmergence,
} from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import {
  resolveSequenceReadinessQueueBoost,
  type ProspectSearchSequenceReadiness,
} from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import {
  buildProspectSearchOperatingAlerts,
  type ProspectSearchOperatingAlertsSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-revenue-operating-alerts"

export type ProspectSearchOperationalIntelligenceBundle = {
  opportunity_emergence: ProspectSearchOpportunityEmergence
  sequence_readiness: ProspectSearchSequenceReadiness
  operating_alerts: ProspectSearchOperatingAlertsSnapshot
}

export function buildProspectSearchOperationalIntelligence(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  coverage: ProspectSearchCompanyContactCoverageIntelligence
  accountStrategy: ProspectSearchAccountContactStrategy
  relationshipBundle: ProspectSearchRelationshipIntelligenceBundle
  territory_score?: number | null
  nativeDecisionBundle?: NativeRevenueDecisionAuthoritativeBundle | null
}): ProspectSearchOperationalIntelligenceBundle {
  const opportunity_emergence = detectProspectSearchOpportunityEmergence({
    company: input.company,
    peopleRows: input.peopleRows,
    coverage: input.coverage,
    relationshipMemory: input.relationshipBundle.relationship_memory,
    accountProgression: input.relationshipBundle.account_progression,
    accountTimeline: input.relationshipBundle.account_timeline,
    territory_score: input.territory_score,
  })

  const sequence_readiness = resolveAuthoritativeSequenceReadiness({
    legacyInput: {
      company: input.company,
      peopleRows: input.peopleRows,
      coverage: input.coverage,
      accountStrategy: input.accountStrategy,
      relationshipMemory: input.relationshipBundle.relationship_memory,
      accountProgression: input.relationshipBundle.account_progression,
      opportunityEmergence: opportunity_emergence,
    },
    nativeBundle: input.nativeDecisionBundle,
  })

  const operating_alerts = buildProspectSearchOperatingAlerts({
    company: input.company,
    peopleRows: input.peopleRows,
    accountStrategy: input.accountStrategy,
    relationshipMemory: input.relationshipBundle.relationship_memory,
    accountProgression: input.relationshipBundle.account_progression,
    accountTimeline: input.relationshipBundle.account_timeline,
    opportunityEmergence: opportunity_emergence,
    sequenceReadiness: sequence_readiness,
    territory_score: input.territory_score,
  })

  return { opportunity_emergence, sequence_readiness, operating_alerts }
}

export function applyOperationalIntelligenceQueueBoost(
  accountStrategy: ProspectSearchAccountContactStrategy,
  bundle: ProspectSearchOperationalIntelligenceBundle,
): ProspectSearchAccountContactStrategy {
  const oppBoost = resolveOpportunityQueueBoost(bundle.opportunity_emergence)
  const seqBoost = resolveSequenceReadinessQueueBoost(bundle.sequence_readiness)
  const total = oppBoost + seqBoost
  if (total === 0) return accountStrategy

  const strategy_reasons = [...accountStrategy.strategy_reasons]
  if (oppBoost !== 0) {
    strategy_reasons.push(
      `Opportunity emergence boost ${oppBoost > 0 ? "+" : ""}${oppBoost} (${bundle.opportunity_emergence.emergence_tier.replace(/_/g, " ")})`,
    )
  }
  if (seqBoost !== 0) {
    strategy_reasons.push(
      `Sequence readiness boost ${seqBoost > 0 ? "+" : ""}${seqBoost}`,
    )
  }

  return {
    ...accountStrategy,
    queue_priority_score: Math.round(
      Math.min(100, Math.max(0, accountStrategy.queue_priority_score + total)),
    ),
    strategy_reasons,
    queue_prioritization_reason:
      bundle.sequence_readiness.suggested_sequence_type ??
      bundle.opportunity_emergence.recommended_next_action ??
      accountStrategy.queue_prioritization_reason,
  }
}
