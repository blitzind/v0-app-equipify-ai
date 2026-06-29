import "server-only"

import {
  getPdlApiKey,
  isPdlApiConfigured,
  isPdlContactDiscoveryEnabled,
  isPdlDiscoveryDisabled,
  isPdlMockEnabled,
  isPdlProviderConfigured,
  isPdlSandboxEnabled,
  resolveContactsPerCompanyLimit,
  resolvePdlCompanyEnrichBaseUrl,
  resolvePdlPersonEnrichBaseUrl,
  resolvePdlPersonSearchBaseUrl,
} from "@/lib/growth/providers/pdl/pdl-config"
import { fetchPdlJson } from "@/lib/growth/providers/pdl/pdl-http"
import { buildPdlPersonSearchQuery } from "@/lib/growth/providers/pdl/pdl-query-builder"
import {
  isPdlRateLimitError,
  recordPdlProviderCalled,
  recordPdlProviderCompanyEnriched,
  recordPdlProviderFailed,
  recordPdlProviderPersonEnriched,
  recordPdlProviderReturnedContacts,
  recordPdlProviderSkipped,
} from "@/lib/growth/providers/pdl/pdl-provider-diagnostics"
import {
  PdlRunGuardrailError,
  assertPdlCompanyEnrichAllowed,
  assertPdlCompanyProcessingAllowed,
  assertPdlLookupAllowed,
  assertPdlPersonEnrichAllowed,
  recordPdlCompanyEnrichCall,
  recordPdlCompanyProcessed,
  recordPdlLookup,
  recordPdlPersonEnrichCall,
} from "@/lib/growth/providers/pdl/pdl-run-guardrails"
import {
  GROWTH_PDL_PROVIDER_QA_MARKER,
  type PdlCompanyEnrichInput,
  type PdlCompanyEnrichResult,
  type PdlCompanyRecord,
  type PdlPersonEnrichInput,
  type PdlPersonEnrichResult,
  type PdlPersonRecord,
  type PdlPersonSearchInput,
  type PdlPersonSearchResponse,
  type PdlPersonSearchResult,
} from "@/lib/growth/providers/pdl/pdl-types"

export {
  getPdlApiKey,
  isPdlApiConfigured,
  isPdlContactDiscoveryEnabled,
  isPdlDiscoveryDisabled,
  isPdlMockEnabled,
  isPdlProviderConfigured,
  isPdlSandboxEnabled,
}

type PdlClientOptions = {
  apiKey?: string
  sandbox?: boolean
  env?: NodeJS.ProcessEnv
}

function resolveSandbox(options?: PdlClientOptions): boolean {
  return options?.sandbox ?? isPdlSandboxEnabled(options?.env)
}

function skipResult(
  message: string,
  sandbox: boolean,
  query_summary: string,
  started: number,
): { status: "skipped"; message: string; sandbox: boolean; query_summary: string; latency_ms: number } {
  const latency_ms = Math.round(performance.now() - started)
  recordPdlProviderSkipped({ reason: message, sandbox, latency_ms, query_summary })
  return { status: "skipped", message, sandbox, query_summary, latency_ms }
}

function guardPreflight(options?: PdlClientOptions): {
  ok: boolean
  message?: string
  apiKey?: string
  sandbox: boolean
} {
  const sandbox = resolveSandbox(options)
  const env = options?.env

  if (isPdlDiscoveryDisabled(env)) {
    return { ok: false, message: "PDL discovery disabled via GROWTH_DISCOVERY_DISABLE_PDL.", sandbox }
  }
  if (!isPdlContactDiscoveryEnabled(env) && !isPdlMockEnabled(env)) {
    return {
      ok: false,
      message: "PDL not enabled — set GROWTH_CONTACT_DISCOVERY_PDL_ENABLED=true.",
      sandbox,
    }
  }

  if (isPdlMockEnabled(env)) {
    return { ok: true, apiKey: "mock", sandbox: true }
  }

  const apiKey = options?.apiKey ?? getPdlApiKey(env)
  if (!apiKey) {
    return { ok: false, message: "PEOPLE_DATA_LABS_API_KEY not configured.", sandbox }
  }

  return { ok: true, apiKey, sandbox }
}

