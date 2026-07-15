/**
 * GE-AIOS-LIVE-RUNTIME-CONFIG-PROOF-1A — Fetch deployed runtime config health (authenticated).
 */

import { resolveGrowthDeployedRuntimeBaseUrl } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import type { GrowthAiosRuntimeConfigHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-types"

export const GROWTH_AIOS_RUNTIME_CONFIG_HEALTH_ROUTE_PATH =
  "/api/platform/growth/ai-os/runtime-config-health" as const

export type GrowthAiosRuntimeConfigHealthDeployedProbeResult =
  | {
      ok: true
      probed: true
      baseUrl: string
      status: number
      snapshot: GrowthAiosRuntimeConfigHealthSnapshot
    }
  | {
      ok: false
      probed: boolean
      baseUrl: string
      status: number | null
      error: string
    }

export async function fetchDeployedGrowthAiosRuntimeConfigHealth(input: {
  bearerToken: string
  baseUrl?: string | null
}): Promise<GrowthAiosRuntimeConfigHealthDeployedProbeResult> {
  const baseUrl = (input.baseUrl ?? resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(
    /\/$/,
    "",
  )
  const url = `${baseUrl}${GROWTH_AIOS_RUNTIME_CONFIG_HEALTH_ROUTE_PATH}`

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.bearerToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
    })

    const raw = await response.text()
    let body: GrowthAiosRuntimeConfigHealthSnapshot | Record<string, unknown> | null = null
    try {
      body = JSON.parse(raw) as GrowthAiosRuntimeConfigHealthSnapshot
    } catch {
      return {
        ok: false,
        probed: true,
        baseUrl,
        status: response.status,
        error: "invalid_json_response",
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        probed: true,
        baseUrl,
        status: response.status,
        error: typeof body === "object" && body && "error" in body ? String(body.error) : "http_error",
      }
    }

    return {
      ok: true,
      probed: true,
      baseUrl,
      status: response.status,
      snapshot: body as GrowthAiosRuntimeConfigHealthSnapshot,
    }
  } catch (error) {
    return {
      ok: false,
      probed: false,
      baseUrl,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
