import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { mapPdlPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
import {
  isPdlProviderConfigured,
  searchPdlPeopleByCompany,
} from "@/lib/growth/providers/pdl/pdl-client"
import { GROWTH_PDL_PROVIDER_QA_MARKER } from "@/lib/growth/providers/pdl/pdl-types"

export { GROWTH_PDL_PROVIDER_QA_MARKER }

export function createPeopleDataLabsContactDiscoveryProvider(
  _admin: SupabaseClient,
): GrowthContactDiscoveryProvider {
  return {
    provider_name: "people_data_labs",
    provider_type: "future_people_data_labs",
    isConfigured: () => isPdlProviderConfigured(),
    discover: async (input: GrowthContactDiscoveryProviderQuery) => {
      const domain = input.domain?.trim() || null
      const companyName = input.company_name.trim()

      const search = await searchPdlPeopleByCompany({
        company_name: companyName,
        domain,
        industry: input.industry,
        limit: input.limit ?? 25,
        prefer_reachable: true,
      })

      if (search.status === "skipped") {
        return {
          provider_name: "people_data_labs",
          provider_type: "future_people_data_labs",
          status: "skipped",
          message: search.message,
          contacts: [],
          metadata: {
            qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
            sandbox: search.sandbox,
            query_summary: search.query_summary,
          },
        }
      }

      if (search.status === "failed") {
        return {
          provider_name: "people_data_labs",
          provider_type: "future_people_data_labs",
          status: "failed",
          message: search.message,
          contacts: [],
          error: search.error ?? search.message,
          metadata: {
            qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
            sandbox: search.sandbox,
            query_summary: search.query_summary,
          },
        }
      }

      const contacts = mapPdlPeopleToContactDiscoveryRaw({
        people: search.people,
        company_name: companyName,
        domain,
        sandbox: search.sandbox,
      })

      return {
        provider_name: "people_data_labs",
        provider_type: "future_people_data_labs",
        status: "success",
        message: search.message,
        contacts,
        metadata: {
          qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
          sandbox: search.sandbox,
          query_summary: search.query_summary,
          pdl_total: search.total,
          equipify_merge_note:
            "Provider results returned to orchestrator — normalized to contact_candidates then synced to company_contacts.",
        },
      }
    },
  }
}
