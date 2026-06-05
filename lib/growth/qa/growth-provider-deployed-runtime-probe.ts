/**
 * Phase 7.PS-HO-RUNTIME — Probe deployed Vercel Production runtime (no local .env).
 */

import { execFileSync } from "node:child_process"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

export const GROWTH_PROVIDER_DEPLOYED_RUNTIME_PROBE_QA_MARKER =
  "growth-provider-deployed-runtime-probe-7-ps-ho-runtime-v1" as const

const RUNTIME_DIAGNOSTICS_CRON_ROUTE = growthCronApiPath("growth-provider-runtime-diagnostics")
const EMAIL_DISCOVERY_CERT_CRON_ROUTE = growthCronApiPath("growth-email-discovery-cert-run")

export type GrowthProviderDeployedRuntimeProbeResult =
  | {
      ok: true
      probed: true
      base_url: string
      auth_method: string | null
      probe_channel: "http" | "vercel_cron_telemetry"
      diagnostics: GrowthProviderRuntimeDiagnosticsSnapshot
      http_status: number | null
    }
  | {
      ok: false
      probed: boolean
      base_url: string | null
      http_status: number | null
      error: string
      detail?: string
      probe_channel?: "http" | "vercel_cron_telemetry" | null
    }

function trimUrl(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim().replace(/\/$/, "")
  return trimmed.startsWith("http") ? trimmed : null
}

export function resolveGrowthDeployedRuntimeBaseUrl(input?: {
  explicit_url?: string | null
  env?: NodeJS.ProcessEnv
}): string | null {
  const env = input?.env ?? process.env
  return (
    trimUrl(input?.explicit_url ?? undefined) ||
    trimUrl(env.GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_URL) ||
    trimUrl(env.GROWTH_ENGINE_PUBLIC_BASE_URL) ||
    trimUrl(env.NEXT_PUBLIC_SITE_URL) ||
    trimUrl(env.NEXT_PUBLIC_APP_URL) ||
    trimUrl(env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined) ||
    "https://app.equipify.ai"
  )
}

export function resolveGrowthDeployedRuntimeCronSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = (env.CRON_SECRET ?? env.GROWTH_PROVIDER_RUNTIME_CRON_SECRET ?? "").trim()
  return secret.length > 0 ? secret : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function triggerVercelCron(cronPath: string): void {
  execFileSync("vercel", ["crons", "run", cronPath], {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
    encoding: "utf8",
  })
}

async function fetchCronTelemetryMetadata(input: {
  admin: SupabaseClient
  cron_route: string
  started_after: string
  poll_timeout_ms?: number
}): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + (input.poll_timeout_ms ?? 90_000)
  while (Date.now() < deadline) {
    const { data, error } = await input.admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("metadata, started_at, ok")
      .eq("cron_route", input.cron_route)
      .eq("ok", true)
      .gte("started_at", input.started_after)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data?.metadata && typeof data.metadata === "object") {
      return data.metadata as Record<string, unknown>
    }
    await sleep(2_000)
  }
  return null
}

function diagnosticsFromCronMetadata(
  metadata: Record<string, unknown>,
): GrowthProviderRuntimeDiagnosticsSnapshot | null {
  const direct = metadata.diagnostics
  if (direct && typeof direct === "object") {
    return direct as GrowthProviderRuntimeDiagnosticsSnapshot
  }
  const nested = metadata.cert_result
  if (nested && typeof nested === "object") {
    const provider = (nested as { provider_snapshot?: unknown }).provider_snapshot
    if (provider && typeof provider === "object") {
      return provider as GrowthProviderRuntimeDiagnosticsSnapshot
    }
  }
  return null
}

