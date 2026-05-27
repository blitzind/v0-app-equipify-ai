import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"
import type { GrowthProspectSearchIndexCompany } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchSourceType } from "@/lib/growth/prospect-search/prospect-search-types"

export type ProspectSearchMaterializedIndexRow = {
  id?: string
  source_type: GrowthProspectSearchSourceType
  source_id: string
  company_name: string
  normalized_company_name: string
  domain: string | null
  website: string | null
  email_domain: string | null
  phone: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  location_label: string | null
  industry: string | null
  vertical: string | null
  service_area: string | null
  employee_count: number | null
  employee_range: string | null
  estimated_annual_revenue: number | null
  revenue_range: string | null
  crm_detected: string | null
  field_service_software: string | null
  website_platform: string | null
  technologies: string[]
  company_signal_summary: GrowthCompanySignalUiSummary | null
  signal_confidence: number | null
  signal_count: number
  lead_engine_score: number | null
  lead_engine_score_label: string | null
  buying_stage: string | null
  buying_stage_confidence: number | null
  intent_score: number | null
  company_match_confidence: number | null
  existing_account_status: string
  is_customer: boolean
  is_prospect: boolean
  is_in_lead_inbox: boolean
  is_suppressed: boolean
  suppression_reason_safe: string | null
  suppression_scope_safe: string | null
  source_updated_at: string | null
  indexed_at?: string
  metadata: Record<string, unknown>
  is_active?: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeDomain(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const raw = value.trim().toLowerCase()
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./, "") || null
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] || null
  }
}

function parseEmployeeCount(value: string | null | undefined): number | null {
  if (!value?.trim()) return null
  const match = value.match(/(\d+)/)
  return match ? Number.parseInt(match[1]!, 10) : null
}

function existingAccountStatus(row: GrowthProspectSearchIndexCompany): string {
  if (row.existing_customer) return "customer"
  if (row.existing_prospect) return "prospect"
  if (row.in_lead_inbox) return "lead_inbox"
  if (row.existing_account) return "existing"
  return "none"
}

export function indexCompanyToMaterializedRow(
  row: GrowthProspectSearchIndexCompany,
  sourceUpdatedAt?: string | null,
): ProspectSearchMaterializedIndexRow {
  const domain = normalizeDomain(row.website)
  const technologies = [
    row.crm_detected,
    row.field_service_software,
    row.website_platform,
    ...(row.company_signal_summary?.technology_signals ?? []),
  ].filter((item): item is string => Boolean(item?.trim()))

  return {
    source_type: row.source_type,
    source_id: row.id,
    company_name: row.company_name,
    normalized_company_name: normalizeCompanyName(row.company_name),
    domain,
    website: row.website,
    email_domain: domain,
    phone: null,
    city: row.city,
    state: row.state,
    postal_code: null,
    country: null,
    location_label: row.location,
    industry: row.industry,
    vertical: row.subindustry,
    service_area: row.service_area,
    employee_count: parseEmployeeCount(row.employees),
    employee_range: row.employees,
    estimated_annual_revenue: null,
    revenue_range: row.revenue_range,
    crm_detected: row.crm_detected,
    field_service_software: row.field_service_software,
    website_platform: row.website_platform,
    technologies,
    company_signal_summary: row.company_signal_summary ?? null,
    signal_confidence: row.signal_confidence ?? null,
    signal_count: row.signal_count ?? 0,
    lead_engine_score: row.lead_engine_score,
    lead_engine_score_label: row.lead_engine_score_label,
    buying_stage: row.buying_stage,
    buying_stage_confidence: row.buying_stage_confidence,
    intent_score: row.intent_score,
    company_match_confidence: row.company_match_confidence,
    existing_account_status: existingAccountStatus(row),
    is_customer: row.existing_customer,
    is_prospect: row.existing_prospect,
    is_in_lead_inbox: row.in_lead_inbox,
    is_suppressed: row.is_suppressed,
    suppression_reason_safe: row.suppression_reason,
    suppression_scope_safe: row.suppression_scope,
    source_updated_at: sourceUpdatedAt ?? null,
    metadata: {
      signals: row.signals,
      keywords: row.keywords,
      notes: row.notes,
      subindustry: row.subindustry,
      lead_score: row.lead_score,
      lead_engine_score_explanation: row.lead_engine_score_explanation,
      lead_engine_last_run_at: row.lead_engine_last_run_at,
      buying_stage_reason: row.buying_stage_reason,
      buying_stage_last_assessed_at: row.buying_stage_last_assessed_at,
      search_intent_category: row.search_intent_category,
      returning_visitor: row.returning_visitor,
      existing_account: row.existing_account,
      already_pushed: row.already_pushed,
      suppressed_at: row.suppressed_at,
      lead_inbox_id: row.lead_inbox_id,
      growth_lead_id: row.growth_lead_id,
      prospect_id: row.prospect_id,
      customer_id: row.customer_id,
      verification_status: row.verification_status,
      priority: row.priority,
      decision_maker_count: row.decision_maker_count,
    },
    is_active: true,
  }
}

