/** Normalized Discover-mode prospect rows — client-safe. */

import {
  formatProspectSearchContactCoverageLabel,
  resolveProspectSearchContactCoverageStatus,
} from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoverResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_DISCOVER_RESULTS_TABLE_QA_MARKER = "growth-discover-results-table-v1" as const
export const GROWTH_DISCOVER_CONTACT_ROW_QA_MARKER = "growth-discover-contact-row-v1" as const
export const GROWTH_DISCOVER_COMPANY_INTELLIGENCE_PANEL_QA_MARKER =
  "growth-discover-company-intelligence-panel-v1" as const

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return website.replace(/^https?:\/\//, "").split("/")[0] ?? null
  }
}

function resolveContactFieldStatus(value: string | null | undefined): string {
  if (value?.trim()) return "verified"
  return "unavailable"
}

function pickPrimaryContact(company: GrowthProspectSearchCompanyResult) {
  const intelligence = company.contact_intelligence
  const first =
    intelligence?.first_contact ??
    (intelligence?.contacts?.[0]
      ? {
          contact_id: intelligence.contacts[0].id,
          name: intelligence.contacts[0].name,
          role: intelligence.contacts[0].role_type,
          confidence: intelligence.contacts[0].confidence,
        }
      : null)

  const overlay = intelligence?.contacts?.[0]
  return {
    contact_id: first?.contact_id ?? overlay?.id ?? null,
    contact_name: first?.name ?? overlay?.name ?? null,
    contact_title: overlay?.title ?? first?.role ?? null,
    contact_email: overlay?.email ?? null,
    contact_email_status: overlay?.email ? "verified" : resolveContactFieldStatus(overlay?.email),
    contact_phone: overlay?.phone ?? null,
    contact_phone_status: overlay?.phone ? "verified" : resolveContactFieldStatus(overlay?.phone),
    confidence: first?.confidence ?? overlay?.confidence ?? company.confidence,
    evidence: overlay?.source_evidence?.[0]?.evidence ?? company.match_reasoning?.[0] ?? null,
  }
}

export function mapProspectSearchCompanyToDiscoverResult(
  company: GrowthProspectSearchCompanyResult,
): GrowthProspectSearchDiscoverResult {
  const contact = pickPrimaryContact(company)
  const coverageStatus = resolveProspectSearchContactCoverageStatus(company)
  return {
    company_id: company.id,
    provider_company_id: company.id,
    company_name: company.company_name,
    domain: domainFromWebsite(company.website),
    website: company.website,
    industry: company.industry,
    location: company.location,
    employee_count: company.employees,
    company_size: company.employees,
    revenue: company.revenue_range,
    contact_id: contact.contact_id,
    provider_contact_id: contact.contact_id,
    contact_name: contact.contact_name,
    contact_title: contact.contact_title,
    contact_email: contact.contact_email,
    contact_email_status: contact.contact_email_status,
    contact_phone: contact.contact_phone,
    contact_phone_status: contact.contact_phone_status,
    source_provider:
      company.discovery_provider_name ??
      company.discovery_source_badge ??
      company.source_type,
    confidence: contact.confidence,
    evidence: contact.evidence,
    lead_score: company.lead_engine_score ?? company.lead_score,
    icp_fit: company.company_match_confidence,
    buying_stage: company.buying_stage,
    buying_signals: company.signals ?? [],
    company,
    contact_coverage_status: coverageStatus,
    contact_coverage_label: formatProspectSearchContactCoverageLabel(coverageStatus),
  }
}

export function mapProspectSearchCompaniesToDiscoverResults(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchDiscoverResult[] {
  return companies.map(mapProspectSearchCompanyToDiscoverResult)
}

export function formatDiscoverContactField(
  value: string | null | undefined,
  status: string | null | undefined,
  reason?: string | null,
): string {
  if (value?.trim()) return value
  if (reason?.trim()) return reason
  if (status === "reveal") return "Reveal"
  if (status === "verified") return "Verified"
  return "Not available yet"
}