async function probeDeployedGrowthProviderRuntimeViaVercelCron(input: {
  base_url: string
  admin: SupabaseClient
}): Promise<GrowthProviderDeployedRuntimeProbeResult> {
  const started_after = new Date().toISOString()
  try {
    triggerVercelCron(RUNTIME_DIAGNOSTICS_CRON_ROUTE)
  } catch (e) {
    return {
      ok: false,
      probed: false,
      base_url: input.base_url,
      http_status: null,
      probe_channel: "vercel_cron_telemetry",
      error: "vercel_cron_trigger_failed",
      detail: e instanceof Error ? e.message : String(e),
    }
  }

  const metadata = await fetchCronTelemetryMetadata({
    admin: input.admin,
    cron_route: RUNTIME_DIAGNOSTICS_CRON_ROUTE,
    started_after,
  })

  if (!metadata) {
    return {
      ok: false,
      probed: true,
      base_url: input.base_url,
      http_status: null,
      probe_channel: "vercel_cron_telemetry",
      error: "vercel_cron_telemetry_timeout",
      detail:
        "Triggered /api/cron/growth-provider-runtime-diagnostics but no ok telemetry row appeared within poll window.",
    }
  }

  const diagnostics = diagnosticsFromCronMetadata(metadata)
  if (!diagnostics) {
    return {
      ok: false,
      probed: true,
      base_url: input.base_url,
      http_status: null,
      probe_channel: "vercel_cron_telemetry",
      error: "vercel_cron_telemetry_invalid_payload",
      detail: "Cron telemetry metadata missing diagnostics snapshot.",
    }
  }

  return {
    ok: true,
    probed: true,
    base_url: input.base_url,
    auth_method: "vercel_cron",
    probe_channel: "vercel_cron_telemetry",
    diagnostics,
    http_status: null,
  }
}

