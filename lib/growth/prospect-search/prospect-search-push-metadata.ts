import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_BULK_PUSH_QA_MARKER =
  "growth-prospect-search-bulk-push-v1" as const

export const GROWTH_PROSPECT_SEARCH_PUSH_OUTCOMES = [
  "pushed",
  "already_exists",
  "skipped_invalid",
  "suppressed",
  "failed",
] as const

export type GrowthProspectSearchPushOutcome =
  (typeof GROWTH_PROSPECT_SEARCH_PUSH_OUTCOMES)[number]

export type ProspectSearchSelectionRef = {
  source_type: GrowthProspectSearchSourceType
  id: string
  company_name?: string
}

export type GrowthProspectSearchPushItemResult = {
  outcome: GrowthProspectSearchPushOutcome
  company_name: string
  source_type: GrowthProspectSearchSourceType
  message: string
  lead_inbox_id?: string | null
}

export type GrowthProspectSearchBulkPushResult = {
  ok: boolean
  action: "bulk_push_to_lead_inbox"
  message: string
  selected_total: number
  pushed: number
  already_exists: number
  skipped_invalid: number
  suppressed: number
  failed: number
  items: GrowthProspectSearchPushItemResult[]
  workspace_url?: string | null
}

export function buildProspectSearchPushMetadata(
  company: GrowthProspectSearchCompanyResult,
  query: string,
): Record<string, unknown> {
  return {
    prospect_search: {
      source_type: company.source_type,
      source_id: company.id,
      query,
    },
    qualification_context: {
      lead_engine_score: company.lead_engine_score ?? company.lead_score,
      lead_engine_score_label: company.lead_engine_score_label,
      lead_engine_score_explanation: company.lead_engine_score_explanation,
      buying_stage: company.buying_stage,
      buying_stage_confidence: company.buying_stage_confidence,
      buying_stage_reason: company.buying_stage_reason,
      company_match_confidence: company.company_match_confidence,
      intent_score: company.intent_score,
      search_intent_category: company.search_intent_category,
      crm_detected: company.crm_detected,
      field_service_software: company.field_service_software,
      website_platform: company.website_platform,
      service_area: company.service_area,
    },
    ...(company.buying_stage
      ? {
          buying_stage_summary: {
            detected_stage: company.buying_stage,
            stage_confidence: company.buying_stage_confidence,
            stage_reasoning: company.buying_stage_reason ? [company.buying_stage_reason] : [],
            assessed_at: company.buying_stage_last_assessed_at ?? new Date().toISOString(),
            evidence:
              company.buying_stage_reason ?? "Carried from Prospect Search qualification overlay.",
          },
        }
      : {}),
    ...(company.company_signal_summary
      ? { company_signal_summary: company.company_signal_summary }
      : {}),
    ...(company.growth_signal_score != null
      ? {
          growth_signals: {
            growth_signal_score: company.growth_signal_score,
            growth_signal_tier: company.growth_signal_tier,
            recommended_next_action: company.growth_signal_recommended_action,
            last_computed_at: company.growth_signal_last_computed_at,
          },
        }
      : {}),
    ...(company.contact_intelligence?.account_contact_strategy
      ? {
          account_contact_strategy: {
            readiness_tier:
              company.contact_intelligence.account_contact_strategy.account_outreach_readiness,
            readiness_score:
              company.contact_intelligence.account_contact_strategy
                .account_outreach_readiness_score,
            recommended_channel:
              company.contact_intelligence.account_contact_strategy.recommended_channel,
            strategy_summary:
              company.contact_intelligence.account_contact_strategy.strategy_summary,
            safest_next_action:
              company.contact_intelligence.account_contact_strategy.safest_next_action,
            contact_research_next_step:
              company.contact_intelligence.account_contact_strategy.contact_research_next_step,
            queue_priority_score:
              company.contact_intelligence.account_contact_strategy.queue_priority_score,
            queue_prioritization_reason:
              company.contact_intelligence.account_contact_strategy.queue_prioritization_reason,
            primary_contact_id:
              company.contact_intelligence.account_contact_strategy.primary_contact?.contact_id ??
              null,
            primary_contact_name:
              company.contact_intelligence.account_contact_strategy.primary_contact?.full_name ??
              null,
            secondary_contact_ids:
              company.contact_intelligence.account_contact_strategy.secondary_contacts.map(
                (c) => c.contact_id,
              ),
            fallback_contact_ids:
              company.contact_intelligence.account_contact_strategy.fallback_contacts.map(
                (c) => c.contact_id,
              ),
            blocked_contacts:
              company.contact_intelligence.account_contact_strategy.blocked_contacts.map((c) => ({
                contact_id: c.contact_id,
                full_name: c.full_name,
                reason: c.block_reason,
              })),
            missing_personas:
              company.contact_intelligence.account_contact_strategy.missing_personas,
            strategy_reasons:
              company.contact_intelligence.account_contact_strategy.strategy_reasons,
            risks: company.contact_intelligence.account_contact_strategy.risks,
          },
        }
      : {}),
    ...(company.contact_intelligence?.company_contact_coverage
      ? {
          contact_ranking: {
            outreach_readiness_score:
              company.contact_intelligence.company_contact_coverage.outreach_readiness_score,
            persona_completeness:
              company.contact_intelligence.company_contact_coverage.persona_completeness,
            coverage_label: company.contact_intelligence.company_contact_coverage.coverage_label,
            ranking_summary: company.contact_intelligence.company_contact_coverage.ranking_summary,
            persona_gap_suggestions:
              company.contact_intelligence.company_contact_coverage.persona_gap_suggestions,
            primary_recommended_contact_id:
              company.contact_intelligence.company_contact_coverage.primary_recommended_contact_id,
          },
        }
      : {}),
    ...(company.contact_intelligence?.org_intelligence
      ? {
          org_intelligence: {
            structure_label: company.contact_intelligence.org_intelligence.structure_label,
            structure_summary: company.contact_intelligence.org_intelligence.structure_summary,
            operational_structure_confidence:
              company.contact_intelligence.org_intelligence.operational_structure_confidence,
            likely_communication_flow:
              company.contact_intelligence.org_intelligence.likely_communication_flow,
            missing_department_warnings:
              company.contact_intelligence.org_intelligence.missing_department_warnings,
          },
        }
      : {}),
    ...(company.contact_intelligence?.outreach_sequence
      ? {
          outreach_sequence: {
            sequence_summary: company.contact_intelligence.outreach_sequence.sequence_summary,
            likely_gatekeepers: company.contact_intelligence.outreach_sequence.likely_gatekeepers,
            likely_approvers: company.contact_intelligence.outreach_sequence.likely_approvers,
            operational_influencers:
              company.contact_intelligence.outreach_sequence.operational_influencers,
            steps: company.contact_intelligence.outreach_sequence.steps.map((step) => ({
              contact_id: step.contact_id,
              full_name: step.full_name,
              persona_label: step.persona_label,
              sequence_order: step.sequence_order,
              role: step.role,
              reasoning: step.reasoning,
            })),
          },
        }
      : {}),
    ...(company.contact_intelligence?.contact_influences?.length
      ? {
          contact_influences: company.contact_intelligence.contact_influences.map((influence) => ({
            contact_id: influence.contact_id,
            influence_score: influence.influence_score,
            influence_tier: influence.influence_tier,
            likely_department: influence.likely_department,
            sequencing_role: influence.sequencing_role,
            influence_reasons: influence.influence_reasons,
          })),
        }
      : {}),
    ...(company.contact_intelligence?.relationship_memory
      ? {
          relationship_memory: {
            relationship_strength_score:
              company.contact_intelligence.relationship_memory.relationship_strength_score,
            relationship_status:
              company.contact_intelligence.relationship_memory.relationship_status,
            momentum_direction:
              company.contact_intelligence.relationship_memory.momentum_direction,
            recommended_next_action:
              company.contact_intelligence.relationship_memory.recommended_next_action,
            last_interaction_at:
              company.contact_intelligence.relationship_memory.last_interaction_at,
            strength_reasons: company.contact_intelligence.relationship_memory.strength_reasons,
            risks: company.contact_intelligence.relationship_memory.risks,
          },
        }
      : {}),
    ...(company.contact_intelligence?.account_progression
      ? {
          account_progression: {
            progression_state: company.contact_intelligence.account_progression.progression_state,
            progression_confidence:
              company.contact_intelligence.account_progression.progression_confidence,
            momentum_trend: company.contact_intelligence.account_progression.momentum_trend,
            next_best_action: company.contact_intelligence.account_progression.next_best_action,
            progression_blockers:
              company.contact_intelligence.account_progression.progression_blockers,
          },
        }
      : {}),
    ...(company.contact_intelligence?.account_timeline
      ? {
          account_timeline: {
            timeline_summary: company.contact_intelligence.account_timeline.timeline_summary,
            recommended_next_action:
              company.contact_intelligence.account_timeline.recommended_next_action,
            recent_outreach_count:
              company.contact_intelligence.account_timeline.recent_outreach_count,
            event_count: company.contact_intelligence.account_timeline.events.length,
          },
        }
      : {}),
  }
}

export function formatBulkPushSummary(input: {
  selected_total: number
  pushed: number
  already_exists: number
  skipped_invalid: number
  suppressed?: number
  failed: number
}): string {
  const parts = [`${input.selected_total} selected`]
  if (input.pushed > 0) parts.push(`${input.pushed} added to Lead Inbox`)
  if (input.already_exists > 0) parts.push(`${input.already_exists} already existed`)
  if ((input.suppressed ?? 0) > 0) {
    parts.push(
      `${input.suppressed} suppressed ${input.suppressed === 1 ? "row was" : "rows were"} skipped`,
    )
  }
  if (input.skipped_invalid > 0) {
    parts.push(
      `${input.skipped_invalid} skipped because ${input.skipped_invalid === 1 ? "source was incomplete" : "sources were incomplete"}`,
    )
  }
  if (input.failed > 0) parts.push(`${input.failed} failed`)
  return parts.join(" · ")
}
