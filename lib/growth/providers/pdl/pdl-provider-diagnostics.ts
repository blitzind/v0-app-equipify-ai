/** PDL provider runtime diagnostics — server-only in-memory + structured logging. */

import "server-only"

import { GROWTH_PDL_PROVIDER_QA_MARKER } from "@/lib/growth/providers/pdl/pdl-types"
import { GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-types"

export type PdlProviderDiagnosticStatus = "success" | "skipped" | "failed"

export type PdlProviderRuntimeDiagnostics = {
  qa_marker: typeof GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER
  provider_qa_marker: typeof GROWTH_PDL_PROVIDER_QA_MARKER
  last_request_at: string | null
  last_status: PdlProviderDiagnosticStatus | null
  last_success_at: string | null
  last_failure_at: string | null
  last_skipped_at: string | null
  last_skipped_reason: string | null
  last_failure_reason: string | null
  last_latency_ms: number | null
  last_contacts_returned: number
  last_contacts_persisted: number
  last_sandbox: boolean | null
  last_query_summary: string | null
  last_cache_hit: boolean | null
  requests_today: number
  successes_today: number
  failures_today: number
  skipped_today: number
  contacts_returned_today: number
  contacts_persisted_today: number
  rate_limited_today: number
  person_enrich_successes_today: number
  company_enrich_successes_today: number
  last_api_error_category: string | null
}

type MutableDiagnostics = PdlProviderRuntimeDiagnostics & {
  day_key: string
}

let runtime: MutableDiagnostics = createEmptyDiagnostics()

function utcDayKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`
}

function createEmptyDiagnostics(): MutableDiagnostics {
  return {
    qa_marker: GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER,
    provider_qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
    last_request_at: null,
    last_status: null,
    last_success_at: null,
    last_failure_at: null,
    last_skipped_at: null,
    last_skipped_reason: null,
    last_failure_reason: null,
    last_latency_ms: null,
    last_contacts_returned: 0,
    last_contacts_persisted: 0,
    last_sandbox: null,
    last_query_summary: null,
    last_cache_hit: null,
    requests_today: 0,
    successes_today: 0,
    failures_today: 0,
    skipped_today: 0,
    contacts_returned_today: 0,
    contacts_persisted_today: 0,
    rate_limited_today: 0,
    person_enrich_successes_today: 0,
    company_enrich_successes_today: 0,
    last_api_error_category: null,
    day_key: utcDayKey(),
  }
}

function ensureDay(): void {
  const day = utcDayKey()
  if (runtime.day_key !== day) {
    runtime = createEmptyDiagnostics()
  }
}

function logPdlProviderEvent(
  event: string,
  detail: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") return
  console.info(`[growth-pdl-provider:${event}]`, detail)
}

function bumpRequest(): void {
  ensureDay()
  runtime.requests_today += 1
  runtime.last_request_at = new Date().toISOString()
  runtime.last_cache_hit = false
}

export function getPdlProviderRuntimeDiagnostics(): PdlProviderRuntimeDiagnostics {
  ensureDay()
  const { day_key: _dayKey, ...snapshot } = runtime
  return snapshot
}

export function resetPdlProviderRuntimeDiagnostics(): void {
  runtime = createEmptyDiagnostics()
}

export function recordPdlProviderCalled(input: {
  query_summary: string
  sandbox: boolean
}): void {
  bumpRequest()
  runtime.last_query_summary = input.query_summary
  runtime.last_sandbox = input.sandbox
  logPdlProviderEvent("called", {
    query_summary: input.query_summary,
    sandbox: input.sandbox,
  })
}

export function recordPdlProviderSkipped(input: {
  reason: string
  query_summary?: string | null
  sandbox?: boolean | null
  latency_ms?: number
}): void {
  bumpRequest()
  runtime.last_status = "skipped"
  runtime.last_skipped_at = new Date().toISOString()
  runtime.last_skipped_reason = input.reason
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.skipped_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.sandbox != null) runtime.last_sandbox = input.sandbox
  logPdlProviderEvent("skipped", {
    reason: input.reason,
    query_summary: input.query_summary ?? null,
  })
}

export function recordPdlProviderFailed(input: {
  reason: string
  query_summary?: string | null
  sandbox?: boolean | null
  latency_ms?: number
  rate_limited?: boolean
  api_error_category?: string | null
}): void {
  runtime.last_status = "failed"
  runtime.last_failure_at = new Date().toISOString()
  runtime.last_failure_reason = input.reason
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.last_api_error_category = input.api_error_category ?? null
  runtime.failures_today += 1
  if (input.rate_limited) runtime.rate_limited_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.sandbox != null) runtime.last_sandbox = input.sandbox
  logPdlProviderEvent("failed", {
    reason: input.reason,
    rate_limited: input.rate_limited ?? false,
  })
}

export function recordPdlProviderReturnedContacts(input: {
  contacts_returned: number
  total_available?: number
  query_summary?: string | null
  sandbox?: boolean | null
  latency_ms?: number
}): void {
  runtime.last_status = "success"
  runtime.last_success_at = new Date().toISOString()
  runtime.last_contacts_returned = input.contacts_returned
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.successes_today += 1
  runtime.contacts_returned_today += input.contacts_returned
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.sandbox != null) runtime.last_sandbox = input.sandbox
  logPdlProviderEvent("returned_contacts", {
    contacts_returned: input.contacts_returned,
    total_available: input.total_available ?? input.contacts_returned,
    latency_ms: input.latency_ms ?? null,
  })
}

export function recordPdlProviderPersistedContacts(input: {
  contacts_persisted: number
}): void {
  runtime.last_contacts_persisted = input.contacts_persisted
  runtime.contacts_persisted_today += input.contacts_persisted
  logPdlProviderEvent("persisted_contacts", {
    contacts_persisted: input.contacts_persisted,
  })
}

export function recordPdlProviderPersonEnriched(input: {
  query_summary?: string | null
  sandbox?: boolean | null
  latency_ms?: number
  likelihood?: number | null
}): void {
  runtime.last_status = "success"
  runtime.last_success_at = new Date().toISOString()
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.person_enrich_successes_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.sandbox != null) runtime.last_sandbox = input.sandbox
  logPdlProviderEvent("person_enriched", {
    likelihood: input.likelihood ?? null,
    latency_ms: input.latency_ms ?? null,
  })
}

export function recordPdlProviderCompanyEnriched(input: {
  query_summary?: string | null
  sandbox?: boolean | null
  latency_ms?: number
}): void {
  runtime.last_status = "success"
  runtime.last_success_at = new Date().toISOString()
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.company_enrich_successes_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.sandbox != null) runtime.last_sandbox = input.sandbox
  logPdlProviderEvent("company_enriched", {
    latency_ms: input.latency_ms ?? null,
  })
}

export function isPdlRateLimitError(message: string): boolean {
  return /quota|rate.?limit|429|too many requests/i.test(message)
}
