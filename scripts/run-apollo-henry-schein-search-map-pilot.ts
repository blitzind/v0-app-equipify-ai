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

const COMPANY_NAME = "Henry Schein"
const DOMAIN = "henryschein.com"

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
    candidates_stored: 0,
    company_contacts_synced: 0,
    canonical_sync_rejected: 0,
  })

  console.log(
    JSON.stringify(
      {
        ok: evidence.classification === "apollo_success" || mapped.diagnostics.contacts_mapped > 0,
        mock: search.mock,
        apollo_status: search.status,
        apollo_people_returned: evidence.apollo_people_returned,
        apollo_total_matches: evidence.apollo_total_matches,
        apollo_people_mapped: evidence.apollo_people_mapped,
        api_calls: search.mock ? 0 : 1,
        credits_consumed: 0,
        rejection_reasons: evidence.rejection_reasons,
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
  if (mapped.apollo_people_returned > 0 && mapped.diagnostics.contacts_mapped === 0) {
    process.exit(1)
  }
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
