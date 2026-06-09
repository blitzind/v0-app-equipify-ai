import "server-only"

import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import {
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloMockEnabled,
  isApolloProviderConfigured,
} from "@/lib/growth/providers/apollo/apollo-config"
import { GROWTH_APOLLO_PROVIDER_QA_MARKER } from "@/lib/growth/providers/apollo/apollo-types"
import { searchApolloPeopleWithTierStrategy } from "@/lib/growth/providers/apollo/apollo-tiered-people-search"

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
      const search = await searchApolloPeopleWithTierStrategy(
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
            apollo_search_strategy: search.search_strategy,
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
            apollo_search_strategy: search.search_strategy,
          },
        }
      }

      const contacts = search.mapped_contacts
      const diagnostics = {
        ...search.diagnostics,
        contacts_mapped: contacts.length,
        contacts_skipped: search.search_strategy.mapping_rejections,
        skip_reasons: search.search_strategy.rejection_reasons,
      }

      return {
        provider_name: "apollo",
        provider_type: "future_apollo",
        status: "success",
        message:
          contacts.length === 0
            ? search.message
            : `${search.message} Mapped ${contacts.length} contact(s) via tier ${search.search_strategy.tier_used}.`,
        contacts,
        metadata: {
          qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
          apollo_diagnostics: diagnostics,
          apollo_mock: search.mock,
          apollo_total: search.total,
          apollo_people_returned: search.search_strategy.raw_contacts_returned,
          apollo_total_matches: search.total,
          apollo_people_mapped: contacts.length,
          apollo_people_rejected: search.search_strategy.mapping_rejections,
          rejection_reasons: search.search_strategy.rejection_reasons,
          apollo_search_strategy: search.search_strategy,
          apollo_tier_used: search.search_strategy.tier_used,
          apollo_tier_attempts: search.search_strategy.tier_attempts,
        },
      }
    },
  }
}
