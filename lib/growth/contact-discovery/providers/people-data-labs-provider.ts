import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthContactDiscoveryProvider,
  GrowthContactDiscoveryProviderQuery,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { upsertProviderCompanyContacts } from "@/lib/growth/providers/pdl/pdl-contact-persistence"
import { mapPdlPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
import {
  GROWTH_PDL_PROVIDER_QA_MARKER,
  isPdlApiConfigured,
  isPdlDiscoveryDisabled,
  searchPdlPeopleByCompany,
} from "@/lib/growth/providers/pdl/pdl-client"

export { GROWTH_PDL_PROVIDER_QA_MARKER }

export function createPeopleDataLabsContactDiscoveryProvider(
  admin: SupabaseClient,
): GrowthContactDiscoveryProvider {
  return {
    provider_name: "people_data_labs",
    provider_type: "future_people_data_labs",
    isConfigured: () => isPdlApiConfigured() && !isPdlDiscoveryDisabled(),
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

      if (contacts.length > 0) {
        await upsertProviderCompanyContacts(admin, {
          company_id: input.company_candidate_id,
          growth_lead_id: input.growth_lead_id,
          provider_type: "future_people_data_labs",
          provider_name: "people_data_labs",
          contacts,
        })
      }

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
            "Provider results merged into Equipify contact graph — ranking uses Equipify contact-native scoring.",
        },
      }
    },
  }
}