async function probeDeployedGrowthProviderRuntimeViaHttp(input: {
  base_url: string
  cron_secret: string
  fetch_impl?: typeof fetch
}): Promise<GrowthProviderDeployedRuntimeProbeResult> {
  const url = `${input.base_url}/api/platform/growth/providers/runtime-diagnostics`
  const fetchFn = input.fetch_impl ?? fetch

  try {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.cron_secret}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    })

    const raw = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        probed: true,
        base_url: input.base_url,
        http_status: response.status,
        probe_channel: "http",
        error:
          response.status === 404
            ? "deployed_endpoint_not_found"
            : response.status === 401
              ? "deployed_auth_failed"
              : "deployed_probe_http_error",
        detail: raw.slice(0, 500),
      }
    }

    const body = JSON.parse(raw) as {
      ok?: boolean
      auth_method?: string
      diagnostics?: GrowthProviderRuntimeDiagnosticsSnapshot
    }

    if (!body.diagnostics) {
      return {
        ok: false,
        probed: true,
        base_url: input.base_url,
        http_status: response.status,
        probe_channel: "http",
        error: "deployed_probe_invalid_payload",
        detail: raw.slice(0, 500),
      }
    }

    return {
      ok: true,
      probed: true,
      base_url: input.base_url,
      auth_method: body.auth_method ?? null,
      probe_channel: "http",
      diagnostics: body.diagnostics,
      http_status: response.status,
    }
  } catch (e) {
    return {
      ok: false,
      probed: true,
      base_url: input.base_url,
      http_status: null,
      probe_channel: "http",
      error: "deployed_probe_network_error",
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function probeDeployedGrowthProviderRuntime(input?: {
  base_url?: string | null
  cron_secret?: string | null
  fetch_impl?: typeof fetch
  /** Service-role client for vercel crons run + cron_execution_runs telemetry fallback. */
  admin?: SupabaseClient | null
}): Promise<GrowthProviderDeployedRuntimeProbeResult> {
  const base_url = resolveGrowthDeployedRuntimeBaseUrl({ explicit_url: input?.base_url ?? null })
  if (!base_url) {
    return {
      ok: false,
      probed: false,
      base_url: null,
      http_status: null,
      error: "deployed_base_url_unconfigured",
      detail:
        "Set GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_URL or GROWTH_ENGINE_PUBLIC_BASE_URL (or pass base_url).",
    }
  }

  const cron_secret = (input?.cron_secret ?? resolveGrowthDeployedRuntimeCronSecret() ?? "").trim()
  if (cron_secret) {
    const http_probe = await probeDeployedGrowthProviderRuntimeViaHttp({
      base_url,
      cron_secret,
      fetch_impl: input?.fetch_impl,
    })
    if (http_probe.ok) return http_probe
    if (!input?.admin) return http_probe
  }

  if (input?.admin) {
    return probeDeployedGrowthProviderRuntimeViaVercelCron({
      base_url,
      admin: input.admin,
    })
  }

  return {
    ok: false,
    probed: false,
    base_url,
    http_status: null,
    error: "cron_secret_unavailable_for_probe",
    detail:
      "Set CRON_SECRET in cert runner shell, or bootstrap Supabase service role so vercel crons run telemetry fallback can execute.",
  }
}

export async function runDeployedEmailDiscoveryCert(input: {
  base_url: string
  cron_secret?: string | null
  company_id: string
  person_id: string
  fetch_impl?: typeof fetch
  admin?: SupabaseClient | null
}): Promise<{
  ok: boolean
  http_status: number | null
  error: string | null
  body: Record<string, unknown> | null
  channel: "http" | "vercel_cron_telemetry"
}> {
  const cron_secret = (input.cron_secret ?? resolveGrowthDeployedRuntimeCronSecret() ?? "").trim()

  if (cron_secret) {
    const url = `${input.base_url.replace(/\/$/, "")}/api/platform/growth/email-discovery/cert-run`
    const fetchFn = input.fetch_impl ?? fetch
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cron_secret}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: input.company_id,
          person_id: input.person_id,
          promote: true,
        }),
        signal: AbortSignal.timeout(120_000),
      })
      const raw = await response.text()
      let body: Record<string, unknown> | null = null
      try {
        body = JSON.parse(raw) as Record<string, unknown>
      } catch {
        body = { raw: raw.slice(0, 500) }
      }
      if (response.ok) {
        return {
          ok: true,
          http_status: response.status,
          error: null,
          body,
          channel: "http",
        }
      }
      if (!input.admin) {
        return {
          ok: false,
          http_status: response.status,
          error: String(body?.error ?? "email_discovery_cert_run_failed"),
          body,
          channel: "http",
        }
      }
    } catch (e) {
      if (!input.admin) {
        return {
          ok: false,
          http_status: null,
          error: e instanceof Error ? e.message : String(e),
          body: null,
          channel: "http",
        }
      }
    }
  }

  if (!input.admin) {
    return {
      ok: false,
      http_status: null,
      error: "cron_secret_unavailable_for_email_discovery_cert",
      body: null,
      channel: "http",
    }
  }

  const started_after = new Date().toISOString()
  try {
    triggerVercelCron(EMAIL_DISCOVERY_CERT_CRON_ROUTE)
  } catch (e) {
    return {
      ok: false,
      http_status: null,
      error: "vercel_cron_email_discovery_trigger_failed",
      body: { detail: e instanceof Error ? e.message : String(e) },
      channel: "vercel_cron_telemetry",
    }
  }

  const metadata = await fetchCronTelemetryMetadata({
    admin: input.admin,
    cron_route: EMAIL_DISCOVERY_CERT_CRON_ROUTE,
    started_after,
    poll_timeout_ms: 120_000,
  })

  if (!metadata?.cert_result || typeof metadata.cert_result !== "object") {
    return {
      ok: false,
      http_status: null,
      error: "vercel_cron_email_discovery_telemetry_timeout",
      body: null,
      channel: "vercel_cron_telemetry",
    }
  }

  const cert_result = metadata.cert_result as Record<string, unknown>
  return {
    ok: cert_result.ok === true,
    http_status: cert_result.ok === true ? 200 : 503,
    error: cert_result.ok === true ? null : String(cert_result.error ?? "email_discovery_cert_run_failed"),
    body: cert_result,
    channel: "vercel_cron_telemetry",
  }
}
