/**
 * GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B — Fetch deployed autonomy tick dry-run health.
 */

import { resolveGrowthDeployedRuntimeBaseUrl } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import type { GrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"

export const GROWTH_AIOS_AUTONOMY_TICK_HEALTH_ROUTE_PATH =
  "/api/platform/growth/ai-os/autonomy-tick-health" as const

export type GrowthAiosAutonomyTickHealthDeployedProbeResult =
  | {
      ok: true
      probed: true
      baseUrl: string
      status: number
      snapshot: GrowthAiosAutonomyTickHealthSnapshot
    }
  | {
      ok: false
      probed: boolean
      baseUrl: string
      status: number | null
      error: string
    }

export async function fetchDeployedGrowthAiosAutonomyTickHealth(input: {
  bearerToken: string
  baseUrl?: string | null
}): Promise<GrowthAiosAutonomyTickHealthDeployedProbeResult> {
  const baseUrl = (input.baseUrl ?? resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(
    /\/$/,
    "",
  )
  const url = `${baseUrl}${GROWTH_AIOS_AUTONOMY_TICK_HEALTH_ROUTE_PATH}`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.bearerToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dryRun: true, maxIterations: 1 }),
      signal: AbortSignal.timeout(120_000),
    })

    const raw = await response.text()
    let body: GrowthAiosAutonomyTickHealthSnapshot | Record<string, unknown> | null = null
    try {
      body = JSON.parse(raw) as GrowthAiosAutonomyTickHealthSnapshot
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
      snapshot: body as GrowthAiosAutonomyTickHealthSnapshot,
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
