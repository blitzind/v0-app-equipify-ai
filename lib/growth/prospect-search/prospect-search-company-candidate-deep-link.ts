/**
 * Operator-only Prospect Search deep link — load a staging company for Apollo review.
 * No provider search, Apollo acquisition, enrollment, or outreach.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  loadStagingCompanyCandidateRow,
  type LoadedStagingCompanyCandidateRow,
} from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { buildProspectSearchCompanyCandidateDeepLinkResult } from "@/lib/growth/prospect-search/prospect-search-company-candidate-deep-link-build"
import { refreshProspectSearchCompanyAfterHumanAcquisition } from "@/lib/growth/prospect-search/prospect-search-human-acquisition-hydration"
import { GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-company-candidate-deep-link-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchResult,
} from "@/lib/growth/prospect-search/prospect-search-types"

export { buildProspectSearchCompanyCandidateDeepLinkResult } from "@/lib/growth/prospect-search/prospect-search-company-candidate-deep-link-build"

export { GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER }

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function resolveProspectSearchCompanyCandidateId(
  staging: LoadedStagingCompanyCandidateRow,
): string {
  const row = staging.row
  if (staging.source_table === "discovery_candidates") {
    return asString(row.company_id) || staging.lookup_key
  }
  return staging.staging_row_id || staging.lookup_key
}

function stagingRowToCompanyResult(
  staging: LoadedStagingCompanyCandidateRow,
  input?: { canonical_company_id?: string | null },
): GrowthProspectSearchCompanyResult {
  const row = staging.row
  const company_candidate_id = resolveProspectSearchCompanyCandidateId(staging)
  const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
  const website = asString(row.website) || (domain ? `https://${domain}` : null)
  const locationParts = [asString(row.city), asString(row.state), asString(row.country)].filter(
    Boolean,
  )

  const provider_type =
    staging.source_table === "discovery_candidates"
      ? asString(row.discovery_source_type) || asString(row.source_type) || "discovery"
      : asString(row.provider_type) || "external_discovered"
  const provider_name =
    staging.source_table === "discovery_candidates"
      ? "discovery_candidates"
      : asString(row.provider_name) || staging.source_table

  const reason =
    staging.source_table === "discovery_candidates"
      ? asString(row.reason_discovered)
      : asString(row.description)

  return {
    id: company_candidate_id,
    source_type: "external_discovered",
    company_name: asString(row.company_name) || company_candidate_id,
    website,
    industry: asString(row.industry) || null,
    subindustry:
      staging.source_table === "discovery_candidates" ? null : asString(row.category) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    employees: null,
    revenue_range: null,
    location: locationParts.length ? locationParts.join(", ") : null,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence:
      staging.source_table === "discovery_candidates"
        ? asNum(row.source_confidence)
        : asNum(row.confidence),
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: [
      reason || "Operator-linked staging company for Apollo acquisition review.",
      `Loaded from ${staging.source_table} — no live provider search was run.`,
    ],
    search_intent_category: null,
    lead_inbox_id: null,
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
    rank_score: 1,
    match_reasoning: [
      "Opened via operator company-candidate deep link.",
      "Apollo operator review only — no auto-discovery, enrollment, or outreach.",
    ],
    discovery_provider_type: provider_type,
    discovery_provider_name: provider_name,
    discovery_source_badge: provider_type,
    canonical_company_id:
      input?.canonical_company_id?.trim() ||
      asString(row.canonical_company_id) ||
      null,
    is_suppressed: row.is_suppressed === true,
  }
}

export async function loadProspectSearchCompanyCandidateForOperatorReview(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    canonical_company_id?: string | null
  },
): Promise<{
  ok: boolean
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER
  company: GrowthProspectSearchCompanyResult | null
  result: GrowthProspectSearchResult | null
  source_table: string | null
  message: string
}> {
  const company_candidate_id = input.company_candidate_id.trim()
  if (!company_candidate_id) {
    return {
      ok: false,
      qa_marker: GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
      company: null,
      result: null,
      source_table: null,
      message: "company_candidate_id is required.",
    }
  }

  const staging = await loadStagingCompanyCandidateRow(admin, company_candidate_id)
  if (!staging) {
    return {
      ok: false,
      qa_marker: GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
      company: null,
      result: null,
      source_table: null,
      message: `No staging company candidate found for ${company_candidate_id}.`,
    }
  }

  const resolvedId = resolveProspectSearchCompanyCandidateId(staging)
  const base = stagingRowToCompanyResult(staging, {
    canonical_company_id: input.canonical_company_id ?? null,
  })

  const company = await refreshProspectSearchCompanyAfterHumanAcquisition(admin, {
    company: base,
    canonical_company_id:
      input.canonical_company_id?.trim() ||
      base.canonical_company_id ||
      null,
    query: base.company_name,
  })

  const result = buildProspectSearchCompanyCandidateDeepLinkResult(company, {
    company_candidate_id: resolvedId,
    source_table: staging.source_table,
  })

  return {
    ok: true,
    qa_marker: GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
    company,
    result,
    source_table: staging.source_table,
    message: `Loaded ${company.company_name} from ${staging.source_table} for operator review.`,
  }
}
