import "server-only"

import { safeDiscoveryProviderResponse } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import {
  getPdlApiKey,
  isPdlApiConfigured,
  isPdlDiscoveryDisabled,
  isPdlSandboxEnabled,
  resolvePdlPersonSearchBaseUrl,
} from "@/lib/growth/providers/pdl/pdl-config"
import { buildPdlPersonSearchQuery } from "@/lib/growth/providers/pdl/pdl-query-builder"
import {
  GROWTH_PDL_PROVIDER_QA_MARKER,
  type PdlPersonSearchInput,
  type PdlPersonSearchResponse,
  type PdlPersonSearchResult,
} from "@/lib/growth/providers/pdl/pdl-types"

export { getPdlApiKey, isPdlApiConfigured, isPdlDiscoveryDisabled, isPdlSandboxEnabled }

export async function searchPdlPeopleByCompany(
  input: PdlPersonSearchInput,
  options?: { apiKey?: string },
): Promise<PdlPersonSearchResult> {
  const sandbox = isPdlSandboxEnabled()

  if (isPdlDiscoveryDisabled()) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "skipped",
      message: "PDL discovery disabled via GROWTH_DISCOVERY_DISABLE_PDL.",
      people: [],
      total: 0,
      sandbox,
      query_summary: "disabled",
    }
  }

  const apiKey = options?.apiKey ?? getPdlApiKey()
  if (!apiKey) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "skipped",
      message: "PEOPLE_DATA_LABS_API_KEY not configured.",
      people: [],
      total: 0,
      sandbox,
      query_summary: "missing_api_key",
    }
  }

  const domain = input.domain?.trim()
  const companyName = input.company_name.trim()
  if (!domain && !companyName) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "skipped",
      message: "Company domain or name required for PDL person search.",
      people: [],
      total: 0,
      sandbox,
      query_summary: "missing_company_identity",
    }
  }

  const { query, summary } = buildPdlPersonSearchQuery(input)
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)

  try {
    const res = await fetch(resolvePdlPersonSearchBaseUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        ...query,
        size: limit,
        pretty: false,
      }),
    })

    const parsed = await safeDiscoveryProviderResponse<PdlPersonSearchResponse>(res)
    if (!parsed.ok) {
      return {
        qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
        status: "failed",
        message: parsed.error ?? "PDL person search request failed.",
        people: [],
        total: 0,
        sandbox,
        query_summary: summary,
        error: parsed.error ?? null,
      }
    }

    const payload = parsed.data ?? {}
    const status = payload.status ?? res.status
    if (status !== 200) {
      const errorMessage =
        typeof payload.error === "string"
          ? payload.error
          : payload.error?.message ?? `PDL person search failed (${status}).`
      return {
        qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
        status: "failed",
        message: errorMessage,
        people: [],
        total: 0,
        sandbox,
        query_summary: summary,
        error: errorMessage,
      }
    }

    const people = Array.isArray(payload.data) ? payload.data : []
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "success",
      message:
        people.length > 0
          ? `${people.length} person record(s) from PDL ${sandbox ? "sandbox" : "live"} search.`
          : `PDL ${sandbox ? "sandbox" : "live"} search returned no people for this company.`,
      people,
      total: typeof payload.total === "number" ? payload.total : people.length,
      sandbox,
      query_summary: summary,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDL person search failed."
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message,
      people: [],
      total: 0,
      sandbox,
      query_summary: summary,
      error: message,
    }
  }
}
