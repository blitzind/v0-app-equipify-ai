/** Client-safe Growth cron telemetry types (operational send plane v1). */

export const GROWTH_CRON_TELEMETRY_QA_MARKER = "growth-operational-send-plane-v1" as const

export const GROWTH_CRON_ROUTE_IDS = [
  "growth-outreach-execute",
  "growth-sequence-scheduler",
  "growth-sequence-safe-execute",
  "growth-inbox-sync",
  "growth-signal-ingest",
  "growth-discovery-worker",
  "growth-company-signal-refresh",
  "growth-contact-refresh",
  "growth-territory-refresh",
  "growth-market-health-refresh",
  "growth-dns-verify",
  "growth-sequence-recovery",
] as const

export type GrowthCronRouteId = (typeof GROWTH_CRON_ROUTE_IDS)[number]

export type GrowthCronExecutionCategory = "outbound" | "inbox" | "intelligence" | "discovery"

export type GrowthCronExecutionRunRecord = {
  id: string
  cronRoute: string
  category: GrowthCronExecutionCategory
  startedAt: string
  finishedAt: string
  durationMs: number
  ok: boolean
  processedCount: number
  failedCount: number
  skippedCount: number
  errorMessage: string | null
  metadata: Record<string, unknown>
}

export type GrowthCronRouteHealth = {
  routeId: GrowthCronRouteId
  path: string
  category: GrowthCronExecutionCategory
  registered: boolean
  lastSuccessAt: string | null
  lastRunAt: string | null
  lastDurationMs: number | null
  failureCount24h: number
  successCount24h: number
  queueLagMinutes: number | null
}

export function growthCronApiPath(routeId: GrowthCronRouteId): string {
  return `/api/cron/${routeId}`
}