export async function searchPdlPeopleByCompany(
  input: PdlPersonSearchInput,
  options?: PdlClientOptions,
): Promise<PdlPersonSearchResult> {
  const started = performance.now()
  const preflight = guardPreflight(options)
  const domain = input.domain?.trim()
  const companyName = input.company_name.trim()

  if (!preflight.ok) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      ...skipResult(preflight.message!, preflight.sandbox, "disabled", started),
      people: [],
      total: 0,
    }
  }

  if (!domain && !companyName) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      ...skipResult(
        "Company domain or name required for PDL person search.",
        preflight.sandbox,
        "missing_company_identity",
        started,
      ),
      people: [],
      total: 0,
    }
  }

  if (preflight.apiKey === "mock") {
    recordPdlProviderCalled({ query_summary: "mock_person_search", sandbox: true })
    recordPdlLookup(options)
    recordPdlCompanyProcessed()
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "success",
      message: "PDL mock person search — no HTTP.",
      people: [],
      total: 0,
      sandbox: true,
      query_summary: "mock_person_search",
    }
  }

  try {
    assertPdlLookupAllowed(options)
    assertPdlCompanyProcessingAllowed(options)
  } catch (err) {
    const message = err instanceof PdlRunGuardrailError ? err.message : "PDL guardrail blocked search."
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message,
      people: [],
      total: 0,
      sandbox: preflight.sandbox,
      query_summary: "guardrail_blocked",
      error: message,
    }
  }

  const { query, summary } = buildPdlPersonSearchQuery(input)
  const limit = resolveContactsPerCompanyLimit(input.limit, options?.env)
  recordPdlProviderCalled({ query_summary: summary, sandbox: preflight.sandbox })

  const http = await fetchPdlJson<PdlPersonSearchResponse>({
    url: resolvePdlPersonSearchBaseUrl(preflight.sandbox),
    apiKey: preflight.apiKey!,
    method: "POST",
    body: { ...query, size: limit, pretty: false },
  })

  recordPdlLookup(options)
  recordPdlCompanyProcessed()

  if (!http.ok || !http.data) {
    recordPdlProviderFailed({
      reason: http.error ?? "PDL person search request failed.",
      query_summary: summary,
      sandbox: preflight.sandbox,
      latency_ms: http.latency_ms,
      rate_limited: http.rate_limited,
      api_error_category: http.rate_limited ? "rate_limit" : "http_error",
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message: http.error ?? "PDL person search request failed.",
      people: [],
      total: 0,
      sandbox: preflight.sandbox,
      query_summary: summary,
      error: http.error,
    }
  }

  const payload = http.data
  const status = payload.status ?? http.status
  if (status !== 200) {
    const errorMessage =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message ?? `PDL person search failed (${status}).`
    recordPdlProviderFailed({
      reason: errorMessage,
      query_summary: summary,
      sandbox: preflight.sandbox,
      latency_ms: http.latency_ms,
      rate_limited: isPdlRateLimitError(errorMessage),
      api_error_category: isPdlRateLimitError(errorMessage) ? "rate_limit" : "provider_error",
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message: errorMessage,
      people: [],
      total: 0,
      sandbox: preflight.sandbox,
      query_summary: summary,
      error: errorMessage,
    }
  }

  const people = Array.isArray(payload.data) ? payload.data : []
  recordPdlProviderReturnedContacts({
    contacts_returned: people.length,
    total_available: typeof payload.total === "number" ? payload.total : people.length,
    query_summary: summary,
    sandbox: preflight.sandbox,
    latency_ms: http.latency_ms,
  })

  return {
    qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
    status: "success",
    message:
      people.length > 0
        ? `${people.length} person record(s) from PDL ${preflight.sandbox ? "sandbox" : "live"} search.`
        : `PDL ${preflight.sandbox ? "sandbox" : "live"} search returned no people for this company.`,
    people,
    total: typeof payload.total === "number" ? payload.total : people.length,
    sandbox: preflight.sandbox,
    query_summary: summary,
  }
}

export async function enrichPdlPerson(
  input: PdlPersonEnrichInput,
  options?: PdlClientOptions,
): Promise<PdlPersonEnrichResult> {
  const started = performance.now()
  const preflight = guardPreflight(options)

  if (!preflight.ok) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      ...skipResult(preflight.message!, preflight.sandbox, "disabled", started),
      person: null,
      likelihood: null,
    }
  }

  const params = new URLSearchParams()
  if (input.email?.trim()) params.set("email", input.email.trim())
  if (input.phone?.trim()) params.set("phone", input.phone.trim())
  if (input.linkedin_url?.trim()) params.set("profile", input.linkedin_url.trim())
  if (input.name?.trim()) params.set("name", input.name.trim())
  if (input.company?.trim()) params.set("company", input.company.trim())
  if (input.domain?.trim()) params.set("website", input.domain.trim())

  const query_summary = params.toString() || "missing_identity"
  if (query_summary === "missing_identity") {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      ...skipResult("PDL person enrich requires email, phone, LinkedIn, or name.", preflight.sandbox, query_summary, started),
      person: null,
      likelihood: null,
    }
  }

  if (preflight.apiKey === "mock") {
    recordPdlPersonEnrichCall(options)
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "success",
      message: "PDL mock person enrich — no HTTP.",
      person: null,
      sandbox: true,
      query_summary: "mock_person_enrich",
      likelihood: null,
    }
  }

  try {
    assertPdlPersonEnrichAllowed(options)
  } catch (err) {
    const message = err instanceof PdlRunGuardrailError ? err.message : "PDL guardrail blocked enrich."
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message,
      person: null,
      sandbox: preflight.sandbox,
      query_summary,
      likelihood: null,
      error: message,
    }
  }

  recordPdlProviderCalled({ query_summary: `person_enrich:${query_summary}`, sandbox: preflight.sandbox })
  const url = `${resolvePdlPersonEnrichBaseUrl(preflight.sandbox)}?${params.toString()}`
  const http = await fetchPdlJson<{ status?: number; data?: PdlPersonRecord; likelihood?: number; error?: unknown }>({
    url,
    apiKey: preflight.apiKey!,
    method: "GET",
  })
  recordPdlPersonEnrichCall(options)

  if (!http.ok || !http.data?.data) {
    recordPdlProviderFailed({
      reason: http.error ?? "PDL person enrich failed.",
      query_summary,
      sandbox: preflight.sandbox,
      latency_ms: http.latency_ms,
      rate_limited: http.rate_limited,
      api_error_category: http.rate_limited ? "rate_limit" : "http_error",
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message: http.error ?? "PDL person enrich failed.",
      person: null,
      sandbox: preflight.sandbox,
      query_summary,
      likelihood: null,
      error: http.error,
    }
  }

  recordPdlProviderPersonEnriched({
    query_summary,
    sandbox: preflight.sandbox,
    latency_ms: http.latency_ms,
    likelihood: http.data.likelihood ?? null,
  })

  return {
    qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
    status: "success",
    message: "PDL person enrich succeeded.",
    person: http.data.data,
    sandbox: preflight.sandbox,
    query_summary,
    likelihood: typeof http.data.likelihood === "number" ? http.data.likelihood : null,
  }
}

