/**
 * Apollo acquisition search evidence — blocker normalization + outcome classification.
 * Run: pnpm test:apollo-acquisition-search-evidence
 */
import assert from "node:assert/strict"
import {
  buildApolloAcquisitionSearchEvidence,
  normalizeApolloAcquisitionSearchBlockers,
  resolveApolloAcquisitionSearchOutcome,
} from "../lib/growth/apollo/apollo-acquisition-search-evidence"

function testZeroMappedAlwaysIncludesBlocker(): void {
  const blockers = normalizeApolloAcquisitionSearchBlockers({
    blockers: ["no_enriched_candidates_with_contact_channel"],
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    apollo_raw_people_count: 0,
    apollo_mapped_people_count: 0,
  })
  assert.ok(blockers.includes("apollo_zero_contacts_mapped"))
}

function testMapperRejectedWhenRawPresent(): void {
  const blockers = normalizeApolloAcquisitionSearchBlockers({
    blockers: [],
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    apollo_raw_people_count: 5,
    apollo_mapped_people_count: 0,
  })
  assert.ok(blockers.includes("apollo_mapper_rejected_all"))
  assert.ok(blockers.includes("apollo_zero_contacts_mapped"))
  assert.equal(
    resolveApolloAcquisitionSearchOutcome({
      apollo_search_attempted: true,
      apollo_search_skipped_reason: null,
      apollo_raw_people_count: 5,
      apollo_mapped_people_count: 0,
      provider_ready: true,
      search_blockers: blockers,
    }),
    "mapper_rejected",
  )
}

function testSearchSkippedBlocker(): void {
  const blockers = normalizeApolloAcquisitionSearchBlockers({
    blockers: [],
    apollo_search_attempted: false,
    apollo_search_skipped_reason: "apollo_search_skipped",
    apollo_raw_people_count: 0,
    apollo_mapped_people_count: 0,
  })
  assert.ok(blockers.includes("apollo_search_skipped:apollo_search_skipped"))
}

function testBuildSearchEvidenceQuerySummary(): void {
  const built = buildApolloAcquisitionSearchEvidence({
    company_name: "Medical Equipment Solutions",
    company_domain: "medicalequipmentsolutions.com",
    apollo_search_attempted: true,
    apollo_search_skipped_reason: null,
    apollo_persisted_this_run: 0,
    existing_contactable_before: 2,
    blockers: [],
    search_strategy: {
      qa_marker: "apollo-tiered-people-search-v1",
      tier_used: 1,
      tier_attempts: [
        {
          tier: 1,
          tier_name: "A_strict_domain_titles",
          request_payload: { q_organization_domains: "medicalequipmentsolutions.com" },
          request_payload_summary: "A_strict_domain_titles;domain=medicalequipmentsolutions.com",
          company_domain: "medicalequipmentsolutions.com",
          company_name: "Medical Equipment Solutions",
          organization_location: null,
          person_titles: ["owner"],
          person_seniorities: ["owner"],
          domain_exact_only: true,
          title_filter_applied: true,
          raw_contacts_returned: 0,
          mapped_contacts: 0,
          mapping_rejections: 0,
          rejection_reasons: {},
          apollo_status: "success",
          apollo_message: null,
          skipped_reason: null,
        },
      ],
      raw_contacts_returned: 0,
      mapped_contacts: 0,
      mapping_rejections: 0,
      rejection_reasons: {},
      legacy_fallback_used: false,
      legacy_contactable_count: 0,
    },
    env: {
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
      GROWTH_APOLLO_USE_MOCK: "false",
      APOLLO_API_KEY: "test-key",
    } as NodeJS.ProcessEnv,
  })

  assert.equal(built.apollo_search_evidence.search_outcome, "zero_raw")
  assert.equal(built.apollo_search_evidence.apollo_query_summary?.company_domain, "medicalequipmentsolutions.com")
  assert.ok(built.apollo_search_blockers.includes("apollo_zero_contacts_mapped"))
}

function main(): void {
  testZeroMappedAlwaysIncludesBlocker()
  console.log("  ✓ tier-1 mapped=0 includes apollo_zero_contacts_mapped")
  testMapperRejectedWhenRawPresent()
  console.log("  ✓ raw>0 mapped=0 classified as mapper_rejected")
  testSearchSkippedBlocker()
  console.log("  ✓ skipped search emits explicit skip blocker")
  testBuildSearchEvidenceQuerySummary()
  console.log("  ✓ search evidence includes query summary + outcome")
  console.log("\nApollo acquisition search evidence checks passed.")
}

main()
