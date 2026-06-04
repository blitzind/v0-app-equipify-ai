/** Client-safe Growth cron telemetry types (operational send plane v1). */

export const GROWTH_CRON_TELEMETRY_QA_MARKER = "growth-operational-send-plane-v1" as const

/** Crons removed from vercel.json but route handlers retained for rollback / telemetry history. */
export const GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL = ["growth-outreach-execute"] as const

export const GROWTH_CRON_ROUTE_IDS = [
  "growth-outreach-execute",
  "growth-sequence-scheduler",
  "growth-sequence-safe-execute",
  "growth-inbox-sync",
  "growth-signal-ingest",
  "growth-discovery-worker",
  "growth-email-discovery-worker",
  "growth-phone-discovery-worker",
  "growth-social-profile-discovery-worker",
  "growth-company-intelligence-worker",
  "growth-buying-committee-intelligence-worker",
  "growth-acquisition-worker",
  "growth-company-signal-refresh",
  "growth-contact-refresh",
  "growth-territory-refresh",
  "growth-market-health-refresh",
  "growth-dns-verify",
  "growth-sequence-recovery",
  "growth-lifecycle-maintenance",
  "growth-reputation-snapshot",
  "growth-warmup-progression",
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