export async function enrichPdlCompany(
  input: PdlCompanyEnrichInput,
  options?: PdlClientOptions,
): Promise<PdlCompanyEnrichResult> {
  const started = performance.now()
  const preflight = guardPreflight(options)

  if (!preflight.ok) {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      ...skipResult(preflight.message!, preflight.sandbox, "disabled", started),
      company: null,
    }
  }

  const params = new URLSearchParams()
  const domain = input.domain?.trim()
  const website = input.website?.trim()
  const companyName = input.company_name?.trim()
  if (domain) params.set("website", domain)
  else if (website) params.set("website", website)
  if (companyName) params.set("name", companyName)

  const query_summary = params.toString() || "missing_company_identity"
  if (query_summary === "missing_company_identity") {
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      ...skipResult(
        "PDL company enrich requires domain, website, or company name.",
        preflight.sandbox,
        query_summary,
        started,
      ),
      company: null,
    }
  }

  if (preflight.apiKey === "mock") {
    recordPdlCompanyEnrichCall(options)
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "success",
      message: "PDL mock company enrich — no HTTP.",
      company: null,
      sandbox: true,
      query_summary: "mock_company_enrich",
    }
  }

  try {
    assertPdlCompanyEnrichAllowed(options)
  } catch (err) {
    const message = err instanceof PdlRunGuardrailError ? err.message : "PDL guardrail blocked company enrich."
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message,
      company: null,
      sandbox: preflight.sandbox,
      query_summary,
      error: message,
    }
  }

  recordPdlProviderCalled({ query_summary: `company_enrich:${query_summary}`, sandbox: preflight.sandbox })
  const url = `${resolvePdlCompanyEnrichBaseUrl(preflight.sandbox)}?${params.toString()}`
  const http = await fetchPdlJson<{ status?: number; data?: PdlCompanyRecord; error?: unknown }>({
    url,
    apiKey: preflight.apiKey!,
    method: "GET",
  })
  recordPdlCompanyEnrichCall(options)

  if (!http.ok || !http.data?.data) {
    recordPdlProviderFailed({
      reason: http.error ?? "PDL company enrich failed.",
      query_summary,
      sandbox: preflight.sandbox,
      latency_ms: http.latency_ms,
      rate_limited: http.rate_limited,
      api_error_category: http.rate_limited ? "rate_limit" : "http_error",
    })
    return {
      qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      status: "failed",
      message: http.error ?? "PDL company enrich failed.",
      company: null,
      sandbox: preflight.sandbox,
      query_summary,
      error: http.error,
    }
  }

  recordPdlProviderCompanyEnriched({
    query_summary,
    sandbox: preflight.sandbox,
    latency_ms: http.latency_ms,
  })

  return {
    qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
    status: "success",
    message: "PDL company enrich succeeded.",
    company: http.data.data,
    sandbox: preflight.sandbox,
    query_summary,
  }
}
