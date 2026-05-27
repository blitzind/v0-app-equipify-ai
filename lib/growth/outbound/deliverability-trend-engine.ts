import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { computeMailboxOperationalHealth } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import type { GrowthInfrastructureRecommendation } from "@/lib/growth/outbound/reputation-safe-scaling-types"

export type DeliverabilityTrendRow = {
  scopeType: string
  scopeId: string | null
  scopeLabel: string
  bounceRate: number
  complaintRate: number
  rejectionRate: number
  replyQualityAvg: number
  anomalyDetected: boolean
  anomalyReasons: string[]
}

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function computeDeliverabilityTrends(admin: SupabaseClient): Promise<DeliverabilityTrendRow[]> {
  const trends: DeliverabilityTrendRow[] = []
  const since24h = since24hIso()

  const { data: domains } = await admin.schema("growth").from("sender_domains").select("id, domain")
  for (const domain of domains ?? []) {
    const domainId = String((domain as Record<string, unknown>).id)
    const domainName = String((domain as Record<string, unknown>).domain)
    const health = await computeDomainOperationalHealth(admin, domainId)
    const anomalyReasons: string[] = []
    if (health.signals.bounceRate >= 5) anomalyReasons.push(`Bounce rate ${health.signals.bounceRate}%`)
    if (health.signals.complaintRate >= 0.3) anomalyReasons.push(`Complaint rate ${health.signals.complaintRate}%`)
    trends.push({
      scopeType: "domain",
      scopeId: domainId,
      scopeLabel: domainName,
      bounceRate: health.signals.bounceRate,
      complaintRate: health.signals.complaintRate,
      rejectionRate: health.signals.sendFailureRate,
      replyQualityAvg: 100 - health.signals.bounceRate * 2,
      anomalyDetected: anomalyReasons.length > 0,
      anomalyReasons,
    })
  }

  const { data: senders } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address")
    .is("deleted_at", null)
    .limit(50)

  for (const sender of senders ?? []) {
    const senderId = String((sender as Record<string, unknown>).id)
    const health = await computeMailboxOperationalHealth(admin, senderId)
    if (!health) continue
    const anomalyReasons: string[] = [...health.riskReasons]
    trends.push({
      scopeType: "sender",
      scopeId: senderId,
      scopeLabel: health.emailAddress,
      bounceRate: health.signals.bounces24h,
      complaintRate: health.signals.complaints24h,
      rejectionRate: health.signals.providerRejections24h,
      replyQualityAvg: health.trustScore,
      anomalyDetected: health.operationalStatus !== "healthy",
      anomalyReasons,
    })
  }

  const [{ count: sent }, { count: failed }, { count: complaints }] = await Promise.all([
    admin.schema("growth").from("delivery_attempts").select("id", { count: "exact", head: true }).gte("created_at", since24h).in("status", ["sent", "delivered"]),
    admin.schema("growth").from("delivery_attempts").select("id", { count: "exact", head: true }).gte("created_at", since24h).eq("status", "failed"),
    admin.schema("growth").from("email_complaints").select("id", { count: "exact", head: true }).gte("occurred_at", since24h),
  ])

  const sentCount = sent ?? 0
  const platformBounceProxy = sentCount > 0 ? Math.round(((failed ?? 0) / sentCount) * 1000) / 10 : 0
  const platformComplaint = sentCount > 0 ? Math.round(((complaints ?? 0) / sentCount) * 1000) / 10 : 0

  trends.push({
    scopeType: "platform",
    scopeId: null,
    scopeLabel: "platform",
    bounceRate: platformBounceProxy,
    complaintRate: platformComplaint,
    rejectionRate: platformBounceProxy,
    replyQualityAvg: 100 - platformComplaint * 5,
    anomalyDetected: platformBounceProxy >= 10 || platformComplaint >= 0.5,
    anomalyReasons:
      platformBounceProxy >= 10 || platformComplaint >= 0.5
        ? ["Platform-level send failure or complaint elevation detected."]
        : [],
  })

  return trends
}

export async function persistDeliverabilityTrendSnapshots(
  admin: SupabaseClient,
  trends: DeliverabilityTrendRow[],
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  for (const trend of trends) {
    await admin.schema("growth").from("deliverability_trend_snapshots").upsert(
      {
        snapshot_date: snapshotDate,
        scope_type: trend.scopeType,
        scope_id: trend.scopeId,
        scope_label: trend.scopeLabel,
        bounce_rate: trend.bounceRate,
        complaint_rate: trend.complaintRate,
        rejection_rate: trend.rejectionRate,
        reply_quality_avg: trend.replyQualityAvg,
        anomaly_detected: trend.anomalyDetected,
        anomaly_reasons: trend.anomalyReasons,
      },
      { onConflict: "snapshot_date,scope_type,scope_id" },
    )
  }
}

export function buildInfrastructureRecommendations(
  trends: DeliverabilityTrendRow[],
  throughputCritical: number,
): GrowthInfrastructureRecommendation[] {
  const recs: GrowthInfrastructureRecommendation[] = []

  for (const trend of trends.filter((t) => t.anomalyDetected)) {
    if (trend.scopeType === "domain" && trend.bounceRate >= 8) {
      recs.push({
        type: "reduce_volume",
        title: `Reduce volume on ${trend.scopeLabel}`,
        detail: "Elevated bounce correlation — operator should reduce campaign throughput.",
        severity: "high",
      })
      recs.push({
        type: "rotate_domain",
        title: `Consider domain rotation for ${trend.scopeLabel}`,
        detail: "Shift sends to secondary/high-trust domain segment to isolate risk.",
        severity: "medium",
      })
    }
    if (trend.complaintRate >= 0.5) {
      recs.push({
        type: "pause_campaign",
        title: "Pause affected campaigns",
        detail: "Complaint trend detected — human operator should pause and review.",
        severity: "critical",
      })
    }
    if (trend.scopeType === "sender" && trend.rejectionRate >= 5) {
      recs.push({
        type: "cooldown_sender",
        title: `Cooldown sender ${trend.scopeLabel}`,
        detail: "Provider rejection pattern — pause sender in pool (manual re-enable).",
        severity: "high",
      })
    }
  }

  if (throughputCritical >= 3) {
    recs.push({
      type: "defer_sends",
      title: "Defer non-critical sends",
      detail: "Multiple infrastructure entities at critical saturation — queue defer recommended.",
      severity: "high",
    })
  }

  const domainTrend = trends.find((t) => t.scopeType === "domain" && t.anomalyReasons.some((r) => /DNS/i.test(r)))
  if (domainTrend) {
    recs.push({
      type: "investigate_dns",
      title: "Investigate DNS issue",
      detail: "Re-run live DNS verification before resuming volume.",
      severity: "critical",
    })
  }

  return recs
}

export async function detectOperationalAnomalies(admin: SupabaseClient): Promise<DeliverabilityTrendRow[]> {
  const trends = await computeDeliverabilityTrends(admin)
  await persistDeliverabilityTrendSnapshots(admin, trends)
  return trends.filter((t) => t.anomalyDetected)
}
