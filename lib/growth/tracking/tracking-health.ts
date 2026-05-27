import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER,
  type GrowthTrackingHealthSnapshot,
} from "@/lib/growth/tracking/tracking-types"
import { isGrowthEngagementTrackingSchemaReady } from "@/lib/growth/tracking/tracking-schema-health"

function isTrackingEnabledEnv(): boolean {
  const disabled = process.env.GROWTH_TRACKING_DISABLED?.trim()
  return disabled !== "true"
}

export async function buildTrackingHealthSnapshot(admin: SupabaseClient | null): Promise<GrowthTrackingHealthSnapshot> {
  const notes: string[] = []
  const schema_ready = admin ? await isGrowthEngagementTrackingSchemaReady(admin) : false
  const tracking_enabled = isTrackingEnabledEnv()

  if (!schema_ready) {
    notes.push("Apply migration 20270409120000_growth_engagement_tracking.sql.")
  }
  if (!tracking_enabled) {
    notes.push("Tracking disabled via GROWTH_TRACKING_DISABLED=true.")
  }

  let open_events_24h = 0
  let click_events_24h = 0

  if (admin && schema_ready) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [opensRes, clicksRes] = await Promise.all([
      admin.schema("growth").from("email_opens").select("id", { count: "exact", head: true }).gte("opened_at", since),
      admin.schema("growth").from("email_clicks").select("id", { count: "exact", head: true }).gte("clicked_at", since),
    ])
    open_events_24h = opensRes.count ?? 0
    click_events_24h = clicksRes.count ?? 0
    if (opensRes.error) notes.push("Could not count recent opens.")
    if (clicksRes.error) notes.push("Could not count recent clicks.")
  }

  let attribution_health: GrowthTrackingHealthSnapshot["attribution_health"] = "healthy"
  if (!schema_ready || !tracking_enabled) {
    attribution_health = "critical"
  } else if (notes.length > 0) {
    attribution_health = "degraded"
  }

  return {
    qa_marker: GROWTH_ENGAGEMENT_ATTRIBUTION_QA_MARKER,
    schema_ready,
    tracking_enabled,
    open_events_24h,
    click_events_24h,
    attribution_health,
    notes,
  }
}

export function trackingHealthLabel(health: GrowthTrackingHealthSnapshot["attribution_health"]): string {
  switch (health) {
    case "healthy":
      return "Healthy"
    case "degraded":
      return "Degraded"
    case "critical":
      return "Critical"
    default:
      return "Unknown"
  }
}

export function supportsTrackingSimulation(): {
  trackingSupport: boolean
  linkRewriteSupport: boolean
  pixelSupport: boolean
} {
  return {
    trackingSupport: true,
    linkRewriteSupport: true,
    pixelSupport: true,
  }
}
