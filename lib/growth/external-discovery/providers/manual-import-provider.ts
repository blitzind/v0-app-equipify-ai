import type {
  GrowthExternalDiscoveryProvider,
  GrowthExternalDiscoveryProviderRawCandidate,
  GrowthExternalDiscoveryQuery,
} from "@/lib/growth/external-discovery/external-discovery-provider-types"

/** Fixture listings — labeled manual_import, no paid API keys required. */
const FIXTURE_COMPANIES: GrowthExternalDiscoveryProviderRawCandidate[] = [
  {
    company_name: "Precision Biomed Services",
    website: "https://precisionbiomed.com",
    domain: "precisionbiomed.com",
    industry: "biomedical equipment service",
    location: "Boston, MA",
    city: "Boston",
    state: "MA",
    country: "US",
    category: "Medical equipment repair",
    rating: 4.6,
    review_count: 128,
    source_url: "fixture://manual_import/precision-biomed",
    confidence: 0.72,
    evidence: [
      {
        claim: "Fixture business listing",
        evidence: "Manual import fixture — biomedical equipment service in Boston metro.",
        source: "growth.external_discovery.manual_import",
      },
    ],
    source_attribution: [
      {
        source: "growth.external_discovery.manual_import",
        provider_type: "manual_import",
        provider_name: "manual_fixture",
        signal: "fixture_listing",
        evidence: "Operator-safe fixture data for UI and pipeline validation.",
        confidence: 0.72,
      },
    ],
    raw_payload: { fixture_id: "precision-biomed", source: "manual_import" },
  },
  {
    company_name: "Northstar Field Service Co.",
    website: "https://northstarfieldservice.example",
    domain: "northstarfieldservice.example",
    industry: "field service",
    location: "Denver, CO",
    city: "Denver",
    state: "CO",
    country: "US",
    category: "Commercial HVAC service",
    rating: 4.3,
    review_count: 89,
    source_url: "fixture://manual_import/northstar-field",
    confidence: 0.68,
    evidence: [
      {
        claim: "Fixture business listing",
        evidence: "Manual import fixture — field service operator in Denver.",
        source: "growth.external_discovery.manual_import",
      },
    ],
    source_attribution: [
      {
        source: "growth.external_discovery.manual_import",
        provider_type: "manual_import",
        provider_name: "manual_fixture",
        signal: "fixture_listing",
        evidence: "Fixture listing for external discovery pipeline.",
        confidence: 0.68,
      },
    ],
    raw_payload: { fixture_id: "northstar-field", source: "manual_import" },
  },
  {
    company_name: "Gulf Coast Imaging Maintenance",
    website: "https://gulfcoastimaging.example",
    domain: "gulfcoastimaging.example",
    industry: "medical imaging",
    location: "Houston, TX",
    city: "Houston",
    state: "TX",
    country: "US",
    category: "Imaging equipment service",
    rating: 4.8,
    review_count: 54,
    source_url: "fixture://manual_import/gulf-coast-imaging",
    confidence: 0.7,
    evidence: [
      {
        claim: "Fixture business listing",
        evidence: "Manual import fixture — imaging maintenance in Houston.",
        source: "growth.external_discovery.manual_import",
      },
    ],
    source_attribution: [
      {
        source: "growth.external_discovery.manual_import",
        provider_type: "manual_import",
        provider_name: "manual_fixture",
        signal: "fixture_listing",
        evidence: "Fixture listing for discover-new-companies mode.",
        confidence: 0.7,
      },
    ],
    raw_payload: { fixture_id: "gulf-coast-imaging", source: "manual_import" },
  },
]

function matchesHints(
  row: GrowthExternalDiscoveryProviderRawCandidate,
  industry: string | null,
  location: string | null,
  query: string,
): boolean {
  const blob = [
    row.company_name,
    row.industry,
    row.location,
    row.city,
    row.state,
    row.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const tokens = [
    ...(industry ?? "").split(/\s+/),
    ...(location ?? "").split(/\s+/),
    ...query.split(/\s+/),
  ]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2)

  if (tokens.length === 0) return true
  return tokens.some((t) => blob.includes(t))
}

export function createManualImportExternalDiscoveryProvider(): GrowthExternalDiscoveryProvider {
  return {
    provider_name: "manual_fixture",
    provider_type: "manual_import",
    isConfigured: () => true,
    discover: async (input: GrowthExternalDiscoveryQuery) => {
      const limit = input.limit ?? 25
      const filtered = FIXTURE_COMPANIES.filter((row) =>
        matchesHints(row, input.industry, input.location, input.query),
      ).slice(0, limit)

      return {
        provider_name: "manual_fixture",
        provider_type: "manual_import",
        status: filtered.length ? "success" : "success",
        message:
          filtered.length > 0
            ? `${filtered.length} fixture listing(s) matched industry/location/query.`
            : "No fixture listings matched — broaden industry or location.",
        candidates: filtered,
      }
    },
  }
}
