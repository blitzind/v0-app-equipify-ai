/**
 * Henry Schein Apollo search → normalize → map pilot (no outreach/enrollment).
 * Run: pnpm run:apollo-henry-schein-search-map-pilot
 *
 * Live (requires APOLLO_API_KEY):
 *   GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true GROWTH_APOLLO_USE_MOCK=false pnpm run:apollo-henry-schein-search-map-pilot
 */
import { searchApolloPeopleByCompany } from "../lib/growth/providers/apollo/apollo-client"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { buildApolloLivePilotProviderEvidence } from "../lib/growth/apollo/apollo-live-pilot-provider-evidence"
import { mapApolloPeopleToContactDiscoveryRaw } from "../lib/growth/providers/apollo/map-apollo-contact"
import { normalizeApolloSearchPeople } from "../lib/growth/providers/apollo/apollo-search-person-normalize"
import { buildApolloApiSearchRawFixtures } from "../lib/growth/providers/apollo/apollo-api-search-fixtures"
import { normalizeContactCandidate } from "../lib/growth/contact-discovery/contact-normalizer"
import type { GrowthContactCandidate } from "../lib/growth/contact-discovery/contact-discovery-types"
import { candidateHasObservedContactChannel } from "../lib/growth/apollo/apollo-live-pilot-canonical-sync-evidence"

const COMPANY_NAME = "Henry Schein"
const DOMAIN = "henryschein.com"

function buildMockCandidatesFromSearch(
  contacts: Awaited<ReturnType<typeof searchApolloPeopleByCompany>>["people"],
): GrowthContactCandidate[] {
  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: contacts,
    company_name: COMPANY_NAME,
    domain: DOMAIN,
    mock: true,
  })
  return mapped.contacts
    .map((raw, index) => {
      const normalized = normalizeContactCandidate(raw, "apollo", "future_apollo", "henry-schein-mock")
      if (!normalized) return null
      return {
        id: `mock-candidate-${index}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        company_candidate_id: "henry-schein-mock",
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
      } satisfies GrowthContactCandidate
    })
    .filter((row): row is GrowthContactCandidate => Boolean(row))
}

async function main(): Promise<void> {
  const mock = process.env.GROWTH_APOLLO_USE_MOCK !== "false"
  const search = await searchApolloPeopleByCompany(
    {
      company_name: COMPANY_NAME,
      domain: DOMAIN,
      website_url: `https://www.${DOMAIN}`,
      limit: 10,
    },
    { mock },
  )

  const mapped = mapApolloPeopleToContactDiscoveryRaw({
    people: search.people,
    company_name: COMPANY_NAME,
    domain: DOMAIN,
    mock: search.mock,
  })

  const mockCandidates =
    search.mock && mapped.contacts.length === 0
      ? buildMockCandidatesFromSearch(normalizeApolloSearchPeople(buildApolloApiSearchRawFixtures()))
      : mapped.contacts
          .map((raw, index) => {
            const normalized = normalizeContactCandidate(
              raw,
              "apollo",
              "future_apollo",
              "henry-schein-pilot",
            )
            if (!normalized) return null
            return {
              id: `candidate-${index}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              company_candidate_id: "henry-schein-pilot",
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
            } satisfies GrowthContactCandidate
          })
          .filter((row): row is GrowthContactCandidate => Boolean(row))

  const channelLessCount = mockCandidates.filter((c) => !candidateHasObservedContactChannel(c)).length
  const canonical_sync_rejection_reasons =
    channelLessCount > 0 ? { missing_contact_channel: channelLessCount } : {}

  const evidence = buildApolloLivePilotProviderEvidence({
    provider_result: {
      provider_name: "apollo",
      provider_type: "future_apollo",
      status: search.status === "success" ? "success" : "skipped",
      message: search.message,
      contacts: mapped.contacts,
      metadata: {
        apollo_people_returned: mapped.apollo_people_returned,
        apollo_total_matches: search.total,
        apollo_people_mapped: mapped.diagnostics.contacts_mapped,
        apollo_people_rejected: mapped.diagnostics.contacts_skipped,
        rejection_reasons: mapped.diagnostics.skip_reasons,
        title_bucket_rejections: mapped.title_bucket_rejections,
        missing_email_count: mapped.missing_email_count,
        missing_phone_count: mapped.missing_phone_count,
        apollo_rejected_sample: mapped.rejected_sample,
      },
    },
    candidates_stored: mockCandidates.length,
    company_contacts_synced: 0,
    canonical_sync_rejected: channelLessCount,
    canonical_sync_attempted: mockCandidates.length > 0,
    canonical_sync_rejection_reasons,
    candidates: mockCandidates,
  })

  console.log(
    JSON.stringify(
      {
        ok: evidence.classification === "apollo_success" || evidence.classification === "apollo_results_missing_contact_channels" || mapped.diagnostics.contacts_mapped > 0,
        mock: search.mock,
        apollo_status: search.status,
        apollo_people_returned: evidence.apollo_people_returned,
        apollo_total_matches: evidence.apollo_total_matches,
        apollo_people_mapped: evidence.apollo_people_mapped,
        api_calls: search.mock ? 0 : 1,
        credits_consumed: 0,
        rejection_reasons: evidence.rejection_reasons,
        canonical_sync_attempted: evidence.canonical_sync_attempted,
        canonical_sync_rejection_reasons: evidence.canonical_sync_rejection_reasons,
        candidate_has_name_count: evidence.candidate_has_name_count,
        candidate_has_title_count: evidence.candidate_has_title_count,
        candidate_has_email_count: evidence.candidate_has_email_count,
        candidate_has_phone_count: evidence.candidate_has_phone_count,
        candidate_has_linkedin_count: evidence.candidate_has_linkedin_count,
        title_bucket_rejections: evidence.title_bucket_rejections,
        rejected_sample: evidence.rejected_sample,
        classification: evidence.classification,
      },
      null,
      2,
    ),
  )

  if (search.status !== "success") {
    process.exit(1)
  }
  if (
    mapped.apollo_people_returned > 0 &&
    mapped.diagnostics.contacts_mapped === 0 &&
    evidence.classification !== "apollo_results_missing_contact_channels"
  ) {
    process.exit(1)
  }
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
