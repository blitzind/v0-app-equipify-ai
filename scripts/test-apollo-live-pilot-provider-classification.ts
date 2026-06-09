/**
 * Apollo live pilot provider classification matrix.
 * Run: pnpm test:apollo-live-pilot-provider-classification
 */
import assert from "node:assert/strict"
import {
  buildApolloLivePilotProviderDiscoveryError,
  buildApolloLivePilotProviderEvidence,
  classifyApolloLivePilotProviderEvidence,
  type ApolloLivePilotProviderClassification,
} from "../lib/growth/apollo/apollo-live-pilot-provider-evidence"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"

type MatrixCase = {
  name: string
  expected: ApolloLivePilotProviderClassification
  emitsError: boolean
  input: Parameters<typeof buildApolloLivePilotProviderEvidence>[0]
}

function channelLessCandidate(index: number): GrowthContactCandidate {
  return {
    id: `c-${index}`,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    company_candidate_id: "co-1",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name: "Carrie Ki***g",
    first_name: "Carrie",
    last_name: "Ki***g",
    job_title: "Executive Vice President, Chief Operating Officer",
    department: null,
    seniority: null,
    linkedin_url: null,
    email: null,
    phone: null,
    verification_state: "unverified",
    confidence: 0.58,
    source_attribution: [],
    evidence: [],
    dedupe_hash: `hash-${index}`,
    metadata: {},
  }
}

function contactableCandidate(index: number): GrowthContactCandidate {
  return {
    ...channelLessCandidate(index),
    full_name: "Jane Doe",
    first_name: "Jane",
    last_name: "Doe",
    job_title: "CEO",
    email: "jane@example.com",
    dedupe_hash: `contactable-${index}`,
  }
}

const MATRIX: MatrixCase[] = [
  {
    name: "zero_results",
    expected: "apollo_zero_results",
    emitsError: true,
    input: {
      provider_result: {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message: "Apollo returned zero people (0 total matches)",
        contacts: [],
        metadata: {
          apollo_people_returned: 0,
          apollo_total_matches: 0,
          apollo_people_mapped: 0,
          apollo_people_rejected: 0,
        },
      },
      candidates_stored: 0,
      company_contacts_synced: 0,
      canonical_sync_rejected: 0,
    },
  },
  {
    name: "rejected_by_mapping",
    expected: "apollo_results_rejected_by_mapping",
    emitsError: true,
    input: {
      provider_result: {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message: "Apollo returned 3 people (3 total matches)",
        contacts: [],
        metadata: {
          apollo_people_returned: 3,
          apollo_total_matches: 3,
          apollo_people_mapped: 0,
          apollo_people_rejected: 3,
          rejection_reasons: { identity_individual: 3 },
        },
      },
      candidates_stored: 0,
      company_contacts_synced: 0,
      canonical_sync_rejected: 0,
    },
  },
  {
    name: "missing_contact_channels_stored_candidates",
    expected: "apollo_results_missing_contact_channels",
    emitsError: false,
    input: {
      provider_result: {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message: "Mapped 10 contact(s)",
        contacts: [],
        metadata: {
          apollo_people_returned: 10,
          apollo_total_matches: 10,
          apollo_people_mapped: 10,
          apollo_people_rejected: 0,
          missing_email_count: 10,
          missing_phone_count: 10,
        },
      },
      candidates_stored: 10,
      company_contacts_synced: 0,
      canonical_sync_rejected: 10,
      canonical_sync_attempted: true,
      canonical_sync_rejection_reasons: { missing_contact_channel: 10 },
      candidates: Array.from({ length: 10 }, (_, index) => channelLessCandidate(index)),
    },
  },
  {
    name: "missing_contact_channels_henry_schein_deduped",
    expected: "apollo_results_missing_contact_channels",
    emitsError: false,
    input: {
      provider_result: {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message: "Apollo returned 10 people (10 total matches) Mapped 10 contact(s); skipped 0.",
        contacts: [],
        metadata: {
          apollo_people_returned: 10,
          apollo_total_matches: 10,
          apollo_people_mapped: 10,
          apollo_people_rejected: 0,
          rejection_reasons: {},
          missing_email_count: 10,
          missing_phone_count: 10,
        },
      },
      candidates_stored: 0,
      company_contacts_synced: 0,
      canonical_sync_rejected: 0,
      canonical_sync_attempted: false,
      canonical_sync_rejection_reasons: {},
      candidates: [],
    },
  },
  {
    name: "rejected_by_canonical_sync",
    expected: "apollo_results_rejected_by_canonical_sync",
    emitsError: true,
    input: {
      provider_result: {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message: "Mapped 1 contact(s)",
        contacts: [{ full_name: "Jane Doe" } as never],
        metadata: {
          apollo_people_returned: 1,
          apollo_total_matches: 1,
          apollo_people_mapped: 1,
          apollo_people_rejected: 0,
        },
      },
      candidates_stored: 1,
      company_contacts_synced: 0,
      canonical_sync_rejected: 1,
      canonical_sync_attempted: true,
      canonical_sync_rejection_reasons: { insert_failed: 1 },
      candidates: [contactableCandidate(0)],
    },
  },
  {
    name: "success",
    expected: "apollo_success",
    emitsError: false,
    input: {
      provider_result: {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message: "Mapped 2 contact(s)",
        contacts: [],
        metadata: {
          apollo_people_returned: 2,
          apollo_total_matches: 2,
          apollo_people_mapped: 2,
          apollo_people_rejected: 0,
        },
      },
      candidates_stored: 2,
      company_contacts_synced: 2,
      canonical_sync_rejected: 0,
      canonical_sync_attempted: true,
      canonical_sync_rejection_reasons: {},
      candidates: [contactableCandidate(0), contactableCandidate(1)],
    },
  },
]

function main(): void {
  console.log("Apollo live pilot provider classification matrix\n")

  for (const testCase of MATRIX) {
    const evidence = buildApolloLivePilotProviderEvidence(testCase.input)
    assert.equal(
      classifyApolloLivePilotProviderEvidence(evidence),
      testCase.expected,
      `${testCase.name}: classifyApolloLivePilotProviderEvidence`,
    )
    assert.equal(
      evidence.classification,
      testCase.expected,
      `${testCase.name}: buildApolloLivePilotProviderEvidence.classification`,
    )

    const discoveryError = buildApolloLivePilotProviderDiscoveryError(evidence)
    if (testCase.emitsError) {
      assert.ok(discoveryError, `${testCase.name}: expected discovery error`)
    } else {
      assert.equal(discoveryError, null, `${testCase.name}: expected no discovery error`)
    }

    if (testCase.expected === "apollo_results_rejected_by_mapping") {
      assert.ok(evidence.apollo_people_returned > 0, `${testCase.name}: returned > 0`)
      assert.equal(evidence.apollo_people_mapped, 0, `${testCase.name}: mapped must be 0`)
    }
    if (evidence.apollo_people_mapped > 0) {
      assert.notEqual(
        evidence.classification,
        "apollo_results_rejected_by_mapping",
        `${testCase.name}: mapped > 0 must never be rejected_by_mapping`,
      )
    }

    console.log(`  ✓ ${testCase.name} → ${testCase.expected}`)
  }

  console.log("\nAll classification matrix checks passed.")
}

main()
