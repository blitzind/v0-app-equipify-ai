import "server-only"

import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { searchApolloPeopleByCompany } from "@/lib/growth/providers/apollo/apollo-client"
import {
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloMockEnabled,
  isApolloProviderConfigured,
} from "@/lib/growth/providers/apollo/apollo-config"
import { mapApolloPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/apollo/map-apollo-contact"
import { GROWTH_APOLLO_PROVIDER_QA_MARKER } from "@/lib/growth/providers/apollo/apollo-types"

export { GROWTH_APOLLO_PROVIDER_QA_MARKER }

export function createApolloContactDiscoveryProvider(): GrowthContactDiscoveryProvider {
  return {
    provider_name: "apollo",
    provider_type: "future_apollo",
    isConfigured: () => isApolloProviderConfigured(),
    discover: async (input: GrowthContactDiscoveryProviderQuery) => {
      if (isApolloDiscoveryDisabled()) {
        return {
          provider_name: "apollo",
          provider_type: "future_apollo",
          status: "skipped",
          message: "Apollo discovery disabled via GROWTH_DISCOVERY_DISABLE_APOLLO.",
          contacts: [],
          metadata: { qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER },
        }
      }

      if (!isApolloContactDiscoveryEnabled()) {
        return {
          provider_name: "apollo",
          provider_type: "future_apollo",
          status: "skipped",
          message: "Apollo contact discovery not enabled (set GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true).",
          contacts: [],
          metadata: { qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER },
        }
      }

      const domain = input.domain?.trim() || null
      const search = await searchApolloPeopleByCompany(
        {
          company_name: input.company_name,
          domain,
          website_url: input.website_url,
          industry: input.industry,
          limit: input.limit ?? 20,
        },
        { mock: isApolloMockEnabled() },
      )

      if (search.status === "skipped") {
        return {
          provider_name: "apollo",
          provider_type: "future_apollo",
          status: "skipped",
          message: search.message,
          contacts: [],
          metadata: {
            qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
            apollo_diagnostics: search.diagnostics,
          },
        }
      }

      if (search.status === "failed") {
        return {
          provider_name: "apollo",
          provider_type: "future_apollo",
          status: "failed",
          message: search.message,
          contacts: [],
          error: search.error ?? search.message,
          metadata: {
            qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
            apollo_diagnostics: search.diagnostics,
          },
        }
      }

      const mapped = mapApolloPeopleToContactDiscoveryRaw({
        people: search.people,
        company_name: input.company_name,
        domain,
        mock: search.mock,
      })

      const diagnostics = {
        ...search.diagnostics,
        contacts_mapped: mapped.diagnostics.contacts_mapped,
        contacts_skipped: mapped.diagnostics.contacts_skipped,
        skip_reasons: mapped.diagnostics.skip_reasons,
      }

      return {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message:
          mapped.contacts.length === 0
            ? search.message
            : `${search.message} Mapped ${mapped.contacts.length} contact(s); skipped ${mapped.diagnostics.contacts_skipped}.`,
        contacts: mapped.contacts,
        metadata: {
          qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
          apollo_diagnostics: diagnostics,
          apollo_mock: search.mock,
          apollo_total: search.total,
        },
      }
    },
  }
}