export function materializedRowToIndexCompany(
  row: ProspectSearchMaterializedIndexRow,
): GrowthProspectSearchIndexCompany {
  const meta = row.metadata ?? {}
  const signals = Array.isArray(meta.signals)
    ? (meta.signals as unknown[]).filter((item): item is string => typeof item === "string")
    : []
  const keywords = Array.isArray(meta.keywords)
    ? (meta.keywords as unknown[]).filter((item): item is string => typeof item === "string")
    : []

  return {
    id: row.source_id,
    source_type: row.source_type,
    company_name: row.company_name,
    website: row.website,
    industry: row.industry,
    subindustry: asString(meta.subindustry) || row.vertical,
    employees: row.employee_range,
    revenue_range: row.revenue_range,
    location: row.location_label,
    city: row.city,
    state: row.state,
    service_area: row.service_area,
    notes: asString(meta.notes) || null,
    keywords,
    crm_detected: row.crm_detected,
    website_platform: row.website_platform,
    field_service_software: row.field_service_software,
    intent_score: row.intent_score,
    buying_stage: row.buying_stage,
    buying_stage_confidence: row.buying_stage_confidence,
    buying_stage_reason: asString(meta.buying_stage_reason) || null,
    buying_stage_last_assessed_at: asString(meta.buying_stage_last_assessed_at) || null,
    lead_score: typeof meta.lead_score === "number" ? meta.lead_score : null,
    lead_engine_score: row.lead_engine_score,
    lead_engine_score_label: row.lead_engine_score_label,
    lead_engine_score_explanation: asString(meta.lead_engine_score_explanation) || null,
    lead_engine_last_run_at: asString(meta.lead_engine_last_run_at) || null,
    company_match_confidence: row.company_match_confidence,
    decision_maker_count:
      typeof meta.decision_maker_count === "number" ? meta.decision_maker_count : 0,
    verification_status: asString(meta.verification_status) || "unverified",
    priority: asString(meta.priority) || null,
    signals,
    search_intent_category: asString(meta.search_intent_category) || null,
    returning_visitor: meta.returning_visitor === true,
    existing_account: meta.existing_account === true || row.existing_account_status !== "none",
    in_lead_inbox: row.is_in_lead_inbox,
    existing_customer: row.is_customer,
    existing_prospect: row.is_prospect,
    already_pushed: meta.already_pushed === true,
    is_suppressed: row.is_suppressed,
    suppression_reason: row.suppression_reason_safe,
    suppression_scope: row.suppression_scope_safe,
    suppressed_at: asString(meta.suppressed_at) || null,
    lead_inbox_id: asString(meta.lead_inbox_id) || null,
    growth_lead_id: asString(meta.growth_lead_id) || null,
    prospect_id: asString(meta.prospect_id) || null,
    customer_id: asString(meta.customer_id) || null,
    company_signal_summary: row.company_signal_summary ?? null,
    signal_confidence: row.signal_confidence,
    signal_count: row.signal_count,
  }
}
