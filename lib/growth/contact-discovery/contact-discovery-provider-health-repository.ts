import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthContactDiscoverySchema } from "@/lib/growth/contact-discovery/contact-schema-health"
import type {
  GrowthPdlProviderHealthSnapshot,
  GrowthPdlTestLookupResult,
} from "@/lib/growth/contact-discovery/contact-discovery-provider-health-types"
import { GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-types"
import {
  isPdlApiConfigured,
  isPdlDiscoveryDisabled,
  isPdlSandboxEnabled,
  resolvePdlPersonSearchBaseUrl,
} from "@/lib/growth/providers/pdl/pdl-config"
import { mapPdlPeopleToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
import {
  getPdlProviderRuntimeDiagnostics,
  isPdlRateLimitError,
  recordPdlProviderSkipped,
  resetPdlProviderRuntimeDiagnostics,
} from "@/lib/growth/providers/pdl/pdl-provider-diagnostics"
import { searchPdlPeopleByCompany } from "@/lib/growth/providers/pdl/pdl-client"

export type { GrowthPdlProviderHealthSnapshot, GrowthPdlTestLookupResult } from "@/lib/growth/contact-discovery/contact-discovery-provider-health-types"

function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function resolvePdlUptimeState(input: {
  configured: boolean
  env_disabled: boolean
}): GrowthPdlProviderHealthSnapshot["uptime_state"] {
  if (input.env_disabled) return "disabled"
  if (input.configured) return "available"
  return "unavailable"
}

export async function loadGrowthPdlProviderHealth(
  admin: SupabaseClient,
): Promise<GrowthPdlProviderHealthSnapshot> {
  const diagnostics: string[] = []
  const schema = await probeGrowthContactDiscoverySchema(admin)
  if (!schema.ready) diagnostics.push(schema.message)

  const api_key_configured = isPdlApiConfigured()
  const env_disabled = isPdlDiscoveryDisabled()
  const sandbox_mode = isPdlSandboxEnabled()
  const runtime = getPdlProviderRuntimeDiagnostics()

  if (!api_key_configured) {
    diagnostics.push("PEOPLE_DATA_LABS_API_KEY (or PDL_API_KEY) is not configured.")
  }
  if (env_disabled) {
    diagnostics.push("PDL acquisition is disabled via GROWTH_DISCOVERY_DISABLE_PDL=1.")
  }
  if (sandbox_mode) {
    diagnostics.push("PDL sandbox mode is active — test lookups use synthetic data without consuming credits.")
  } else {
    diagnostics.push("PDL live mode is active — requests may consume account credits.")
  }
  if (runtime.rate_limited_today > 0) {
    diagnostics.push(`${runtime.rate_limited_today} PDL request(s) hit rate limits today.`)
  }
  if (runtime.last_cache_hit != null) {
    diagnostics.push("PDL does not use provider_query_cache — cache hit is always false.")
  }

  const since = startOfUtcDayIso()
  if (schema.ready) {
    const { data: runs } = await admin
      .schema("growth")
      .from("contact_discovery_runs")
      .select("id, created_at, provider_names, candidate_count, status")
      .gte("created_at", since)
      .contains("provider_names", ["people_data_labs"])
      .order("created_at", { ascending: false })
      .limit(5)

    if ((runs ?? []).length === 0 && runtime.requests_today === 0) {
      diagnostics.push("No PDL contact discovery activity recorded today.")
    }
  }

  return {
    qa_marker: GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER,
    generated_at: new Date().toISOString(),
    provider_name: "people_data_labs",
    provider_type: "future_people_data_labs",
    env_health: {
      api_key_configured,
      sandbox_mode,
      env_disabled,
      api_endpoint_mode: sandbox_mode ? "sandbox" : "live",
    },
    uptime_state: resolvePdlUptimeState({
      configured: api_key_configured,
      env_disabled,
    }),
    runtime: {
      last_request_at: runtime.last_request_at,
      last_status: runtime.last_status,
      last_success_at: runtime.last_success_at,
      last_failure_at: runtime.last_failure_at,
      last_skipped_at: runtime.last_skipped_at,
      last_skipped_reason: runtime.last_skipped_reason,
      last_failure_reason: runtime.last_failure_reason,
      last_latency_ms: runtime.last_latency_ms,
      last_contacts_returned: runtime.last_contacts_returned,
      last_contacts_persisted: runtime.last_contacts_persisted,
      last_cache_hit: runtime.last_cache_hit,
      last_query_summary: runtime.last_query_summary,
    },
    metrics: {
      requests_today: runtime.requests_today,
      successes_today: runtime.successes_today,
      failures_today: runtime.failures_today,
      skipped_today: runtime.skipped_today,
      contacts_returned_today: runtime.contacts_returned_today,
      contacts_persisted_today: runtime.contacts_persisted_today,
      rate_limited_today: runtime.rate_limited_today,
    },
    diagnostics,
  }
}

export async function runGrowthPdlTestLookup(input: {
  company_name: string
  domain?: string | null
  limit?: number
  sandbox?: boolean
}): Promise<GrowthPdlTestLookupResult> {
  const started = performance.now()
  const company_name = input.company_name.trim()
  const domain = input.domain?.trim() || null
  const sandbox = input.sandbox !== false
  const diagnostics: string[] = []

  if (!company_name && !domain) {
    return {
      ok: false,
      message: "Company name or domain is required.",
      latency_ms: 0,
      sandbox,
      query_summary: "missing_input",
      contacts_returned: 0,
      preview_contacts: [],
      diagnostics: ["Provide a company name or domain for the test lookup."],
      raw_payload_exposed: false,
    }
  }

  if (isPdlDiscoveryDisabled()) {
    const message = "PDL discovery is disabled via GROWTH_DISCOVERY_DISABLE_PDL."
    recordPdlProviderSkipped({ reason: message, sandbox })
    return {
      ok: false,
      message,
      latency_ms: Math.round(performance.now() - started),
      sandbox,
      query_summary: "disabled",
      contacts_returned: 0,
      preview_contacts: [],
      diagnostics: [message],
      raw_payload_exposed: false,
    }
  }

  if (!isPdlApiConfigured()) {
    const message = "PEOPLE_DATA_LABS_API_KEY is not configured."
    recordPdlProviderSkipped({ reason: message, sandbox })
    return {
      ok: false,
      message,
      latency_ms: Math.round(performance.now() - started),
      sandbox,
      query_summary: "missing_api_key",
      contacts_returned: 0,
      preview_contacts: [],
      diagnostics: [message],
      raw_payload_exposed: false,
    }
  }

  diagnostics.push(
    sandbox
      ? "Test lookup runs against PDL sandbox — no outreach enqueue, no persistence."
      : "Test lookup runs against PDL live API — still no outreach enqueue or persistence.",
  )
  diagnostics.push(`Endpoint: ${sandbox ? "sandbox.api.peopledatalabs.com" : "api.peopledatalabs.com"}`)

  const search = await searchPdlPeopleByCompany(
    {
      company_name: company_name || domain || "Unknown company",
      domain,
      limit: input.limit ?? 5,
      prefer_reachable: true,
    },
    { sandbox },
  )

  const latency_ms = Math.round(performance.now() - started)

  if (search.status === "skipped") {
    diagnostics.push(search.message)
    return {
      ok: false,
      message: search.message,
      latency_ms,
      sandbox: search.sandbox,
      query_summary: search.query_summary,
      contacts_returned: 0,
      preview_contacts: [],
      diagnostics,
      raw_payload_exposed: false,
    }
  }

  if (search.status === "failed") {
    diagnostics.push(search.message)
    if (isPdlRateLimitError(search.message)) {
      diagnostics.push("Provider appears rate-limited — retry later.")
    }
    return {
      ok: false,
      message: search.message,
      latency_ms,
      sandbox: search.sandbox,
      query_summary: search.query_summary,
      contacts_returned: 0,
      preview_contacts: [],
      diagnostics,
      raw_payload_exposed: false,
    }
  }

  const mapped = mapPdlPeopleToContactDiscoveryRaw({
    people: search.people,
    company_name: company_name || domain || "Unknown company",
    domain,
    sandbox: search.sandbox,
  })

  const preview_contacts = mapped.map((row) => ({
    full_name: row.full_name,
    title: row.job_title ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    linkedin_url: row.linkedin_url ?? null,
    confidence: row.confidence ?? null,
    verification_hint: row.email
      ? "Email present — Equipify verification runs after merge."
      : row.phone
        ? "Phone present — Equipify verification runs after merge."
        : "Name/title only — verify before outreach.",
  }))

  if (preview_contacts.length === 0) {
    diagnostics.push("PDL returned successfully but no normalized contacts matched this company.")
    diagnostics.push(
      sandbox
        ? "Sandbox dataset may not include this domain — try a known sandbox company like google.com."
        : "Try broadening the company domain or verifying the company exists in PDL.",
    )
  } else {
    diagnostics.push(
      `${preview_contacts.length} normalized preview contact(s) returned. Results are not persisted or queued.`,
    )
  }

  return {
    ok: preview_contacts.length > 0,
    message:
      preview_contacts.length > 0
        ? search.message
        : "PDL lookup succeeded but returned no normalized contacts for preview.",
    latency_ms,
    sandbox: search.sandbox,
    query_summary: search.query_summary,
    contacts_returned: preview_contacts.length,
    preview_contacts,
    diagnostics,
    raw_payload_exposed: false,
  }
}

export function rerunGrowthPdlProviderHealthDiagnostics(): void {
  resetPdlProviderRuntimeDiagnostics()
}

export function resolvePdlHealthEndpointLabel(): string {
  return resolvePdlPersonSearchBaseUrl().includes("sandbox") ? "sandbox" : "live"
}
