import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthOperationalAlertCategory,
  GrowthOperationalAlertRow,
} from "@/lib/growth/outbound/lifecycle-ops-types"
import { fetchDeliverabilityIntelligenceDashboard } from "@/lib/growth/deliverability/deliverability-intelligence-dashboard"
import { computeThroughputUtilization } from "@/lib/growth/outbound/throughput-allocator"

function alertsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("operational_alerts")
}

export async function createOperationalAlert(
  admin: SupabaseClient,
  input: {
    category: GrowthOperationalAlertCategory
    severity?: "low" | "medium" | "high" | "critical"
    title: string
    summary?: string | null
    dedupeKey: string
    metadata?: Record<string, unknown>
  },
): Promise<boolean> {
  const { error } = await alertsTable(admin).insert({
    alert_category: input.category,
    severity: input.severity ?? "medium",
    title: input.title,
    summary: input.summary ?? null,
    dedupe_key: input.dedupeKey,
    metadata: input.metadata ?? {},
  })

  if (error?.code === "23505") return false
  if (error) {
    console.error("[operational-alert]", error.message)
    return false
  }

  await dispatchOptionalAlertChannels(input).catch(() => undefined)
  return true
}

async function dispatchOptionalAlertChannels(input: {
  category: string
  severity?: string
  title: string
  summary?: string | null
}): Promise<void> {
  const slackUrl = process.env.GROWTH_OPS_SLACK_WEBHOOK_URL?.trim()
  if (slackUrl) {
    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[Growth Ops ${input.severity ?? "medium"}] ${input.title}${input.summary ? `\n${input.summary}` : ""}`,
      }),
    }).catch(() => undefined)
  }

  const alertEmail = process.env.GROWTH_OPS_ALERT_EMAIL?.trim()
  if (alertEmail) {
    console.info("[operational-alert-email]", alertEmail, input.title, input.summary)
  }
}

export async function runOperationalAlertScan(admin: SupabaseClient): Promise<{ alertsCreated: number }> {
  let alertsCreated = 0
  const hourKey = new Date().toISOString().slice(0, 13)

  const deliverability = await fetchDeliverabilityIntelligenceDashboard(admin)
  const throughput = await computeThroughputUtilization(admin)

  if (deliverability.intelligence_summary.dnsFailureCount > 0) {
    const created = await createOperationalAlert(admin, {
      category: "dns_failure",
      severity: "high",
      title: "DNS verification failures detected",
      summary: `${deliverability.intelligence_summary.dnsFailureCount} domain(s) with DNS errors.`,
      dedupeKey: `dns_failure:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  if (deliverability.intelligence_summary.complaintSpikeDomains > 0) {
    const created = await createOperationalAlert(admin, {
      category: "complaint_spike",
      severity: "critical",
      title: "Complaint spike on domain(s)",
      summary: `${deliverability.intelligence_summary.complaintSpikeDomains} domain(s) elevated.`,
      dedupeKey: `complaint_spike:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  if (deliverability.intelligence_summary.bounceSpikeDomains > 0) {
    const created = await createOperationalAlert(admin, {
      category: "bounce_spike",
      severity: "high",
      title: "Bounce spike on domain(s)",
      summary: `${deliverability.intelligence_summary.bounceSpikeDomains} domain(s) elevated.`,
      dedupeKey: `bounce_spike:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  const criticalThroughput = throughput.filter((t) => t.saturationLevel === "critical")
  if (criticalThroughput.length >= 2) {
    const created = await createOperationalAlert(admin, {
      category: "throughput_risk",
      severity: "high",
      title: "Throughput saturation critical",
      summary: `${criticalThroughput.length} entities at critical utilization.`,
      dedupeKey: `throughput_risk:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  const poolSaturation = throughput.filter((t) => t.entityType === "pool" && t.saturationLevel === "critical")
  if (poolSaturation.length > 0) {
    const created = await createOperationalAlert(admin, {
      category: "pool_saturation",
      severity: "high",
      title: "Sender pool saturation",
      summary: poolSaturation.map((p) => p.label).join(", "),
      dedupeKey: `pool_saturation:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  if (deliverability.intelligence_summary.webhookOutageMailboxes > 0) {
    const created = await createOperationalAlert(admin, {
      category: "webhook_outage",
      severity: "medium",
      title: "Webhook silence detected",
      summary: `${deliverability.intelligence_summary.webhookOutageMailboxes} mailbox(es) without recent webhooks.`,
      dedupeKey: `webhook_outage:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  if (deliverability.intelligence_summary.degradedMailboxCount >= 3) {
    const created = await createOperationalAlert(admin, {
      category: "sender_degradation",
      severity: "high",
      title: "Multiple degraded mailboxes",
      summary: `${deliverability.intelligence_summary.degradedMailboxCount} mailboxes degraded.`,
      dedupeKey: `sender_degradation:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  const riskyPools = deliverability.domain_sender_mappings.filter((m) => m.concentrationRisk === "high")
  if (riskyPools.length >= 2) {
    const created = await createOperationalAlert(admin, {
      category: "infrastructure_imbalance",
      severity: "medium",
      title: "Infrastructure concentration imbalance",
      summary: `${riskyPools.length} domains with high sender concentration.`,
      dedupeKey: `infra_imbalance:${hourKey}`,
    })
    if (created) alertsCreated += 1
  }

  return { alertsCreated }
}

export async function listOperationalAlerts(admin: SupabaseClient, limit = 30): Promise<GrowthOperationalAlertRow[]> {
  const { data, error } = await alertsTable(admin)
    .select("id, alert_category, severity, title, summary, acknowledged, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    category: String(row.alert_category),
    severity: String(row.severity),
    title: String(row.title),
    summary: row.summary ? String(row.summary) : null,
    acknowledged: Boolean(row.acknowledged),
    createdAt: String(row.created_at),
  }))
}

export async function acknowledgeOperationalAlert(
  admin: SupabaseClient,
  input: { alertId: string; acknowledgedBy: string },
): Promise<void> {
  await alertsTable(admin)
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: input.acknowledgedBy,
    })
    .eq("id", input.alertId)
}
