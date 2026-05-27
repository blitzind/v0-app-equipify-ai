/** Safe Lead Engine workspace handoff from Prospect Search (Sprint 3). Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"

export const GROWTH_PROSPECT_SEARCH_LEAD_ENGINE_HANDOFF_QA_MARKER =
  "growth-prospect-search-lead-engine-handoff-v1" as const

const MAX_NOTES_LENGTH = 500

function trimParam(value: string | null | undefined, max = 200): string | null {
  const text = typeof value === "string" ? value.trim() : ""
  if (!text) return null
  return text.slice(0, max)
}

export function buildProspectSearchLeadEngineHandoffInput(
  company: Pick<
    GrowthProspectSearchCompanyResult,
    | "company_name"
    | "website"
    | "industry"
    | "location"
    | "source_type"
    | "id"
    | "signals"
    | "crm_detected"
    | "field_service_software"
    | "service_area"
    | "buying_stage"
    | "lead_engine_score"
    | "lead_engine_score_explanation"
  >,
  query?: string,
): GrowthLeadEngineSandboxInput {
  const noteParts = [
    query ? `Prospect search query: ${query}` : null,
    company.buying_stage ? `Buying stage: ${company.buying_stage.replace(/_/g, " ")}` : null,
    company.lead_engine_score != null ? `Lead Engine score: ${company.lead_engine_score}` : null,
    company.lead_engine_score_explanation,
    company.crm_detected ? `CRM: ${company.crm_detected}` : null,
    company.field_service_software ? `Field service: ${company.field_service_software}` : null,
    company.service_area ? `Service area: ${company.service_area}` : null,
    company.signals[0] ?? null,
  ].filter(Boolean)

  return {
    companyName: company.company_name,
    domain: trimParam(company.website, 200) ?? "",
    industry: trimParam(company.industry, 120) ?? "",
    location: trimParam(company.location, 120) ?? "",
    notes: noteParts.join(" · ").slice(0, MAX_NOTES_LENGTH),
  }
}

export function buildProspectSearchLeadEngineHandoffUrl(
  company: GrowthProspectSearchCompanyResult,
  query?: string,
): string {
  const input = buildProspectSearchLeadEngineHandoffInput(company, query)
  const params = new URLSearchParams()

  params.set("companyName", input.companyName)
  if (input.domain) params.set("domain", input.domain)
  if (input.industry) params.set("industry", input.industry)
  if (input.location) params.set("location", input.location)
  if (input.notes) params.set("notes", input.notes)

  params.set("sourceType", company.source_type)
  params.set("sourceId", company.id)
  if (company.growth_lead_id) params.set("growthLeadId", company.growth_lead_id)
  if (company.lead_inbox_id) params.set("leadInboxId", company.lead_inbox_id)
  if (company.prospect_id) params.set("prospectId", company.prospect_id)
  if (company.customer_id) params.set("customerId", company.customer_id)

  return `/admin/growth/leads/lead-engine?${params.toString()}`
}

export function parseProspectSearchLeadEngineHandoffParams(
  searchParams: URLSearchParams,
): GrowthLeadEngineSandboxInput | null {
  const companyName = trimParam(searchParams.get("companyName"))
  if (!companyName) return null

  return {
    companyName,
    domain: trimParam(searchParams.get("domain"), 200) ?? "",
    industry: trimParam(searchParams.get("industry"), 120) ?? "",
    location: trimParam(searchParams.get("location"), 120) ?? "",
    notes: trimParam(searchParams.get("notes"), MAX_NOTES_LENGTH) ?? "",
  }
}
