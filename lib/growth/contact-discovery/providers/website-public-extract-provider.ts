import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertExtractedCompanyContacts } from "@/lib/growth/contact-discovery/company-contact-repository"
import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { discoverWebsiteContacts } from "@/lib/growth/contact-discovery/website-contact-discovery"
import {
  GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER,
  mapExtractedWebsiteContactsToProviderRaw,
} from "@/lib/growth/contact-discovery/website-extract-mapper"

export function createWebsitePublicExtractContactDiscoveryProvider(
  admin: SupabaseClient,
): GrowthContactDiscoveryProvider {
  return {
    provider_name: "website_public_extract",
    provider_type: "website_public_extract",
    isConfigured: () => true,
    discover: async (input: GrowthContactDiscoveryProviderQuery) => {
      const website = input.website_url?.trim() || (input.domain?.trim() ? `https://${input.domain}` : null)
      if (!website) {
        return {
          provider_name: "website_public_extract",
          provider_type: "website_public_extract",
          status: "skipped",
          message: "No website URL available for public extraction.",
          contacts: [],
        }
      }

      try {
        const discovery = await discoverWebsiteContacts(website)
        if (discovery.contacts.length > 0) {
          await upsertExtractedCompanyContacts(admin, {
            company_id: input.company_candidate_id,
            growth_lead_id: input.growth_lead_id,
            extracted: discovery.contacts,
          })
        }

        const contacts = mapExtractedWebsiteContactsToProviderRaw(discovery.contacts)
        const pagesSummary =
          discovery.pages_crawled.length > 0
            ? ` Crawled ${discovery.pages_crawled.length} page(s).`
            : ""

        return {
          provider_name: "website_public_extract",
          provider_type: "website_public_extract",
          status: "success",
          message:
            contacts.length > 0
              ? `${contacts.length} contact(s) from public website extraction.${pagesSummary}${discovery.diagnostics.summary ? ` ${discovery.diagnostics.summary}` : ""}`
              : `${discovery.diagnostics.summary ?? "No evidence-backed contacts on public website."}${pagesSummary}`,
          contacts,
          metadata: {
            extraction_diagnostics: discovery.diagnostics,
            linkedin_company_urls: discovery.linkedin_company_urls,
          },
        }
      } catch (err) {
        return {
          provider_name: "website_public_extract",
          provider_type: "website_public_extract",
          status: "failed",
          message: err instanceof Error ? err.message : "Website public extraction failed.",
          contacts: [],
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  }
}

export { GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER }
