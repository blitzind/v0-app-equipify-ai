/** Contact discovery provider health types — client-safe. */

export const GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER = "growth-pdl-provider-health-v1" as const

export type GrowthPdlProviderHealthSnapshot = {
  qa_marker: typeof GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER
  generated_at: string
  provider_name: "people_data_labs"
  provider_type: "future_people_data_labs"
  env_health: {
    api_key_configured: boolean
    sandbox_mode: boolean
    env_disabled: boolean
    api_endpoint_mode: "sandbox" | "live"
  }
  uptime_state: "available" | "unavailable" | "disabled"
  runtime: {
    last_request_at: string | null
    last_status: "success" | "skipped" | "failed" | null
    last_success_at: string | null
    last_failure_at: string | null
    last_skipped_at: string | null
    last_skipped_reason: string | null
    last_failure_reason: string | null
    last_latency_ms: number | null
    last_contacts_returned: number
    last_contacts_persisted: number
    last_cache_hit: boolean | null
    last_query_summary: string | null
  }
  metrics: {
    requests_today: number
    successes_today: number
    failures_today: number
    skipped_today: number
    contacts_returned_today: number
    contacts_persisted_today: number
    rate_limited_today: number
  }
  diagnostics: string[]
}

export type GrowthPdlTestLookupPreviewContact = {
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  confidence: number | null
  verification_hint: string
}

export type GrowthPdlTestLookupResult = {
  ok: boolean
  message: string
  latency_ms: number
  sandbox: boolean
  query_summary: string
  contacts_returned: number
  preview_contacts: GrowthPdlTestLookupPreviewContact[]
  diagnostics: string[]
  raw_payload_exposed: false
}
