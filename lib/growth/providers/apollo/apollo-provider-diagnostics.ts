/** Apollo provider runtime diagnostics — server-only in-memory counters. */

import "server-only"

import { GROWTH_APOLLO_PROVIDER_QA_MARKER } from "@/lib/growth/providers/apollo/apollo-config"
import type { ApolloApiErrorCategory } from "@/lib/growth/providers/apollo/apollo-types"

export type ApolloProviderDiagnosticStatus = "success" | "skipped" | "failed"

export type ApolloProviderRuntimeDiagnostics = {
  qa_marker: typeof GROWTH_APOLLO_PROVIDER_QA_MARKER
  last_request_at: string | null
  last_status: ApolloProviderDiagnosticStatus | null
  last_failure_reason: string | null
  last_skipped_reason: string | null
  last_latency_ms: number | null
  last_contacts_returned: number
  last_query_summary: string | null
  last_api_error_category: ApolloApiErrorCategory | null
  last_mock: boolean | null
  requests_today: number
  successes_today: number
  failures_today: number
  skipped_today: number
  rate_limited_today: number
}

type MutableDiagnostics = ApolloProviderRuntimeDiagnostics & { day_key: string }

let runtime: MutableDiagnostics = createEmptyDiagnostics()

function utcDayKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`
}

function createEmptyDiagnostics(): MutableDiagnostics {
  return {
    qa_marker: GROWTH_APOLLO_PROVIDER_QA_MARKER,
    last_request_at: null,
    last_status: null,
    last_failure_reason: null,
    last_skipped_reason: null,
    last_latency_ms: null,
    last_contacts_returned: 0,
    last_query_summary: null,
    last_api_error_category: null,
    last_mock: null,
    requests_today: 0,
    successes_today: 0,
    failures_today: 0,
    skipped_today: 0,
    rate_limited_today: 0,
    day_key: utcDayKey(),
  }
}

function ensureDay(): void {
  if (runtime.day_key !== utcDayKey()) runtime = createEmptyDiagnostics()
}

function bumpRequest(): void {
  ensureDay()
  runtime.requests_today += 1
  runtime.last_request_at = new Date().toISOString()
}

export function getApolloProviderRuntimeDiagnostics(): ApolloProviderRuntimeDiagnostics {
  ensureDay()
  const { day_key: _dayKey, ...snapshot } = runtime
  return snapshot
}

export function resetApolloProviderRuntimeDiagnostics(): void {
  runtime = createEmptyDiagnostics()
}

export function isApolloRateLimitError(message: string, status?: number): boolean {
  return status === 429 || /rate.?limit|429|too many requests|quota/i.test(message)
}

export function classifyApolloHttpError(status: number, message: string): ApolloApiErrorCategory {
  if (status === 429 || isApolloRateLimitError(message, status)) return "rate_limit"
  if (status === 401 || status === 403) return "auth"
  if (status >= 500) return "server_error"
  if (status >= 400) return "client_error"
  return "network_error"
}

export function recordApolloProviderCalled(input: { query_summary: string; mock: boolean }): void {
  bumpRequest()
  runtime.last_query_summary = input.query_summary
  runtime.last_mock = input.mock
}

export function recordApolloProviderSkipped(input: {
  reason: string
  query_summary?: string | null
  mock?: boolean
  latency_ms?: number
  api_error_category?: ApolloApiErrorCategory
}): void {
  bumpRequest()
  runtime.last_status = "skipped"
  runtime.last_skipped_reason = input.reason
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.skipped_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.mock != null) runtime.last_mock = input.mock
  if (input.api_error_category) runtime.last_api_error_category = input.api_error_category
}

export function recordApolloProviderFailed(input: {
  reason: string
  query_summary?: string | null
  mock?: boolean
  latency_ms?: number
  api_error_category?: ApolloApiErrorCategory
  rate_limited?: boolean
}): void {
  runtime.last_status = "failed"
  runtime.last_failure_reason = input.reason
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.failures_today += 1
  if (input.rate_limited) runtime.rate_limited_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.mock != null) runtime.last_mock = input.mock
  if (input.api_error_category) runtime.last_api_error_category = input.api_error_category
}

export function recordApolloProviderReturnedContacts(input: {
  contacts_returned: number
  query_summary?: string | null
  mock?: boolean
  latency_ms?: number
}): void {
  runtime.last_status = "success"
  runtime.last_contacts_returned = input.contacts_returned
  runtime.last_latency_ms = input.latency_ms ?? null
  runtime.successes_today += 1
  if (input.query_summary) runtime.last_query_summary = input.query_summary
  if (input.mock != null) runtime.last_mock = input.mock
}
