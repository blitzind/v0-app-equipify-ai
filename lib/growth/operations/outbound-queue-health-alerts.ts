import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/deliverability-governance-events"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import type { GrowthOutboundQueueHealthAlert } from "@/lib/growth/outbound/outbound-reliability-types"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"

const OUTBOUND_CRON_ROUTES = [
  "growth-outreach-execute",
  "growth-sequence-safe-execute",
  "growth-sequence-scheduler",
] as const

const ALERT_DEDUPE_MS = 6 * 60 * 60 * 1000

async function hasRecentOutboundAlert(
  admin: SupabaseClient,
  ruleId: string,
  entityKey: string,
): Promise<boolean> {
  const since = new Date(Date.now() - ALERT_DEDUPE_MS).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("internal_outbound_audit_events")
    .select("id")
    .eq("event_type", "outbound_queue_health_alert")
    .gte("created_at", since)
    .contains("metadata", { alert_rule: ruleId, entity_key: entityKey })
    .limit(1)
  return (data?.length ?? 0) > 0
}

export async function evaluateOutboundQueueHealthAlerts(
  admin: SupabaseClient,
): Promise<GrowthOutboundQueueHealthAlert[]> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const overdueThreshold = new Date(now - 30 * 60 * 1000).toISOString()
  const stuckThreshold = new Date(now - 20 * 60 * 1000).toISOString()
  const cronStaleThreshold = new Date(now - 2 * 60 * 60 * 1000).toISOString()

  const [
    overdueScheduled,
    stuckProcessing,
    failed24h,
    deadLetter,
    seqStalled,
    scheduledCount,
    cronRuns,
  ] = await Promise.all([
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .lte("scheduled_for", overdueThreshold),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .lte("processing_started_at", stuckThreshold)
      .not("processing_started_at", "is", null),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("failed_at", new Date(now - 24 * 60 * 60 * 1000).toISOString()),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "dead_letter"),
    admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("updated_at", new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()),
    admin
      .schema("growth")
      .from("outreach_queue")
      .select("id", { count: "exact", head: true })
      .in("status", ["scheduled", "approved"]),
    listRecentGrowthCronExecutionRuns(admin, { limit: 100 }),
  ])

  const alerts: GrowthOutboundQueueHealthAlert[] = []

  const overdueCount = overdueScheduled.count ?? 0
  if (overdueCount > 0) {
    alerts.push({
      rule_id: "scheduled_overdue",
      severity: overdueCount >= 5 ? "high" : "medium",
      title: "Scheduled outreach overdue",
      summary: `${overdueCount} scheduled queue item(s) are past due.`,
      count: overdueCount,
      metadata: { threshold_minutes: 30 },
    })
  }

  const stuckCount = stuckProcessing.count ?? 0
  if (stuckCount > 0) {
    alerts.push({
      rule_id: "stuck_processing",
      severity: "high",
      title: "Outreach items stuck processing",
      summary: `${stuckCount} approved item(s) have been processing for over 20 minutes.`,
      count: stuckCount,
      metadata: { threshold_minutes: 20 },
    })
  }

  const failedCount = failed24h.count ?? 0
  const deadLetterCount = deadLetter.count ?? 0
  if (failedCount + deadLetterCount >= 3) {
    alerts.push({
      rule_id: "repeated_provider_failure",
      severity: failedCount + deadLetterCount >= 8 ? "critical" : "high",
      title: "Repeated outreach failures",
      summary: `${failedCount} failed and ${deadLetterCount} dead-letter item(s) need operator review.`,
      count: failedCount + deadLetterCount,
      metadata: { failed_24h: failedCount, dead_letter: deadLetterCount },
    })
  }

  const stalledSeq = seqStalled.count ?? 0
  if (stalledSeq >= 5) {
    alerts.push({
      rule_id: "sequence_enrollment_stalled",
      severity: "medium",
      title: "Sequence enrollments stalled",
      summary: `${stalledSeq} active enrollment(s) have not progressed in 7+ days.`,
      count: stalledSeq,
      metadata: {},
    })
  }

  for (const routeId of OUTBOUND_CRON_ROUTES) {
    const path = growthCronApiPath(routeId)
    const lastRun = cronRuns.find((run) => run.cronRoute === path && run.ok)
    if (!lastRun || lastRun.finishedAt < cronStaleThreshold) {
      alerts.push({
        rule_id: "cron_stale",
        severity: routeId === "growth-outreach-execute" ? "critical" : "high",
        title: `Cron stale: ${routeId}`,
        summary: lastRun
          ? `Last success ${lastRun.finishedAt} — exceeds 2h threshold.`
          : `No successful run recorded for ${routeId}.`,
        count: 1,
        metadata: { cron_route: routeId, last_success_at: lastRun?.finishedAt ?? null },
      })
    }
  }

  const lagCount = scheduledCount.count ?? 0
  if (lagCount >= 25) {
    alerts.push({
      rule_id: "queue_lag_high",
      severity: lagCount >= 50 ? "critical" : "high",
      title: "Outreach queue lag elevated",
      summary: `${lagCount} scheduled/approved item(s) waiting execution.`,
      count: lagCount,
      metadata: { threshold: 25 },
    })
  }

  return alerts
}

export async function persistOutboundQueueHealthAlerts(
  admin: SupabaseClient,
  alerts: GrowthOutboundQueueHealthAlert[],
): Promise<number> {
  let emitted = 0
  for (const alert of alerts) {
    const entityKey = `${alert.rule_id}:${alert.count}`
    if (await hasRecentOutboundAlert(admin, alert.rule_id, entityKey)) continue

    await recordInternalOutboundAuditEvent(admin, {
      eventType: "outbound_queue_health_alert",
      severity: alert.severity,
      title: alert.title,
      summary: alert.summary,
      metadata: {
        alert_rule: alert.rule_id,
        entity_key: entityKey,
        count: alert.count,
        ...alert.metadata,
      },
    }).catch(() => undefined)

    await appendDeliverabilityGovernanceEvent(admin, {
      event_type: "deliverability_risk_detected",
      title: alert.title,
      summary: alert.summary,
      severity: alert.severity,
      metadata: { alert_rule: alert.rule_id, outbound_reliability: true, ...alert.metadata },
    }).catch(() => undefined)

    emitted += 1
  }
  return emitted
}

export async function runOutboundQueueHealthAlertScan(admin: SupabaseClient): Promise<{
  alerts: GrowthOutboundQueueHealthAlert[]
  emitted: number
}> {
  const alerts = await evaluateOutboundQueueHealthAlerts(admin)
  const emitted = await persistOutboundQueueHealthAlerts(admin, alerts)
  return { alerts, emitted }
}
