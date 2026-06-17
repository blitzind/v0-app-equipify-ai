/** Client-safe conversations dashboard fetch (Phase 7P). */

import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_CONVERSATIONS_DASHBOARD_CLIENT_QA_MARKER =
  "growth-conversations-dashboard-client-v1" as const

export type GrowthConversationsDashboardPayload = {
  averageHealth: number
  strongHealth: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  buyingIntent: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  sentimentShift: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  competitorMentions: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  topObjections: Array<{ key: string; count: number }>
  urgencyTrends: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  conversationRisk: Array<Partial<GrowthLead> & { id: string; companyName: string }>
}

export async function fetchGrowthConversationsDashboard(): Promise<GrowthConversationsDashboardPayload> {
  const res = await fetch("/api/platform/growth/conversations/dashboard", { cache: "no-store" })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    dashboard?: GrowthConversationsDashboardPayload
    message?: string
  }
  if (!res.ok || !data.ok || !data.dashboard) {
    throw new Error(data.message ?? "Could not load conversation dashboard.")
  }
  return data.dashboard
}
