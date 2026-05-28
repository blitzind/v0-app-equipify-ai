/** Safe Lead Engine workspace handoff from Prospect Search (Sprint 3). Client-safe. */

import {
  encodeUtf8ToBase64Url,
  safeDecodeBase64UrlToUtf8,
} from "@/lib/encoding/base64url-runtime"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"
import {
  buildLeadEngineContactHandoffContext,
  type ProspectSearchLeadEngineContactHandoffContext,
} from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"

export const GROWTH_PROSPECT_SEARCH_LEAD_ENGINE_HANDOFF_QA_MARKER =
  "growth-prospect-search-lead-engine-handoff-v1" as const

export type GrowthLeadEngineSandboxHandoffInput = GrowthLeadEngineSandboxInput & {
  sourceType?: string | null
  sourceId?: string | null
  growthLeadId?: string | null
  leadInboxId?: string | null
  prospectId?: string | null
  customerId?: string | null
  contactHandoff?: ProspectSearchLeadEngineContactHandoffContext | null
}

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
    | "contact_intelligence"
  >,
  query?: string,
): GrowthLeadEngineSandboxHandoffInput {
  const intelligence = company.contact_intelligence
  const noteParts = [
    query ? `Prospect search query: ${query}` : null,
    company.buying_stage ? `Buying stage: ${company.buying_stage.replace(/_/g, " ")}` : null,
    company.lead_engine_score != null ? `Lead Engine score: ${company.lead_engine_score}` : null,
    company.lead_engine_score_explanation,
    intelligence?.outreach_recommendation ?? null,
    intelligence?.first_contact
      ? `First contact: ${intelligence.first_contact.role}${intelligence.first_contact.name ? ` (${intelligence.first_contact.name})` : ""} · ${Math.round(intelligence.first_contact.confidence * 100)}%`
      : null,
    buildLeadEngineContactHandoffContext(intelligence, company)?.contact_research_required_message,
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
    sourceType: company.source_type,
    sourceId: company.id,
    contactHandoff: buildLeadEngineContactHandoffContext(intelligence, company),
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
  if (input.contactHandoff) {
    params.set("contactHandoff", encodeContactHandoffContext(input.contactHandoff))
  }

  return `/admin/growth/leads/lead-engine?${params.toString()}`
}

function encodeContactHandoffContext(context: ProspectSearchLeadEngineContactHandoffContext): string {
  const json = JSON.stringify(context)
  return encodeUtf8ToBase64Url(json)
}

function decodeContactHandoffContext(
  encoded: string | null | undefined,
): ProspectSearchLeadEngineContactHandoffContext | null {
  const value = encoded?.trim()
  if (!value) return null
  try {
    const json = safeDecodeBase64UrlToUtf8(value)
    if (!json) return null
    const parsed = JSON.parse(json) as ProspectSearchLeadEngineContactHandoffContext
    if (typeof parsed.contact_count !== "number") return null
    return {
      first_contact_role: parsed.first_contact_role ?? null,
      first_contact_name: parsed.first_contact_name ?? null,
      first_contact_confidence: parsed.first_contact_confidence ?? null,
      committee_completeness_pct: parsed.committee_completeness_pct ?? null,
      contact_count: parsed.contact_count,
      summary: parsed.summary ?? null,
      email_available: parsed.email_available === true,
      phone_available: parsed.phone_available === true,
      contact_sources: Array.isArray(parsed.contact_sources) ? parsed.contact_sources : [],
      compliance_status: parsed.compliance_status ?? "review_required",
      outreach_ready: parsed.outreach_ready === true,
      contact_research_required_message: parsed.contact_research_required_message ?? null,
      freshness_status: parsed.freshness_status ?? null,
      confidence_reason: parsed.confidence_reason ?? null,
    }
  } catch {
    return null
  }
}

export function parseProspectSearchLeadEngineHandoffParams(
  searchParams: URLSearchParams,
): GrowthLeadEngineSandboxHandoffInput | null {
  const companyName = trimParam(searchParams.get("companyName"))
  if (!companyName) return null

  return {
    companyName,
    domain: trimParam(searchParams.get("domain"), 200) ?? "",
    industry: trimParam(searchParams.get("industry"), 120) ?? "",
    location: trimParam(searchParams.get("location"), 120) ?? "",
    notes: trimParam(searchParams.get("notes"), MAX_NOTES_LENGTH) ?? "",
    sourceType: trimParam(searchParams.get("sourceType")),
    sourceId: trimParam(searchParams.get("sourceId")),
    growthLeadId: trimParam(searchParams.get("growthLeadId")),
    leadInboxId: trimParam(searchParams.get("leadInboxId")),
    prospectId: trimParam(searchParams.get("prospectId")),
    customerId: trimParam(searchParams.get("customerId")),
    contactHandoff: decodeContactHandoffContext(searchParams.get("contactHandoff")),
  }
}
