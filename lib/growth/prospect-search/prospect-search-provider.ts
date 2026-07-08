import { randomUUID } from "node:crypto"
import { GROWTH_PROSPECT_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER =
  "growth-prospect-search-provider-v1" as const

export const GROWTH_PROSPECT_SEARCH_PROVIDER_SLOTS = [
  "internal_observable_index",
  "future_apollo",
  "future_seamless",
] as const

export type GrowthProspectSearchProviderSlot =
  (typeof GROWTH_PROSPECT_SEARCH_PROVIDER_SLOTS)[number]

export type GrowthProspectSearchProviderQuery = {
  query: string
  filters: Record<string, unknown>
}

export type GrowthProspectSearchProviderResponse = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER
  provider_slot: GrowthProspectSearchProviderSlot
  status: "skipped" | "success" | "failed"
  message: string
  request_id: string
  evidence: string[]
}

/** Internal index only — observable Growth Engine + CRM records. */
export function createInternalProspectSearchProvider(): {
  slot: GrowthProspectSearchProviderSlot
  describe: () => GrowthProspectSearchProviderResponse
} {
  return {
    slot: "internal_observable_index",
    describe: () => ({
      qa_marker: GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER,
      provider_slot: "internal_observable_index",
      status: "success",
      message: `Uses ${GROWTH_PROSPECT_SEARCH_QA_MARKER} index from Revenue Queue, growth leads, CRM prospects/customers, and intent overlays — no outbound enrichment.`,
      request_id: randomUUID(),
      evidence: [
        "growth.leads",
        "growth.lead_inbox",
        "public.prospects",
        "public.customers",
        "growth.search_intent_signals",
        "growth.company_identification_matches",
        "growth.buying_stage_assessments",
      ],
    }),
  }
}

/** Reserved Apollo-style provider slot — not integrated. */
export function createFutureApolloProspectSearchProvider(): {
  slot: GrowthProspectSearchProviderSlot
  query: (q: GrowthProspectSearchProviderQuery) => GrowthProspectSearchProviderResponse
} {
  return {
    slot: "future_apollo",
    query: () => ({
      qa_marker: GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER,
      provider_slot: "future_apollo",
      status: "skipped",
      message: "Apollo provider slot reserved — no external API connected.",
      request_id: randomUUID(),
      evidence: [],
    }),
  }
}

/** Reserved Seamless-style provider slot — not integrated. */
export function createFutureSeamlessProspectSearchProvider(): {
  slot: GrowthProspectSearchProviderSlot
  query: (q: GrowthProspectSearchProviderQuery) => GrowthProspectSearchProviderResponse
} {
  return {
    slot: "future_seamless",
    query: () => ({
      qa_marker: GROWTH_PROSPECT_SEARCH_PROVIDER_QA_MARKER,
      provider_slot: "future_seamless",
      status: "skipped",
      message: "Seamless provider slot reserved — no external API connected.",
      request_id: randomUUID(),
      evidence: [],
    }),
  }
}
