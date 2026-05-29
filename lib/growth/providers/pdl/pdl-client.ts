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
  isPdlRateLimitError,
  recordPdlProviderCalled,
  recordPdlProviderFailed,
  recordPdlProviderReturnedContacts,
  recordPdlProviderSkipped,
} from "@/lib/growth/providers/pdl/pdl-provider-diagnostics"
import {
  GROWTH_PDL_PROVIDER_QA_MARKER,
  type PdlPersonSearchInput,
  type PdlPersonSearchResponse,
  type PdlPersonSearchResult,
} from "@/lib/growth/providers/pdl/pdl-types"

export { getPdlApiKey, isPdlApiConfigured, isPdlDiscoveryDisabled, isPdlSandboxEnabled }

export async function searchPdlPeopleByCompany(
  input: PdlPersonSearchInput,
  options?: { apiKey?: string; sandbox?: boolean },
): Promise<PdlPersonSearchResult> {
  const sandbox = options?.sandbox ?? isPdlSandboxEnabled()
  const started = performance.now()
  const finishLatency = () => Math.round(performance.now() - started)

  if (isPdlDiscoveryDisabled()) {
    const message = "PDL discovery disabled via GROWTH_DISCOVERY_DISABLE_PDL."
    recordPdlProviderSkipped({
      reason: message,
      sandbox,
      latency_ms: finishLatency(),
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      sandbox,
      query_summary: "disabled",
    }
  }

  const apiKey = options?.apiKey ?? getPdlApiKey()
  if (!apiKey) {
    const message = "PEOPLE_DATA_LABS_API_KEY not configured."
    recordPdlProviderSkipped({
      reason: message,
      sandbox,
      latency_ms: finishLatency(),
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      sandbox,
      query_summary: "missing_api_key",
    }
  }

  const domain = input.domain?.trim()
  const companyName = input.company_name.trim()
  if (!domain && !companyName) {
    const message = "Company domain or name required for PDL person search."
    recordPdlProviderSkipped({
      reason: message,
      sandbox,
      latency_ms: finishLatency(),
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      sandbox,
      query_summary: "missing_company_identity",
    }
  }

  const { query, summary } = buildPdlPersonSearchQuery(input)
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)

  recordPdlProviderCalled({ query_summary: summary, sandbox })

  try {
    const res = await fetch(resolvePdlPersonSearchBaseUrl(sandbox), {
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
    const latency_ms = finishLatency()

    if (!parsed.ok) {
      const message = parsed.error ?? "PDL person search request failed."
      recordPdlProviderFailed({
        reason: message,
        query_summary: summary,
        sandbox,
        latency_ms,
        rate_limited: isPdlRateLimitError(message),
      })
      return {
        qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
        status: "failed",
        message,
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
      recordPdlProviderFailed({
        reason: errorMessage,
        query_summary: summary,
        sandbox,
        latency_ms,
        rate_limited: isPdlRateLimitError(errorMessage),
      })
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
    recordPdlProviderReturnedContacts({
      contacts_returned: people.length,
      total_available: typeof payload.total === "number" ? payload.total : people.length,
      query_summary: summary,
      sandbox,
      latency_ms,
    })

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
    const latency_ms = finishLatency()
    recordPdlProviderFailed({
      reason: message,
      query_summary: summary,
      sandbox,
      latency_ms,
      rate_limited: isPdlRateLimitError(message),
    })
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
