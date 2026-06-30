import "server-only"

import {
  DATAMOON_ENRICH_BY_EMAIL_PATH,
  DATAMOON_ENRICH_BY_PHONE_PATH,
  DATAMOON_ENRICHMENT_BASE_URL,
  getDatamoonAudienceApiKey,
  getDatamoonEnrichmentApiKey,
  isDatamoonAudienceConfigured,
  isDatamoonDryRunOnly,
  isDatamoonEnrichmentConfigured,
  isDatamoonProviderEnabled,
  resolveDatamoonAudienceBaseUrl,
  resolveDatamoonAudienceMode,
  type DatamoonAudienceMode,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import { fetchDatamoonJson, type DatamoonFetchImpl } from "@/lib/growth/providers/datamoon/datamoon-http"
import {
  GROWTH_DATAMOON_PROVIDER_QA_MARKER,
  type DatamoonAudienceBuildResponse,
  type DatamoonAudienceFetchResponse,
  type DatamoonBuildAudienceInput,
  type DatamoonClientResult,
  type DatamoonEnrichByEmailInput,
  type DatamoonEnrichByPhoneInput,
  type DatamoonExportAudienceInput,
} from "@/lib/growth/providers/datamoon/datamoon-types"

export { diagnoseDatamoonProvider } from "@/lib/growth/providers/datamoon/datamoon-provider-diagnostics"
export {
  GROWTH_DATAMOON_PROVIDER_QA_MARKER,
} from "@/lib/growth/providers/datamoon/datamoon-types"

export {
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
  isDatamoonDryRunOnly,
  resolveDatamoonAudienceMode,
  resolveDatamoonAvailableCapabilities,
} from "@/lib/growth/providers/datamoon/datamoon-config"

type DatamoonClientOptions = {
  env?: NodeJS.ProcessEnv
  audienceMode?: DatamoonAudienceMode
  fetchImpl?: DatamoonFetchImpl
}

type PreflightResult =
  | { ok: true; dryRun: boolean; audienceMode: DatamoonAudienceMode }
  | { ok: false; dryRun: boolean; audienceMode: DatamoonAudienceMode; message: string; error_category: "disabled" | "missing_key" | "dry_run" }

function resolveEnv(options?: DatamoonClientOptions): NodeJS.ProcessEnv {
  return options?.env ?? process.env
}

function resolveMode(options?: DatamoonClientOptions): DatamoonAudienceMode {
  return options?.audienceMode ?? resolveDatamoonAudienceMode(resolveEnv(options))
}

function baseResult<T>(
  partial: Omit<DatamoonClientResult<T>, "qa_marker">,
): DatamoonClientResult<T> {
  return { qa_marker: GROWTH_DATAMOON_PROVIDER_QA_MARKER, ...partial }
}

function skipResult<T>(
  message: string,
  audienceMode: DatamoonAudienceMode,
  error_category: DatamoonClientResult<T>["error_category"],
  started: number,
  env: NodeJS.ProcessEnv = process.env,
): DatamoonClientResult<T> {
  return baseResult({
    status: "skipped",
    message,
    data: null,
    dry_run: isDatamoonDryRunOnly(env),
    audience_mode: audienceMode,
    error_category,
    validation_errors: null,
    allowed_fields: null,
    latency_ms: Math.round(performance.now() - started),
    http_status: null,
  })
}

function dryRunResult<T>(
  message: string,
  audienceMode: DatamoonAudienceMode,
  data: T | null,
  started: number,
): DatamoonClientResult<T> {
  return baseResult({
    status: "dry_run",
    message,
    data,
    dry_run: true,
    audience_mode: audienceMode,
    error_category: "dry_run",
    validation_errors: null,
    allowed_fields: null,
    latency_ms: Math.round(performance.now() - started),
    http_status: null,
  })
}

function guardPreflight(
  options: DatamoonClientOptions | undefined,
  capability: "audience" | "enrichment",
): PreflightResult {
  const env = resolveEnv(options)
  const audienceMode = resolveMode(options)

  if (!isDatamoonProviderEnabled(env)) {
    return {
      ok: false,
      dryRun: isDatamoonDryRunOnly(env),
      audienceMode,
      message: "Datamoon provider disabled — set DATAMOON_PROVIDER_ENABLED=true.",
      error_category: "disabled",
    }
  }

  if (isDatamoonDryRunOnly(env)) {
    return { ok: true, dryRun: true, audienceMode }
  }

  if (capability === "audience" && !isDatamoonAudienceConfigured(env, audienceMode)) {
    const keyName =
      audienceMode === "module" ? "DATAMOON_AUDIENCE_MODULE_API_KEY" : "DATAMOON_AUDIENCE_EXT_API_KEY"
    return {
      ok: false,
      dryRun: false,
      audienceMode,
      message: `${keyName} not configured.`,
      error_category: "missing_key",
    }
  }

  if (capability === "enrichment" && !isDatamoonEnrichmentConfigured(env)) {
    return {
      ok: false,
      dryRun: false,
      audienceMode,
      message: "DATAMOON_ENRICHMENT_API_KEY not configured.",
      error_category: "missing_key",
    }
  }

  return { ok: true, dryRun: false, audienceMode }
}

function failedFromHttp<T>(
  http: Awaited<ReturnType<typeof fetchDatamoonJson<T>>>,
  audienceMode: DatamoonAudienceMode,
  message: string,
  started: number,
): DatamoonClientResult<T> {
  return baseResult({
    status: "failed",
    message: http.error ?? message,
    data: null,
    dry_run: false,
    audience_mode: audienceMode,
    error_category: http.error_category,
    validation_errors: http.validation_errors,
    allowed_fields: http.allowed_fields,
    latency_ms: Math.max(http.latency_ms, Math.round(performance.now() - started)),
    http_status: http.status || null,
  })
}

export async function buildAudience(
  input: DatamoonBuildAudienceInput,
  options?: DatamoonClientOptions,
): Promise<DatamoonClientResult<DatamoonAudienceBuildResponse>> {
  const started = performance.now()
  const preflight = guardPreflight(options, "audience")

  if (!preflight.ok) {
    return skipResult(
      preflight.message,
      preflight.audienceMode,
      preflight.error_category,
      started,
      resolveEnv(options),
    )
  }

  if (preflight.dryRun) {
    return dryRunResult(
      "Datamoon audience build dry-run — no HTTP.",
      preflight.audienceMode,
      {
        id: "dry-run-audience-id",
        status: "in_progress",
        record_count: 0,
        dry_run: true,
        filters_submitted: input.filters.length,
      },
      started,
    )
  }

  const env = resolveEnv(options)
  const apiKey = getDatamoonAudienceApiKey(env, preflight.audienceMode)!
  const baseUrl = resolveDatamoonAudienceBaseUrl(preflight.audienceMode)
  const http = await fetchDatamoonJson<DatamoonAudienceBuildResponse>({
    url: `${baseUrl}/audiences/build`,
    method: "POST",
    authMode: "header",
    apiKey,
    body: {
      type: input.type,
      filters: input.filters,
      ...(input.name ? { name: input.name } : {}),
      ...(input.website_id ? { website_id: input.website_id } : {}),
      ...(input.topic_ids ? { topic_ids: input.topic_ids } : {}),
      ...(input.limit != null ? { limit: input.limit } : {}),
      ...(input.record_limit != null ? { record_limit: input.record_limit } : {}),
    },
    fetchImpl: options?.fetchImpl,
  })

  if (!http.ok || !http.data) {
    return failedFromHttp(http, preflight.audienceMode, "Datamoon audience build failed.", started)
  }

  return baseResult({
    status: "success",
    message: "Datamoon audience build accepted.",
    data: http.data,
    dry_run: false,
    audience_mode: preflight.audienceMode,
    error_category: null,
    validation_errors: null,
    allowed_fields: null,
    latency_ms: http.latency_ms,
    http_status: http.status,
  })
}

export async function fetchAudience(
  audienceId: string,
  options?: DatamoonClientOptions,
): Promise<DatamoonClientResult<DatamoonAudienceFetchResponse>> {
  const started = performance.now()
  const preflight = guardPreflight(options, "audience")
  const normalizedId = audienceId.trim()

  if (!normalizedId) {
    return skipResult(
      "Audience id is required.",
      preflight.audienceMode,
      "validation",
      started,
      resolveEnv(options),
    )
  }

  if (!preflight.ok) {
    return skipResult(
      preflight.message,
      preflight.audienceMode,
      preflight.error_category,
      started,
      resolveEnv(options),
    )
  }

  if (preflight.dryRun) {
    return dryRunResult(
      "Datamoon audience fetch dry-run — no HTTP.",
      preflight.audienceMode,
      {
        id: normalizedId,
        status: "completed",
        records: [
          {
            first_name: "Dry",
            last_name: "Run",
            business_email: "dry.run@example.com",
            personal_phone: "5550001234",
            linkedin_url: "https://linkedin.com/in/dry-run",
            personal_city: "Austin",
            personal_state: "tx",
          },
        ],
        record_count: 1,
        dry_run: true,
      },
      started,
    )
  }

  const env = resolveEnv(options)
  const apiKey = getDatamoonAudienceApiKey(env, preflight.audienceMode)!
  const baseUrl = resolveDatamoonAudienceBaseUrl(preflight.audienceMode)
  const http = await fetchDatamoonJson<DatamoonAudienceFetchResponse>({
    url: `${baseUrl}/audiences/fetch/${encodeURIComponent(normalizedId)}`,
    method: "GET",
    authMode: "header",
    apiKey,
    fetchImpl: options?.fetchImpl,
  })

  if (!http.ok || !http.data) {
    return failedFromHttp(http, preflight.audienceMode, "Datamoon audience fetch failed.", started)
  }

  return baseResult({
    status: "success",
    message: "Datamoon audience fetch succeeded.",
    data: http.data,
    dry_run: false,
    audience_mode: preflight.audienceMode,
    error_category: null,
    validation_errors: null,
    allowed_fields: null,
    latency_ms: http.latency_ms,
    http_status: http.status,
  })
}

/** Placeholder — export wiring deferred until saved-query workflow is integrated. */
export async function exportAudience(
  input: DatamoonExportAudienceInput,
  options?: DatamoonClientOptions,
): Promise<DatamoonClientResult<{ export_status: "not_implemented" }>> {
  const started = performance.now()
  const preflight = guardPreflight(options, "audience")

  if (!preflight.ok) {
    return skipResult(
      preflight.message,
      preflight.audienceMode,
      preflight.error_category,
      started,
      resolveEnv(options),
    )
  }

  if (!input.audience_id.trim()) {
    return skipResult(
      "Audience id is required for export.",
      preflight.audienceMode,
      "validation",
      started,
      resolveEnv(options),
    )
  }

  return baseResult({
    status: "skipped",
    message: "Datamoon audience export is not implemented in GE-DATAMOON-1A — use saved-query export later.",
    data: { export_status: "not_implemented" },
    dry_run: preflight.dryRun,
    audience_mode: preflight.audienceMode,
    error_category: null,
    validation_errors: null,
    allowed_fields: null,
    latency_ms: Math.round(performance.now() - started),
    http_status: null,
  })
}

export async function enrichByEmail(
  input: DatamoonEnrichByEmailInput,
  options?: DatamoonClientOptions,
): Promise<DatamoonClientResult<Record<string, unknown>>> {
  const started = performance.now()
  const preflight = guardPreflight(options, "enrichment")
  const email = input.email.trim()

  if (!email) {
    return skipResult(
      "Email is required for enrichment.",
      preflight.audienceMode,
      "validation",
      started,
      resolveEnv(options),
    )
  }

  if (!preflight.ok) {
    return skipResult(
      preflight.message,
      preflight.audienceMode,
      preflight.error_category,
      started,
      resolveEnv(options),
    )
  }

  if (preflight.dryRun) {
    return dryRunResult(
      "Datamoon email enrichment dry-run — no HTTP.",
      preflight.audienceMode,
      { dry_run: true, enrichment_type: "email" },
      started,
    )
  }

  const env = resolveEnv(options)
  const apiKey = getDatamoonEnrichmentApiKey(env)!
  const http = await fetchDatamoonJson<Record<string, unknown>>({
    url: `${DATAMOON_ENRICHMENT_BASE_URL}${DATAMOON_ENRICH_BY_EMAIL_PATH}`,
    method: "POST",
    authMode: "body",
    apiKey,
    body: { email },
    fetchImpl: options?.fetchImpl,
  })

  if (!http.ok || !http.data) {
    return failedFromHttp(http, preflight.audienceMode, "Datamoon email enrichment failed.", started)
  }

  return baseResult({
    status: "success",
    message: "Datamoon email enrichment succeeded.",
    data: http.data,
    dry_run: false,
    audience_mode: preflight.audienceMode,
    error_category: null,
    validation_errors: null,
    allowed_fields: null,
    latency_ms: http.latency_ms,
    http_status: http.status,
  })
}

export async function enrichByPhone(
  input: DatamoonEnrichByPhoneInput,
  options?: DatamoonClientOptions,
): Promise<DatamoonClientResult<Record<string, unknown>>> {
  const started = performance.now()
  const preflight = guardPreflight(options, "enrichment")
  const phone = input.phone.trim()

  if (!phone) {
    return skipResult(
      "Phone is required for enrichment.",
      preflight.audienceMode,
      "validation",
      started,
      resolveEnv(options),
    )
  }

  if (!preflight.ok) {
    return skipResult(
      preflight.message,
      preflight.audienceMode,
      preflight.error_category,
      started,
      resolveEnv(options),
    )
  }

  if (preflight.dryRun) {
    return dryRunResult(
      "Datamoon phone enrichment dry-run — no HTTP.",
      preflight.audienceMode,
      { dry_run: true, enrichment_type: "phone" },
      started,
    )
  }

  const env = resolveEnv(options)
  const apiKey = getDatamoonEnrichmentApiKey(env)!
  const http = await fetchDatamoonJson<Record<string, unknown>>({
    url: `${DATAMOON_ENRICHMENT_BASE_URL}${DATAMOON_ENRICH_BY_PHONE_PATH}`,
    method: "POST",
    authMode: "body",
    apiKey,
    body: { phone },
    fetchImpl: options?.fetchImpl,
  })

  if (!http.ok || !http.data) {
    return failedFromHttp(http, preflight.audienceMode, "Datamoon phone enrichment failed.", started)
  }

  return baseResult({
    status: "success",
    message: "Datamoon phone enrichment succeeded.",
    data: http.data,
    dry_run: false,
    audience_mode: preflight.audienceMode,
    error_category: null,
    validation_errors: null,
    allowed_fields: null,
    latency_ms: http.latency_ms,
    http_status: http.status,
  })
}
