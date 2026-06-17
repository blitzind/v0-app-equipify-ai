/** Client-safe reply intelligence dashboard fetch (Phase 7I). */

import type { GrowthSalesExecutionDashboard } from "@/lib/growth/reply-intelligence/reply-intent-types"

export const GROWTH_REPLY_INTELLIGENCE_DASHBOARD_CLIENT_QA_MARKER =
  "growth-reply-intelligence-dashboard-client-v1" as const

export async function fetchGrowthReplyIntelligenceDashboard(): Promise<GrowthSalesExecutionDashboard> {
  const params = new URLSearchParams({ view: "needs_action", limit: "1" })
  const res = await fetch(`/api/platform/growth/replies/dashboard?${params.toString()}`, { cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    dashboard?: GrowthSalesExecutionDashboard
    message?: string
  }
  if (!res.ok || !data.ok || !data.dashboard) {
    throw new Error(data.message ?? "Could not load reply intelligence dashboard.")
  }
  return data.dashboard
}
