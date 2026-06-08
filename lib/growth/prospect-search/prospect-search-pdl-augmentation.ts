import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createPeopleDataLabsContactDiscoveryProvider } from "@/lib/growth/contact-discovery/providers/people-data-labs-provider"
import { persistProviderContactsAndSync } from "@/lib/growth/providers/pdl/pdl-contact-persistence"
import { isPdlApiConfigured, isPdlDiscoveryDisabled } from "@/lib/growth/providers/pdl/pdl-config"
import { GROWTH_PDL_PROVIDER_QA_MARKER } from "@/lib/growth/providers/pdl/pdl-types"
import { applyProspectSearchContactIntelligenceOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-loader"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchParsedQuery,
} from "@/lib/growth/prospect-search/prospect-search-types"

const DEFAULT_PDL_AUGMENTATION_BATCH = 25

function resolveCompanyDomain(website: string | null | undefined): string | null {
  try {
    const raw = website?.trim()
    if (!raw) return null
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function companyNeedsPdlContactAugmentation(
  company: GrowthProspectSearchCompanyResult,
): boolean {
  const contacts = company.contact_intelligence?.contacts ?? []
  const reachable = contacts.filter(
    (contact) =>
      contact.name.trim().length > 0 && (contact.email?.trim() || contact.phone?.trim()),
  )
  if (reachable.length >= 2) return false
  return Boolean(company.website?.trim() || company.company_name?.trim())
}

export async function augmentProspectSearchCompaniesWithPdl(
  admin: SupabaseClient,
  input: {
    companies: GrowthProspectSearchCompanyResult[]
    query: string
    filters: GrowthProspectSearchFilters
    parsed: GrowthProspectSearchParsedQuery
    batch_size?: number
  },
): Promise<{
  qa_marker: typeof GROWTH_PDL_PROVIDER_QA_MARKER
  attempted: number
  augmented: number
  skipped_reason: string | null
  companies: GrowthProspectSearchCompanyResult[]
}> {
  const base = {
    qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
    attempted: 0,
    augmented: 0,
    skipped_reason: null as string | null,
    companies: input.companies,
  }

  if (!isPdlApiConfigured() || isPdlDiscoveryDisabled()) {
    return {
      ...base,
      skipped_reason: isPdlDiscoveryDisabled()
        ? "PDL disabled via GROWTH_DISCOVERY_DISABLE_PDL"
        : "PEOPLE_DATA_LABS_API_KEY not configured",
    }
  }

  const candidates = input.companies.filter(companyNeedsPdlContactAugmentation)
  if (candidates.length === 0) {
    return { ...base, skipped_reason: "All visible companies already have sufficient internal contacts." }
  }

  const batch = candidates.slice(0, input.batch_size ?? DEFAULT_PDL_AUGMENTATION_BATCH)
  const provider = createPeopleDataLabsContactDiscoveryProvider(admin)
  let augmented = 0

  for (const company of batch) {
    base.attempted += 1
    const result = await provider.discover({
      company_candidate_id: company.id,
      company_name: company.company_name,
      domain: resolveCompanyDomain(company.website),
      website_url: company.website ?? null,
      growth_lead_id: company.growth_lead_id ?? null,
      industry: company.industry ?? null,
      limit: 25,
    })

    if (result.status !== "success" || result.contacts.length === 0) continue

    if (company.source_type === "external_discovered") {
      try {
        await persistProviderContactsAndSync(admin, {
          company_candidate_id: company.id,
          canonical_company_id: company.canonical_company_id ?? null,
          provider_name: result.provider_name,
          provider_type: result.provider_type,
          contacts: result.contacts,
        })
      } catch {
        // Non-blocking — hydration overlay may still surface in-memory provider contacts.
      }
    }

    augmented += 1
  }

  if (augmented === 0) {
    return { ...base, skipped_reason: "PDL returned no augmenting contacts for this batch." }
  }

  const refreshed = await applyProspectSearchContactIntelligenceOverlay(admin, input.companies, {
    query: input.query,
    filters: input.filters,
    parsed: input.parsed,
  })

  return {
    ...base,
    augmented,
    companies: refreshed,
  }
}
