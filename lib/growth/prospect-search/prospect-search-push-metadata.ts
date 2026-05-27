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
