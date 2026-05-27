/** Growth Engine — Prospect → pipeline workflow continuity (Sprint 4.2). Client-safe. */

import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_WORKFLOW_CONTEXT_QA_MARKER =
  "growth-prospect-pipeline-automation-v1" as const

export type GrowthProspectPipelineRecommendation = {
  recommended_next_action: string
  recommended_next_action_reason: string
  recommended_workflow_path: string
}

export type GrowthProspectSequenceBridge = {
  recommended_sequence_label: string | null
  recommended_sequence_confidence: number | null
  recommended_sequence_reason: string | null
  recommended_first_touch: string | null
}

export type GrowthProspectWorkflowContext = {
  source: "prospect_search"
  workflow_source: string
  company_name: string
  website: string | null
  industry: string | null
  location: string | null
  territory_label: string | null
  territory_match_reasons: string[]
  search_query: string | null
  discovery_mode: GrowthProspectSearchDiscoveryMode
  filters_snapshot: GrowthProspectSearchFilters
  saved_search_id: string | null
  source_type: GrowthProspectSearchCompanyResult["source_type"]
  source_id: string
  growth_lead_id: string | null
  lead_inbox_id: string | null
  prospect_id: string | null
  customer_id: string | null
  qualification: {
    buying_stage: string | null
    buying_stage_confidence: number | null
    buying_stage_reason: string | null
    lead_score: number | null
    lead_engine_score: number | null
    lead_engine_score_label: string | null
    lead_engine_score_explanation: string | null
    lead_engine_last_run_at: string | null
    decision_maker_coverage: number | null
    committee_completeness: number | null
  }
  outreach_state: {
    is_suppressed: boolean
    suppression_reason: string | null
    in_lead_inbox: boolean
    already_pushed: boolean
    existing_customer: boolean
    existing_prospect: boolean
  }
  contact_handoff: GrowthProspectSearchCompanyResult["contact_intelligence"]
  selected_contact_ids: string[]
  recommendation: GrowthProspectPipelineRecommendation | null
  sequence_bridge: GrowthProspectSequenceBridge | null
  growth_signal_recommended_action: string | null
  prior_next_step_reason: string | null
}

export type GrowthWorkflowContextHandoff = GrowthProspectWorkflowContext & {
  qa_marker: typeof GROWTH_PROSPECT_WORKFLOW_CONTEXT_QA_MARKER
}

export function buildGrowthWorkflowContext(input: {
  company: Pick<
    GrowthProspectSearchCompanyResult,
    | "id"
    | "source_type"
    | "company_name"
    | "website"
    | "industry"
    | "location"
    | "city"
    | "state"
    | "postal_code"
    | "country"
    | "metro"
    | "service_area"
    | "buying_stage"
    | "buying_stage_confidence"
    | "buying_stage_reason"
    | "lead_score"
    | "lead_engine_score"
    | "lead_engine_score_label"
    | "lead_engine_score_explanation"
    | "lead_engine_last_run_at"
    | "decision_maker_coverage"
    | "growth_lead_id"
    | "lead_inbox_id"
    | "prospect_id"
    | "customer_id"
    | "is_suppressed"
    | "suppression_reason"
    | "in_lead_inbox"
    | "already_pushed"
    | "existing_customer"
    | "existing_prospect"
    | "matched_territory_label"
    | "territory_match_reasons"
    | "contact_intelligence"
    | "committee_completion"
    | "growth_signal_recommended_action"
    | "recommended_next_step_reason"
  >
  query?: string
  filters?: GrowthProspectSearchFilters
  discoveryMode?: GrowthProspectSearchDiscoveryMode
  recommendation?: GrowthProspectPipelineRecommendation
  sequenceBridge?: GrowthProspectSequenceBridge
  savedSearchId?: string | null
  selectedContactIds?: string[]
}): GrowthWorkflowContextHandoff {
  const company = input.company
  return {
    qa_marker: GROWTH_PROSPECT_WORKFLOW_CONTEXT_QA_MARKER,
    source: "prospect_search",
    workflow_source: "prospect_search_v1",
    company_name: company.company_name,
    website: company.website,
    industry: company.industry,
    location: company.location,
    territory_label: company.matched_territory_label ?? null,
    territory_match_reasons: company.territory_match_reasons ?? [],
    search_query: input.query?.trim() || null,
    discovery_mode: input.discoveryMode ?? "internal",
    filters_snapshot: input.filters ?? {},
    saved_search_id: input.savedSearchId ?? null,
    source_type: company.source_type,
    source_id: company.id,
    growth_lead_id: company.growth_lead_id,
    lead_inbox_id: company.lead_inbox_id,
    prospect_id: company.prospect_id,
    customer_id: company.customer_id,
    qualification: {
      buying_stage: company.buying_stage,
      buying_stage_confidence: company.buying_stage_confidence,
      buying_stage_reason: company.buying_stage_reason,
      lead_score: company.lead_score,
      lead_engine_score: company.lead_engine_score,
      lead_engine_score_label: company.lead_engine_score_label,
      lead_engine_score_explanation: company.lead_engine_score_explanation,
      lead_engine_last_run_at: company.lead_engine_last_run_at,
      decision_maker_coverage: company.decision_maker_coverage,
      committee_completeness: company.committee_completion?.completeness_score ?? null,
    },
    outreach_state: {
      is_suppressed: company.is_suppressed === true,
      suppression_reason: company.suppression_reason,
      in_lead_inbox: company.in_lead_inbox === true,
      already_pushed: company.already_pushed === true,
      existing_customer: company.existing_customer === true,
      existing_prospect: company.existing_prospect === true,
    },
    contact_handoff: company.contact_intelligence ?? null,
    selected_contact_ids: input.selectedContactIds ?? [],
    recommendation: input.recommendation ?? null,
    sequence_bridge: input.sequenceBridge ?? null,
    growth_signal_recommended_action: company.growth_signal_recommended_action ?? null,
    prior_next_step_reason: company.recommended_next_step_reason ?? null,
  }
}

export function encodeGrowthWorkflowContext(context: GrowthWorkflowContextHandoff): string {
  const json = JSON.stringify(context)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url")
  }
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeGrowthWorkflowContext(
  encoded: string | null | undefined,
): GrowthWorkflowContextHandoff | null {
  const value = encoded?.trim()
  if (!value) return null
  try {
    let json = ""
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(value, "base64url").toString("utf8")
    } else {
      const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
      json = decodeURIComponent(
        Array.from(atob(normalized), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
      )
    }
    const parsed = JSON.parse(json) as GrowthWorkflowContextHandoff
    if (parsed.qa_marker !== GROWTH_PROSPECT_WORKFLOW_CONTEXT_QA_MARKER) return null
    if (!parsed.company_name) return null
    return parsed
  } catch {
    return null
  }
}

export function appendWorkflowContextToUrl(url: string, context: GrowthWorkflowContextHandoff): string {
  const separator = url.includes("?") ? "&" : "?"
  return `${url}${separator}workflowContext=${encodeGrowthWorkflowContext(context)}`
}

export function summarizeGrowthWorkflowContext(context: GrowthWorkflowContextHandoff): string {
  const parts = [
    context.company_name,
    context.qualification.buying_stage ? `Stage: ${context.qualification.buying_stage.replace(/_/g, " ")}` : null,
    context.qualification.lead_engine_score != null
      ? `Lead Engine ${context.qualification.lead_engine_score}`
      : null,
    context.territory_label ? `Territory: ${context.territory_label}` : null,
    context.search_query ? `Search: ${context.search_query}` : null,
  ].filter(Boolean)
  return parts.join(" · ")
}
