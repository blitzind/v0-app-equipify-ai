import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryProviderRawCandidate,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"

const FIXTURE_COMPANIES: GrowthRealWorldDiscoveryProviderRawCandidate[] = [
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
    description: "Biomedical equipment repair and PM for hospital systems.",
    rating: 4.6,
    review_count: 128,
    source_url: "fixture://real_world/precision-biomed",
    source_rank: 1,
    confidence: 0.72,
    evidence: [
      {
        claim: "Fixture public listing",
        evidence: "Fixture fallback — biomedical equipment service in Boston metro.",
        source: "growth.real_world_discovery.fixture",
      },
    ],
    source_attribution: [
      {
        source: "growth.real_world_discovery.fixture",
        provider_type: "fixture",
        provider_name: "real_world_fixture",
        signal: "fixture_listing",
        evidence: "Labeled fixture data when no live provider is configured.",
        confidence: 0.72,
      },
    ],
    raw_payload_server_only: { fixture_id: "precision-biomed" },
  },
  {
    company_name: "Summit Commercial HVAC",
    website: "https://summithvac.example",
    domain: "summithvac.example",
    industry: "commercial HVAC",
    location: "Dallas, TX",
    city: "Dallas",
    state: "TX",
    country: "US",
    category: "Commercial HVAC service",
    description: "Commercial HVAC installation and service.",
    rating: 4.4,
    review_count: 210,
    source_url: "fixture://real_world/summit-hvac",
    source_rank: 2,
    confidence: 0.7,
    evidence: [
      {
        claim: "Fixture public listing",
        evidence: "Fixture fallback — commercial HVAC in Dallas (20–100 employee band query).",
        source: "growth.real_world_discovery.fixture",
      },
    ],
    source_attribution: [
      {
        source: "growth.real_world_discovery.fixture",
        provider_type: "fixture",
        provider_name: "real_world_fixture",
        signal: "fixture_listing",
        evidence: "Fixture listing for real-world discovery validation.",
        confidence: 0.7,
      },
    ],
    raw_payload_server_only: { fixture_id: "summit-hvac" },
  },
  {
    company_name: "Pacific Field Service Group",
    website: "https://pacificfield.example",
    domain: "pacificfield.example",
    industry: "field service",
    location: "Los Angeles, CA",
    city: "Los Angeles",
    state: "CA",
    country: "US",
    category: "Field service operations",
    description: "Multi-trade field service operator.",
    rating: 4.2,
    review_count: 67,
    source_url: "fixture://real_world/pacific-field",
    source_rank: 3,
    confidence: 0.66,
    evidence: [
      {
        claim: "Fixture public listing",
        evidence: "Fixture fallback — field service companies in California.",
        source: "growth.real_world_discovery.fixture",
      },
    ],
    source_attribution: [
      {
        source: "growth.real_world_discovery.fixture",
        provider_type: "fixture",
        provider_name: "real_world_fixture",
        signal: "fixture_listing",
        evidence: "Fixture listing — no live API keys configured.",
        confidence: 0.66,
      },
    ],
    raw_payload_server_only: { fixture_id: "pacific-field" },
  },
]

function matchesHints(
  row: GrowthRealWorldDiscoveryProviderRawCandidate,
  input: GrowthRealWorldDiscoveryQuery,
): boolean {
  const blob = [
    row.company_name,
    row.industry,
    row.location,
    row.city,
    row.state,
    row.category,
    row.description,
    input.query,
    input.industry,
    input.subindustry,
    input.location,
    ...(input.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const tokens = [
    ...(input.industry ?? "").split(/\s+/),
    ...(input.subindustry ?? "").split(/\s+/),
    ...(input.location ?? "").split(/\s+/),
    ...input.query.split(/\s+/),
    ...(input.keywords ?? []),
  ]
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 2)

  if (tokens.length === 0) return true
  return tokens.some((t) => blob.includes(t))
}

export function createRealWorldFixtureProvider(): GrowthRealWorldDiscoveryProvider {
  return {
    provider_name: "real_world_fixture",
    provider_type: "fixture",
    isConfigured: () => true,
    discover: async (input: GrowthRealWorldDiscoveryQuery) => {
      const limit = input.limit ?? 25
      const filtered = FIXTURE_COMPANIES.filter((row) => matchesHints(row, input)).slice(
        0,
        limit,
      )
      return {
        provider_name: "real_world_fixture",
        provider_type: "fixture",
        status: "success",
        message: filtered.length
          ? `${filtered.length} fixture listing(s) — live providers not configured.`
          : "No fixture listings matched — broaden industry or location.",
        candidates: filtered,
      }
    },
  }
}
