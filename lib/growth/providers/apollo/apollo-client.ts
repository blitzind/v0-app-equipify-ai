import "server-only"

import { safeDiscoveryProviderResponse } from "@/lib/growth/prospect-search/prospect-search-safe-fetch-json"
import { buildApolloMockPeople } from "@/lib/growth/providers/apollo/apollo-mock-fixtures"
import {
  APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
  getApolloApiKey,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  resolveApolloApiBaseUrl,
} from "@/lib/growth/providers/apollo/apollo-config"
import { enrichApolloPeopleWithBulkMatch } from "@/lib/growth/providers/apollo/apollo-enrich-people"
import {
  buildApolloPeopleSearchParams,
  buildApolloPeopleSearchParamsForTier,
  type ApolloSearchTier,
} from "@/lib/growth/providers/apollo/apollo-query-builder"
import {
  assertApolloSearchApiCallAllowed,
  recordApolloSearchApiCall,
  ApolloRunGuardrailError,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import { normalizeApolloSearchPeople } from "@/lib/growth/providers/apollo/apollo-search-person-normalize"
import {
  classifyApolloHttpError,
  isApolloRateLimitError,
  recordApolloProviderCalled,
  recordApolloProviderFailed,
  recordApolloProviderReturnedContacts,
  recordApolloProviderSkipped,
} from "@/lib/growth/providers/apollo/apollo-provider-diagnostics"
import {
  GROWTH_APOLLO_PROVIDER_QA_MARKER,
  type ApolloApiErrorCategory,
  type ApolloPeopleSearchResponse,
  type ApolloPersonRecord,
  type ApolloPersonSearchInput,
  type ApolloPersonSearchResult,
  type ApolloSearchDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-types"

export {
  getApolloApiKey,
  isApolloMockEnabled,
  isApolloDiscoveryDisabled,
} from "@/lib/growth/providers/apollo/apollo-config"

const APOLLO_PEOPLE_SEARCH_ENDPOINT = `${resolveApolloApiBaseUrl()}${APOLLO_DEFAULT_PEOPLE_SEARCH_PATH}`

export type ApolloPeopleSearchBlockerClass =
  | "apollo_plan_api_access"
  | "missing_company_domain"
  | "zero_results"
  | "other"

function logApolloPeopleSearchTrace(details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event: "apollo_people_search_trace",
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

function redactApolloHttpPayload(input: {
  status: number
  error: string | null
  error_kind?: string | null
}): string {
  return JSON.stringify({
    http_status: input.status,
    error: input.error,
    error_kind: input.error_kind ?? null,
  })
}

function classifyApolloSearchBlocker(input: {
  api_call_attempted: boolean
  http_status: number | null
  api_error_category: ApolloApiErrorCategory
  result_count: number
  skipped_reason: string | null
}): ApolloPeopleSearchBlockerClass | null {
  if (!input.api_call_attempted) {
    if (input.api_error_category === "missing_company_identity") return "missing_company_domain"
    return "other"
  }
  if (
    input.http_status === 401 ||
    input.http_status === 403 ||
    input.api_error_category === "auth"
  ) {
    return "apollo_plan_api_access"
  }
  if (input.api_call_attempted && input.result_count === 0 && input.http_status === 200) {
    return "zero_results"
  }
  return null
}

function emptyDiagnostics(
  input: ApolloPersonSearchInput,
  domain: string | null,
  per_page: number,
  person_titles: string[],
  person_seniorities: string[],
  partial?: Partial<ApolloSearchDiagnostics>,
): ApolloSearchDiagnostics {
  return {
    qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
    endpoint: `${resolveApolloApiBaseUrl()}${APOLLO_DEFAULT_PEOPLE_SEARCH_PATH}`,
    search_input: {
      company_name: input.company_name.trim(),
      domain,
      person_titles,
      person_seniorities,
      per_page,
    },
    result_count: 0,
    contacts_mapped: 0,
    contacts_skipped: 0,
    skip_reasons: {},
    api_error_category: "none",
    rate_limit_remaining: null,
    credits_consumed_estimate: null,
    enrich_endpoint: null,
    enrich_batch_count: 0,
    mock: false,
    latency_ms: null,
    ...partial,
  }
}

export async function searchApolloPeopleByCompany(
  input: ApolloPersonSearchInput,
  options?: { apiKey?: string; mock?: boolean; tier?: ApolloSearchTier },
): Promise<ApolloPersonSearchResult> {
  const started = performance.now()
  const finishLatency = () => Math.round(performance.now() - started)
  const mock = options?.mock ?? isApolloMockEnabled()
  const tier = options?.tier ?? 1
  const built = buildApolloPeopleSearchParamsForTier(input, tier)
  const { params, summary, domain, per_page } = built
  const personTitles = [...built.person_titles]
  const personSeniorities = [...built.person_seniorities]

  if (isApolloDiscoveryDisabled()) {
    const message = "Apollo discovery disabled via GROWTH_DISCOVERY_DISABLE_APOLLO."
    const api_error_category = "disabled" as const
    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: false,
      http_status: null,
      apollo_response_redacted: null,
      search_skipped_reason: message,
      company_domain: domain,
      company_name: input.company_name.trim() || null,
      api_error_category,
      likely_blocker: classifyApolloSearchBlocker({
        api_call_attempted: false,
        http_status: null,
        api_error_category,
        result_count: 0,
        skipped_reason: message,
      }),
    })
    recordApolloProviderSkipped({
      reason: message,
      query_summary: summary,
      mock,
      latency_ms: finishLatency(),
      api_error_category: "disabled",
    })
    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      mock,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        api_error_category: "disabled",
        mock,
        latency_ms: finishLatency(),
      }),
    }
  }

  const companyName = input.company_name.trim()
  if (!domain && !companyName) {
    const message = "Company domain or name required for Apollo people search."
    const api_error_category = "missing_company_identity" as const
    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: false,
      http_status: null,
      apollo_response_redacted: null,
      search_skipped_reason: message,
      company_domain: domain,
      company_name: null,
      api_error_category,
      likely_blocker: classifyApolloSearchBlocker({
        api_call_attempted: false,
        http_status: null,
        api_error_category,
        result_count: 0,
        skipped_reason: message,
      }),
    })
    recordApolloProviderSkipped({
      reason: message,
      query_summary: summary,
      mock,
      latency_ms: finishLatency(),
      api_error_category: "missing_company_identity",
    })
    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      mock,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        api_error_category: "missing_company_identity",
        mock,
        latency_ms: finishLatency(),
      }),
    }
  }

  if (mock) {
    const people = buildApolloMockPeople({
      company_name: companyName,
      domain,
      limit: input.limit,
    })
    const latency_ms = finishLatency()
    recordApolloProviderCalled({ query_summary: summary, mock: true })
    recordApolloProviderReturnedContacts({
      contacts_returned: people.length,
      query_summary: summary,
      mock: true,
      latency_ms,
    })
    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "success",
      message: `Apollo mock returned ${people.length} people.`,
      people,
      total: people.length,
      mock: true,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        result_count: people.length,
        api_error_category: "mock",
        mock: true,
        latency_ms,
      }),
    }
  }

  const apiKey = options?.apiKey ?? getApolloApiKey()
  if (!apiKey) {
    const message = "APOLLO_API_KEY not configured."
    const api_error_category = "missing_credentials" as const
    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: false,
      http_status: null,
      apollo_response_redacted: null,
      search_skipped_reason: message,
      company_domain: domain,
      company_name: companyName || null,
      api_error_category,
      likely_blocker: "other",
    })
    recordApolloProviderSkipped({
      reason: message,
      query_summary: summary,
      mock: false,
      latency_ms: finishLatency(),
      api_error_category: "missing_credentials",
    })
    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      mock: false,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        api_error_category: "missing_credentials",
        latency_ms: finishLatency(),
      }),
    }
  }

  recordApolloProviderCalled({ query_summary: summary, mock: false })

  try {
    assertApolloSearchApiCallAllowed({ env: process.env })
  } catch (err) {
    const message =
      err instanceof ApolloRunGuardrailError
        ? err.message
        : "Apollo run guardrail blocked people search."
    const latency_ms = finishLatency()
    const api_error_category = "guardrail" as const
    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: false,
      http_status: null,
      apollo_response_redacted: null,
      search_skipped_reason: message,
      company_domain: domain,
      company_name: companyName || null,
      api_error_category,
      likely_blocker: "other",
    })
    recordApolloProviderSkipped({
      reason: message,
      query_summary: summary,
      mock: false,
      latency_ms,
      api_error_category: "guardrail",
    })
    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "skipped",
      message,
      people: [],
      total: 0,
      mock: false,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        api_error_category: "guardrail",
        latency_ms,
      }),
    }
  }

  try {
    const searchUrl = `${APOLLO_PEOPLE_SEARCH_ENDPOINT}?${params.toString()}`
    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: true,
      http_status: null,
      apollo_response_redacted: null,
      search_skipped_reason: null,
      company_domain: domain,
      company_name: companyName || null,
      query_summary: summary,
      org_domain_filter_applied: Boolean(domain),
    })
    const res = await fetch(searchUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": apiKey,
      },
    })

    const parsed = await safeDiscoveryProviderResponse<ApolloPeopleSearchResponse>(res)
    const latency_ms = finishLatency()

    if (!parsed.ok) {
      const category = classifyApolloHttpError(parsed.status, parsed.error)
      logApolloPeopleSearchTrace({
        endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
        endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
        api_call_attempted: true,
        http_status: parsed.status,
        apollo_response_redacted: redactApolloHttpPayload({
          status: parsed.status,
          error: parsed.error,
          error_kind: parsed.error_kind,
        }),
        search_skipped_reason: null,
        company_domain: domain,
        company_name: companyName || null,
        api_error_category: category,
        likely_blocker: classifyApolloSearchBlocker({
          api_call_attempted: true,
          http_status: parsed.status,
          api_error_category: category,
          result_count: 0,
          skipped_reason: null,
        }),
      })
      recordApolloProviderFailed({
        reason: parsed.error,
        query_summary: summary,
        mock: false,
        latency_ms,
        api_error_category: category,
        rate_limited: isApolloRateLimitError(parsed.error, parsed.status),
      })
      return {
        qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
        status: "failed",
        message: parsed.error,
        people: [],
        total: 0,
        mock: false,
        error: parsed.error,
        diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
          api_error_category: category,
          latency_ms,
          rate_limit_remaining:
            parsed.status === 429 ? 0 : null,
        }),
      }
    }

    let people = normalizeApolloSearchPeople(
      Array.isArray(parsed.data.people) ? parsed.data.people : [],
    )
    const total = parsed.data.pagination?.total_entries ?? people.length

    recordApolloSearchApiCall()

    let enrich_batches = 0
    let credits_estimate = 0
    let enrich_endpoint: string | null = null

    if (isApolloEmailEnrichmentEnabled() && people.length > 0) {
      const enriched = await enrichApolloPeopleWithBulkMatch({
        people,
        apiKey,
        domain,
        record_guardrails: true,
      })
      enrich_endpoint = enriched.enrich_endpoint
      people = enriched.people
      enrich_batches = enriched.batches
      credits_estimate = enriched.credits_estimate
    }

    recordApolloProviderReturnedContacts({
      contacts_returned: people.length,
      query_summary: summary,
      mock: false,
      latency_ms,
    })

    const rateHeader = res.headers.get("x-rate-limit-remaining") ?? res.headers.get("X-RateLimit-Remaining")
    const rate_limit_remaining = rateHeader ? Number(rateHeader) : null

    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: true,
      http_status: parsed.status,
      apollo_response_redacted: JSON.stringify({
        http_status: parsed.status,
        people_count: people.length,
        total_entries: total,
      }),
      search_skipped_reason: people.length === 0 ? "Apollo people search returned no results." : null,
      company_domain: domain,
      company_name: companyName || null,
      result_count: people.length,
      org_domain_filter_applied: Boolean(domain),
      api_error_category: "none",
      likely_blocker: classifyApolloSearchBlocker({
        api_call_attempted: true,
        http_status: parsed.status,
        api_error_category: "none",
        result_count: people.length,
        skipped_reason: null,
      }),
    })

    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "success",
      message:
        people.length === 0
          ? "Apollo people search returned no results."
          : `Apollo returned ${people.length} people (${total} total matches).`,
      people,
      total,
      mock: false,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        result_count: people.length,
        api_error_category: "none",
        latency_ms,
        rate_limit_remaining: Number.isFinite(rate_limit_remaining) ? rate_limit_remaining : null,
        credits_consumed_estimate: isApolloEmailEnrichmentEnabled() ? credits_estimate : 0,
        enrich_endpoint,
        enrich_batch_count: enrich_batches,
      }),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apollo people search failed."
    const latency_ms = finishLatency()
    logApolloPeopleSearchTrace({
      endpoint: APOLLO_PEOPLE_SEARCH_ENDPOINT,
      endpoint_name: APOLLO_DEFAULT_PEOPLE_SEARCH_PATH,
      api_call_attempted: true,
      http_status: null,
      apollo_response_redacted: redactApolloHttpPayload({
        status: 0,
        error: message,
        error_kind: "network_error",
      }),
      search_skipped_reason: null,
      company_domain: domain,
      company_name: companyName || null,
      api_error_category: "network_error",
      likely_blocker: "other",
    })
    recordApolloProviderFailed({
      reason: message,
      query_summary: summary,
      mock: false,
      latency_ms,
      api_error_category: "network_error",
    })
    return {
      qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
      status: "failed",
      message,
      people: [],
      total: 0,
      mock: false,
      error: message,
      diagnostics: emptyDiagnostics(input, domain, per_page, personTitles, personSeniorities, {
        api_error_category: "network_error",
        latency_ms,
      }),
    }
  }
}
