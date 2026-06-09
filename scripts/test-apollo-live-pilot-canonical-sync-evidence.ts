/**
 * Apollo live pilot — canonical sync evidence + channel-less candidate policy.
 * Run: pnpm test:apollo-live-pilot-canonical-sync-evidence
 */
import assert from "node:assert/strict"
import {
  buildApolloLivePilotProviderEvidence,
  classifyApolloLivePilotProviderEvidence,
} from "../lib/growth/apollo/apollo-live-pilot-provider-evidence"
import {
  candidateHasObservedContactChannel,
  isApolloSearchOnlyMissingContactChannels,
  summarizeApolloCandidateChannelCounts,
} from "../lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { normalizeApolloSearchPersonRecord } from "../lib/growth/providers/apollo/apollo-search-person-normalize"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"
import { normalizeContactCandidate } from "../lib/growth/contact-discovery/contact-normalizer"

function buildHenryScheinChannelLessCandidate(): GrowthContactCandidate {
  const person = normalizeApolloSearchPersonRecord({
    id: "apollo-search-hs-evp",
    first_name: "Carrie",
    last_name_obfuscated: "Ki***g",
    title: "Executive Vice President, Chief Operating Officer",
    organization: { name: "Henry Schein", primary_domain: "henryschein.com" },
  })
  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: [person],
    company_name: "Henry Schein",
    domain: "henryschein.com",
    mock: false,
  })
  assert.equal(mapped.contacts.length, 1)
  const normalized = normalizeContactCandidate(
    mapped.contacts[0]!,
    "apollo",
    "future_apollo",
    "company-candidate-1",
  )
  assert.ok(normalized)
  return {
    id: "candidate-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    company_candidate_id: "company-candidate-1",
    provider_name: "apollo",
    provider_type: "future_apollo",
    full_name: normalized.full_name,
    first_name: normalized.first_name,
    last_name: normalized.last_name,
    job_title: normalized.job_title,
    department: normalized.department,
    seniority: normalized.seniority,
    linkedin_url: normalized.linkedin_url,
    email: normalized.email,
    phone: normalized.phone,
    verification_state: normalized.verification_state,
    confidence: normalized.confidence,
    source_attribution: normalized.source_attribution,
    evidence: normalized.evidence,
    dedupe_hash: normalized.dedupe_hash,
    metadata: normalized.metadata,
  }
}

function main(): void {
  console.log("Apollo live pilot canonical sync evidence tests\n")

  const channelLess = buildHenryScheinChannelLessCandidate()
  assert.equal(candidateHasObservedContactChannel(channelLess), false)
  assert.equal(channelLess.email, null)
  assert.equal(channelLess.phone, null)
  assert.equal(channelLess.linkedin_url, null)
  assert.ok(channelLess.full_name.includes("*"))
  assert.ok(channelLess.job_title)

  const counts = summarizeApolloCandidateChannelCounts([channelLess, channelLess])
  assert.equal(counts.candidate_has_name_count, 2)
  assert.equal(counts.candidate_has_title_count, 2)
  assert.equal(counts.candidate_has_email_count, 0)
  assert.equal(counts.candidate_has_phone_count, 0)
  assert.equal(counts.candidate_has_linkedin_count, 0)

  assert.equal(
    isApolloSearchOnlyMissingContactChannels({
      candidates_stored: 10,
      channel_counts: {
        candidate_has_name_count: 10,
        candidate_has_title_count: 10,
        candidate_has_email_count: 0,
        candidate_has_phone_count: 0,
        candidate_has_linkedin_count: 0,
      },
      rejection_reasons: { missing_contact_channel: 10 },
    }),
    true,
  )

  const missingChannelsEvidence = buildApolloLivePilotProviderEvidence({
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
    candidates: Array.from({ length: 10 }, () => channelLess),
  })
  assert.equal(
    classifyApolloLivePilotProviderEvidence(missingChannelsEvidence),
    "apollo_results_missing_contact_channels",
  )

  const structuralEvidence = buildApolloLivePilotProviderEvidence({
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
    canonical_sync_rejection_reasons: { canonical_company_id_unresolved: 1 },
    candidates: [
      {
        ...channelLess,
        full_name: "Jane Doe",
        email: "jane@example.com",
        job_title: "CEO",
      },
    ],
  })
  assert.equal(
    classifyApolloLivePilotProviderEvidence(structuralEvidence),
    "apollo_results_rejected_by_canonical_sync",
  )

  console.log("All Apollo live pilot canonical sync evidence checks passed.")
}

main()
