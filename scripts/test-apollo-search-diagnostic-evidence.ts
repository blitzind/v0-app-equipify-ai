/**
 * Apollo search diagnostic evidence — mapper rejection samples + tier compact summaries.
 * Run: pnpm test:apollo-search-diagnostic-evidence
 */
import assert from "node:assert/strict"
import {
  auditApolloPeopleMappingDetailed,
  buildApolloMapperRejectionEvidenceFromTierAttempts,
  buildApolloTierAttemptsCompactSummaries,
} from "../lib/growth/apollo/apollo-search-diagnostic-evidence"
import { mapApolloScale3CompanyEvidenceRow } from "../lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import type { ApolloSearchTierAttemptEvidence } from "../lib/growth/providers/apollo/apollo-tiered-people-search-types"
import type { ApolloPersonRecord } from "../lib/growth/providers/apollo/apollo-types"

function tierAttempt(
  partial: Partial<ApolloSearchTierAttemptEvidence> & Pick<ApolloSearchTierAttemptEvidence, "tier" | "tier_name">,
): ApolloSearchTierAttemptEvidence {
  return {
    request_payload: {},
    request_payload_summary: partial.request_payload_summary ?? partial.tier_name,
    company_domain: partial.company_domain ?? "pulsebiomedical.com",
    company_name: partial.company_name ?? "Pulse Biomedical Service",
    organization_location: partial.organization_location ?? null,
    person_titles: partial.person_titles ?? [],
    person_seniorities: partial.person_seniorities ?? [],
    domain_exact_only: partial.domain_exact_only ?? false,
    title_filter_applied: partial.title_filter_applied ?? false,
    raw_contacts_returned: partial.raw_contacts_returned ?? 0,
    mapped_contacts: partial.mapped_contacts ?? 0,
    mapping_rejections: partial.mapping_rejections ?? 0,
    rejection_reasons: partial.rejection_reasons ?? {},
    mapper_rejection_samples: partial.mapper_rejection_samples ?? [],
    apollo_status: partial.apollo_status ?? "success",
    apollo_message: partial.apollo_message ?? null,
    skipped_reason: partial.skipped_reason ?? null,
    ...partial,
  }
}

function testMapperRejectionEvidenceFromTierAttempts(): void {
  const tier_attempts = [
    tierAttempt({
      tier: 5,
      tier_name: "E_no_title_fallback",
      raw_contacts_returned: 1,
      mapped_contacts: 0,
      rejection_reasons: { organization_mismatch: 1 },
      mapper_rejection_samples: [
        {
          name: "Jane Doe",
          title: "Regional Sales Manager",
          organization_name: "Acme Medical",
          organization_domain: "acmemedical.com",
          city: "Boston",
          state: "MA",
          linkedin_url: "https://www.linkedin.com/in/janedoe",
          email_status: "unavailable",
          accepted: false,
          rejection_reason: "organization_mismatch",
        },
      ],
    }),
  ]

  const evidence = buildApolloMapperRejectionEvidenceFromTierAttempts(tier_attempts)
  assert.ok(evidence)
  assert.equal(evidence?.tier, 5)
  assert.equal(evidence?.rejected_people.length, 1)
  assert.equal(evidence?.rejected_people[0]?.rejection_reason, "organization_mismatch")
}

function testTierAttemptsCompactSummary(): void {
  const tier_attempts = [
    tierAttempt({
      tier: 1,
      tier_name: "A_strict_domain_titles",
      request_payload: { q_organization_domains_list: ["example.com"] },
      request_payload_summary: "A_strict_domain_titles;domain=example.com",
      company_domain: "example.com",
      person_titles: ["owner", "president"],
      raw_contacts_returned: 0,
      mapped_contacts: 0,
    }),
    tierAttempt({
      tier: 5,
      tier_name: "E_no_title_fallback",
      request_payload: { q_organization_domains_list: ["example.com"] },
      raw_contacts_returned: 0,
      mapped_contacts: 0,
      skipped_reason: null,
    }),
  ]

  const compact = buildApolloTierAttemptsCompactSummaries(tier_attempts)
  assert.equal(compact.length, 2)
  assert.equal(compact[0]?.query_type, "domain")
  assert.equal(compact[0]?.titles_count, 2)
  assert.equal(compact[1]?.tier_name, "E_no_title_fallback")
}

