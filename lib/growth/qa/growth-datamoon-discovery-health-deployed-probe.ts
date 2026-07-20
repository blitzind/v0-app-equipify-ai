/**
 * GE-AIOS-LIVE-2D — Fetch deployed Production DataMoon discovery health (authenticated).
 * Reuses the existing /api/platform/growth/ai-os/datamoon-discovery-health endpoint.
 */

import { resolveGrowthDeployedRuntimeBaseUrl } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import type {
  DatamoonAutonomousDiscoveryHealthSnapshot,
  DatamoonAutonomousDiscoveryStatusLabel,
  DatamoonAutonomousDiscoveryStopReason,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import type { DatamoonProductionEnvPresence } from "@/lib/growth/prospect-search/prospect-search-datamoon-production-configuration-audit-2b"

export const GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH =
  "/api/platform/growth/ai-os/datamoon-discovery-health" as const

export type DeployedDatamoonDiscoveryHealthSnapshot = DatamoonAutonomousDiscoveryHealthSnapshot & {
  stopReason?: DatamoonAutonomousDiscoveryStopReason | null
  statusLabel?: DatamoonAutonomousDiscoveryStatusLabel
  statusDisplay?: string
  requiredEnv?: Record<string, DatamoonProductionEnvPresence>
  configurationCompleteForProduction?: boolean
  blockingReasons?: string[]
}

export type DeployedDatamoonDiscoveryHealthProbeResult =
  | {
      ok: true
      probed: true
      baseUrl: string
      status: number
      snapshot: DeployedDatamoonDiscoveryHealthSnapshot
    }
  | {
      ok: false
      probed: boolean
      baseUrl: string
      status: number | null
      error: string
    }

export async function fetchDeployedDatamoonDiscoveryHealth(input: {
  bearerToken: string
  baseUrl?: string | null
}): Promise<DeployedDatamoonDiscoveryHealthProbeResult> {
  const baseUrl = (input.baseUrl ?? resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(
    /\/$/,
    "",
  )
  const url = `${baseUrl}${GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH}`

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
    let body: DeployedDatamoonDiscoveryHealthSnapshot | Record<string, unknown> | null = null
    try {
      body = JSON.parse(raw) as DeployedDatamoonDiscoveryHealthSnapshot
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
      snapshot: body as DeployedDatamoonDiscoveryHealthSnapshot,
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
