import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CommunicationMetricsPayload } from "@/lib/communications/types"

export type { CommunicationMetricsPayload } from "@/lib/communications/types"

function startOfUtcDayIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString()
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

/**
 * KPI aggregates from `communication_events` plus lightweight related counts.
 * Open rate uses an estimated benchmark when opens are not tracked on events.
 */
export async function computeCommunicationMetrics(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<CommunicationMetricsPayload> {
  const todayStart = startOfUtcDayIso()
  const thirtyDaysAgo = daysAgoIso(30)
  const sevenDaysAgo = daysAgoIso(7)

  const [
    emailsTodayRes,
    deliveryOkRes,
    deliveryFailRes,
    failedRes,
    remindersRes,
    quotesStaleRes,
  ] = await Promise.all([
    supabase
      .from("communication_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("channel", "email")
      .eq("direction", "outbound")
      .gte("created_at", todayStart),
    supabase
      .from("communication_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", thirtyDaysAgo)
      .in("delivery_status", ["sent", "delivered"]),
    supabase
      .from("communication_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", thirtyDaysAgo)
      .in("delivery_status", ["failed", "bounced"]),
    supabase
      .from("communication_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("delivery_status", ["failed", "bounced"]),
    supabase
      .from("communication_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", sevenDaysAgo)
      .not("scheduled_reminder_key", "is", null),
    supabase
      .from("org_quotes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .in("status", ["sent", "pending_approval"])
      .not("sent_at", "is", null)
      .lt("sent_at", daysAgoIso(5)),
  ])

  const emailsSentToday = emailsTodayRes.count ?? 0
  const failedDeliveries = failedRes.count ?? 0
  const automatedRemindersWeek = remindersRes.count ?? 0
  const pendingFollowUps = quotesStaleRes.count ?? 0

  const deliveredLike = deliveryOkRes.count ?? 0
  const failedLike = deliveryFailRes.count ?? 0
  const deliverySample = deliveredLike + failedLike
  const deliveryRatePercent =
    deliverySample > 0 ? Math.round((deliveredLike / deliverySample) * 1000) / 10 : null

  const opensTracked = false
  const openRateIsEstimated = !opensTracked
  const openRatePercent = openRateIsEstimated ? 38.5 : null

  return {
    emailsSentToday,
    deliveryRatePercent,
    deliveryRateSampleSize: deliverySample,
    openRatePercent,
    openRateIsEstimated,
    failedDeliveries,
    pendingFollowUps,
    automatedRemindersWeek,
    computedAtIso: new Date().toISOString(),
  }
}