function testScale3CompanyRowIncludesDiagnostics(): void {
  const row = mapApolloScale3CompanyEvidenceRow({
    base: {
      company_candidate_id: "co-1",
      company_name: "Pulse Biomedical Service",
      domain: "pulsebiomedical.com",
      search_attempted: true,
      contacts_found: 0,
      contacts_enriched: 0,
      contacts_promoted: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: ["apollo_mapper_rejected_all"],
      error: null,
      failed: false,
    },
    acquisition: {
      apollo_search_attempted: true,
      apollo_search_skipped_reason: null,
      enrichment_attempted: false,
      enrichment_skipped_reason: null,
      enrichment_candidates_updated: 0,
      promoted_contacts: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      existing_contactable_before: 0,
      blockers: [],
      search_strategy: {
        qa_marker: "apollo-tiered-people-search-v2",
        tier_used: 5,
        chosen_tier: 5,
        chosen_tier_name: "E_no_title_fallback",
        last_attempted_tier: 5,
        last_attempted_tier_name: "E_no_title_fallback",
        stop_reason: "exhausted_all_tiers",
        tier_attempts: [
          tierAttempt({
            tier: 5,
            tier_name: "E_no_title_fallback",
            raw_contacts_returned: 1,
            mapped_contacts: 0,
            rejection_reasons: { organization_mismatch: 1 },
            mapper_rejection_samples: [
              {
                name: "Jane Doe",
                title: "Biomedical Engineer",
                organization_name: "Other Org",
                organization_domain: "other.org",
                city: null,
                state: null,
                linkedin_url: null,
                email_status: null,
                accepted: false,
                rejection_reason: "organization_mismatch",
              },
            ],
          }),
        ],
        raw_contacts_returned: 1,
        mapped_contacts: 0,
        mapping_rejections: 1,
        rejection_reasons: { organization_mismatch: 1 },
        legacy_fallback_used: false,
        legacy_contactable_count: 0,
      },
    } as never,
  })

  assert.equal(row.raw_contacts_returned, 1)
  assert.equal(row.mapped_contacts, 0)
  assert.equal(row.tier_attempts_compact.length, 1)
  assert.equal(row.mapper_rejection_evidence?.rejected_people[0]?.rejection_reason, "organization_mismatch")
}

function testPulseLikeWrongOrgRejectedAtTierE(): void {
  const person: ApolloPersonRecord = {
    id: "p-1",
    first_name: "Jane",
    last_name: "Doe",
    title: "Biomedical Equipment Specialist",
    organization: {
      name: "Unrelated Hospital Supply",
      primary_domain: "unrelatedhospital.com",
    },
    city: "Miami",
    state: "FL",
  }

  const audit = auditApolloPeopleMappingDetailed({
    people: [person],
    company_name: "Pulse Biomedical Service",
    domain: "pulsebiomedical.com",
    mock: false,
    search_tier: 5,
    mapping_policy: {
      require_organization_match: true,
      require_location_match: false,
      match_strength: "weak",
      max_mapped_contacts: 5,
    },
  })

  assert.equal(audit.mapped_count, 0)
  assert.equal(audit.rejection_reasons.organization_mismatch, 1)
}

function main(): void {
  testMapperRejectionEvidenceFromTierAttempts()
  console.log("  ✓ mapper rejection evidence from tier attempts")
  testTierAttemptsCompactSummary()
  console.log("  ✓ tier attempts compact summary")
  testScale3CompanyRowIncludesDiagnostics()
  console.log("  ✓ Scale-3 company row includes diagnostic fields")
  testPulseLikeWrongOrgRejectedAtTierE()
  console.log("  ✓ Pulse-like wrong-org person rejected at tier E")
  console.log("\nApollo search diagnostic evidence checks passed.")
}

main()
