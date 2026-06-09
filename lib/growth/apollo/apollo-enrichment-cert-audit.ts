/** Apollo EN-1 — enrichment path audit (client-safe). */

export const APOLLO_ENRICHMENT_CERT_AUDIT_QA_MARKER = "apollo-enrichment-cert-audit-en-1-v1" as const

export type ApolloEnrichmentPathAuditEntry = {
  path_id: string
  name: string
  primary_files: string[]
  key_functions: string[]
  works_on_apollo_search_only: boolean
  search_only_notes: string
  credit_cost: string
  env_gates: string[]
  recommended_for_en_1: boolean
  recommendation_rank: number | null
}

export const APOLLO_ENRICHMENT_PATH_AUDIT: ApolloEnrichmentPathAuditEntry[] = [
  {
    path_id: "apollo_bulk_match",
    name: "Apollo people/bulk_match",
    primary_files: [
      "lib/growth/providers/apollo/apollo-enrich-people.ts",
      "lib/growth/providers/apollo/apollo-client.ts",
    ],
    key_functions: ["enrichApolloPeopleWithBulkMatch", "searchApolloPeopleByCompany"],
    works_on_apollo_search_only: true,
    search_only_notes:
      "Requires apollo_person_id from search. Reveals email/phone/LinkedIn for known Apollo person rows. Safest post-search enrichment path.",
    credit_cost: "~1 credit batch per 10 person IDs (APOLLO_BULK_MATCH_BATCH_SIZE=10)",
    env_gates: ["GROWTH_APOLLO_ENRICH_EMAILS=true", "GROWTH_APOLLO_ENRICH_EMAILS_ACK=1"],
    recommended_for_en_1: true,
    recommendation_rank: 1,
  },
  {
    path_id: "zerobounce",
    name: "ZeroBounce email verification",
    primary_files: [
      "lib/growth/contact-verification/providers/zerobounce-client.ts",
      "lib/growth/email-discovery/email-discovery-verification.ts",
    ],
    key_functions: ["verifyEmailWithZeroBounce"],
    works_on_apollo_search_only: false,
    search_only_notes:
      "Verification only — needs an email candidate already present. Does not discover channels for name+title-only Apollo rows.",
    credit_cost: "Per validation call (ZeroBounce credits)",
    env_gates: ["ZEROBOUNCE_API_KEY or GROWTH_ZEROBOUNCE_API_KEY"],
    recommended_for_en_1: false,
    recommendation_rank: null,
  },
  {
    path_id: "pdl",
    name: "People Data Labs person search",
    primary_files: [
      "lib/growth/providers/pdl/pdl-client.ts",
      "lib/growth/contact-discovery/providers/people-data-labs-provider.ts",
    ],
    key_functions: ["searchPdlPeopleByCompany", "mapPdlPeopleToContactDiscoveryRaw"],
    works_on_apollo_search_only: false,
    search_only_notes:
      "Parallel discovery provider — searches PDL by company, not enrichment of existing Apollo person IDs. Higher overlap cost, separate identity reconciliation.",
    credit_cost: "PDL API credits per search",
    env_gates: ["PEOPLE_DATA_LABS_API_KEY or PDL_API_KEY", "GROWTH_CONTACT_DISCOVERY_PDL_ENABLED"],
    recommended_for_en_1: false,
    recommendation_rank: null,
  },
  {
    path_id: "website_discovery",
    name: "Website crawl / team page extraction",
    primary_files: [
      "lib/growth/contact-discovery/website-extraction-enrichment.ts",
      "lib/growth/contact-discovery/website-contact-discovery.ts",
    ],
    key_functions: ["enrichExtractedWebsiteContacts"],
    works_on_apollo_search_only: false,
    search_only_notes:
      "Discovers contacts from public website pages. Name matching to Apollo rows is heuristic; no apollo_person_id linkage.",
    credit_cost: "Crawl/compute only (no Apollo credits)",
    env_gates: ["Website discovery provider enabled", "company website URL resolvable"],
    recommended_for_en_1: false,
    recommendation_rank: 3,
  },
  {
    path_id: "internal_email_discovery",
    name: "Internal email discovery queue",
    primary_files: [
      "lib/growth/email-discovery/email-discovery-queue.ts",
      "lib/growth/email-discovery/email-discovery-promote.ts",
    ],
    key_functions: ["enqueueEmailDiscovery", "promoteEmailDiscoveryCandidate"],
    works_on_apollo_search_only: false,
    search_only_notes:
      "Pattern/role-based email inference for canonical persons. Requires person identity + company domain; not wired to Apollo bulk_match IDs.",
    credit_cost: "ZeroBounce on promotion when configured",
    env_gates: ["Email discovery cron/worker", "canonical person linkage"],
    recommended_for_en_1: false,
    recommendation_rank: 4,
  },
  {
    path_id: "internal_phone_discovery",
    name: "Internal phone discovery queue",
    primary_files: [
      "lib/growth/phone-discovery/phone-discovery-queue.ts",
      "lib/growth/phone-discovery/phone-discovery-verification.ts",
    ],
    key_functions: ["enqueuePhoneDiscovery"],
    works_on_apollo_search_only: false,
    search_only_notes:
      "Phone inference from website/PDL evidence. Same identity linkage requirements as email discovery.",
    credit_cost: "Provider-dependent",
    env_gates: ["Phone discovery cron/worker"],
    recommended_for_en_1: false,
    recommendation_rank: 5,
  },
  {
    path_id: "internal_growth_enrichment",
    name: "Internal growth enrichment provider",
    primary_files: ["lib/growth/enrichment/providers/internal-growth-provider.ts"],
    key_functions: ["createInternalGrowthEnrichmentProvider"],
    works_on_apollo_search_only: false,
    search_only_notes:
      "Reads stored contact_candidates evidence — does not fetch new channels from external APIs.",
    credit_cost: "None",
    env_gates: [],
    recommended_for_en_1: false,
    recommendation_rank: null,
  },
]

export function getRecommendedApolloEnrichmentPath(): ApolloEnrichmentPathAuditEntry {
  const recommended = APOLLO_ENRICHMENT_PATH_AUDIT.find((entry) => entry.recommended_for_en_1)
  if (!recommended) {
    throw new Error("No recommended Apollo enrichment path configured in audit.")
  }
  return recommended
}

export function listApolloEnrichmentPathsForSearchOnlyCandidates(): ApolloEnrichmentPathAuditEntry[] {
  return APOLLO_ENRICHMENT_PATH_AUDIT.filter((entry) => entry.works_on_apollo_search_only)
}
