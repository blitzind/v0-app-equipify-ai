/** Orchestrates relationship memory, timeline, and progression for Prospect Search. Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import {
  computeRelationshipStrength,
  resolveRelationshipQueueBoost,
  type ProspectSearchRelationshipMemorySnapshot,
} from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import {
  buildProspectSearchAccountTimeline,
  type ProspectSearchAccountTimeline,
} from "@/lib/growth/prospect-search/prospect-search-account-timeline"
import {
  computeAccountProgression,
  resolveProgressionQueueBoost,
  type ProspectSearchAccountProgression,
} from "@/lib/growth/prospect-search/prospect-search-account-progression"
import type { ProspectSearchLeadRelationshipHydration } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"

export type ProspectSearchLeadRelationshipHydrationClient = ProspectSearchLeadRelationshipHydration

export type ProspectSearchRelationshipIntelligenceBundle = {
  relationship_memory: ProspectSearchRelationshipMemorySnapshot
  account_timeline: ProspectSearchAccountTimeline
  account_progression: ProspectSearchAccountProgression
}

export function buildProspectSearchRelationshipIntelligence(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  leadHydration?: ProspectSearchLeadRelationshipHydration | null
}): ProspectSearchRelationshipIntelligenceBundle {
  const companyPeople = input.peopleRows.filter((row) => row.company_id === input.company.id)
  const leadHydration = input.leadHydration

  const timeline_events = companyPeople.flatMap((row) =>
    (row.timeline_events ?? []).map((event) => ({
      kind: event.kind,
      label: event.label,
      detail: event.detail,
      occurred_at: event.occurred_at,
      source: "contact_timeline",
    })),
  )

  const relationship_memory = computeRelationshipStrength({
    company_name: input.company.company_name,
    growth_lead_id: input.company.growth_lead_id,
    in_revenue_queue: input.company.in_revenue_queue,
    existing_customer: input.company.existing_customer,
    existing_prospect: input.company.existing_prospect,
    is_suppressed: input.company.is_suppressed,
    signals: input.company.signals,
    lead_touch: leadHydration?.lead_touch ?? null,
    relationship_context: leadHydration?.relationship_context ?? null,
    timeline_events,
  })

  const account_timeline = buildProspectSearchAccountTimeline({
    company: input.company,
    peopleRows: companyPeople,
    relationshipMemory: relationship_memory,
    leadTimelineEvents: leadHydration?.lead_timeline_events,
  })

  const account_progression = computeAccountProgression({
    company: input.company,
    coverage: input.company.contact_intelligence?.company_contact_coverage ?? null,
    accountStrategy: input.company.contact_intelligence?.account_contact_strategy ?? null,
    relationshipMemory: relationship_memory,
    timeline: account_timeline,
  })

  return { relationship_memory, account_timeline, account_progression }
}

export function applyRelationshipIntelligenceQueueBoost(
  company: GrowthProspectSearchCompanyResult,
  bundle: ProspectSearchRelationshipIntelligenceBundle,
): GrowthProspectSearchCompanyResult {
  const strategy = company.contact_intelligence?.account_contact_strategy
  if (!strategy) return company

  const relBoost = resolveRelationshipQueueBoost(bundle.relationship_memory)
  const progBoost = resolveProgressionQueueBoost(bundle.account_progression)
  const totalBoost = relBoost + progBoost
  if (totalBoost === 0) return company

  const reasons = [...strategy.strategy_reasons]
  if (relBoost !== 0) {
    reasons.push(
      `Relationship memory boost ${relBoost > 0 ? "+" : ""}${relBoost} (${bundle.relationship_memory.relationship_status.replace(/_/g, " ")})`,
    )
  }
  if (progBoost !== 0) {
    reasons.push(
      `Progression boost ${progBoost > 0 ? "+" : ""}${progBoost} (${bundle.account_progression.progression_state.replace(/_/g, " ")})`,
    )
  }

  return {
    ...company,
    contact_intelligence: {
      ...company.contact_intelligence!,
      account_contact_strategy: {
        ...strategy,
        queue_priority_score: Math.round(
          Math.min(100, Math.max(0, strategy.queue_priority_score + totalBoost)),
        ),
        strategy_reasons: reasons,
        queue_prioritization_reason:
          bundle.account_progression.next_best_action ?? strategy.queue_prioritization_reason,
      },
      relationship_memory: bundle.relationship_memory,
      account_timeline: bundle.account_timeline,
      account_progression: bundle.account_progression,
    },
  }
}

export function attachProspectSearchRelationshipIntelligence(
  companies: GrowthProspectSearchCompanyResult[],
  peopleRows: GrowthProspectSearchPeopleResultRow[],
  options?: {
    leadHydrationByLeadId?: Map<string, ProspectSearchLeadRelationshipHydration>
  },
): GrowthProspectSearchCompanyResult[] {
  return companies.map((company) => {
    const leadHydration = company.growth_lead_id
      ? options?.leadHydrationByLeadId?.get(company.growth_lead_id) ?? null
      : null

    const bundle = buildProspectSearchRelationshipIntelligence({
      company,
      peopleRows,
      leadHydration,
    })

    const withMemory = {
      ...company,
      contact_intelligence: {
        ...(company.contact_intelligence ?? {
          qa_marker: "growth-prospect-search-contact-intelligence-v1" as const,
          schema_ready: false,
          has_contacts: false,
          contacts: [],
          committee_roles: [],
          committee_completeness_pct: null,
          first_contact: null,
          confidence_explanation: null,
          outreach_recommendation: null,
          source_labels: [],
          empty_reason: null,
        }),
        relationship_memory: bundle.relationship_memory,
        account_timeline: bundle.account_timeline,
        account_progression: bundle.account_progression,
      },
    }

    return applyRelationshipIntelligenceQueueBoost(withMemory, bundle)
  })
}

export function enrichPeopleRowsWithRelationshipMemory(
  peopleRows: GrowthProspectSearchPeopleResultRow[],
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchPeopleResultRow[] {
  const memoryByCompany = new Map<string, ProspectSearchRelationshipMemorySnapshot>()
  for (const company of companies) {
    const memory = company.contact_intelligence?.relationship_memory
    if (memory) memoryByCompany.set(company.id, memory)
  }

  return peopleRows.map((row) => {
    const memory = memoryByCompany.get(row.company_id)
    if (!memory) {
      return {
        ...row,
        relationship_status: "new",
        relationship_momentum: "stable",
        relationship_strength_score: 0,
        relationship_last_interaction_at: null,
        relationship_summary: null,
      }
    }
    return {
      ...row,
      relationship_status: memory.relationship_status,
      relationship_momentum: memory.momentum_direction,
      relationship_strength_score: memory.relationship_strength_score,
      relationship_last_interaction_at: memory.last_interaction_at,
      relationship_summary: memory.strength_reasons[0] ?? memory.recommended_next_action,
    }
  })
}
