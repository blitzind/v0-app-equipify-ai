import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthDomainOperationalStatus,
  GrowthDeliverabilityRiskLevel,
} from "@/lib/growth/deliverability/deliverability-intelligence-types"
import { deliverabilityScoreToRiskLevel } from "@/lib/growth/deliverability/deliverability-score"

export type DomainOperationalHealth = {
  domainId: string
  domain: string
  domainHealthScore: number
  domainRiskLevel: GrowthDeliverabilityRiskLevel
  operationalStatus: GrowthDomainOperationalStatus
  riskReasons: string[]
  remediationSuggestions: string[]
  signals: {
    dnsReadinessScore: number
    bounceRate: number
    complaintRate: number
    sendFailureRate: number
    suppressionVelocity24h: number
    inactiveMailboxRatio: number
  }
}

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function computeDomainOperationalHealth(
  admin: SupabaseClient,
  domainId: string,
): Promise<DomainOperationalHealth> {
  const { data: domainRow } = await admin.schema("growth").from("sender_domains").select("*").eq("id", domainId).maybeSingle()
  if (!domainRow) throw new Error("domain_not_found")

  const domain = String((domainRow as Record<string, unknown>).domain ?? "")
  const bounceRate = Number((domainRow as Record<string, unknown>).bounce_rate ?? 0)
  const spamRisk = Number((domainRow as Record<string, unknown>).spam_risk ?? 0)
  const dnsScore = Number((domainRow as Record<string, unknown>).domain_health_score ?? (domainRow as Record<string, unknown>).deliverability_score ?? 0)
  const verificationError = String((domainRow as Record<string, unknown>).verification_error ?? "")

  const { data: senders } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address, status, last_send_at, daily_send_used")
    .is("deleted_at", null)
    .ilike("email_address", `%@${domain}`)

  const senderIds = ((senders ?? []) as Array<{ id: string }>).map((s) => s.id)
  const inactiveMailboxRatio =
    senders && senders.length > 0
      ? senders.filter((s) => !s.last_send_at).length / senders.length
      : 0

  let complaintRate = 0
  let sendFailureRate = 0
  let suppressionVelocity24h = 0

  if (senderIds.length > 0) {
    const since24h = since24hIso()
    const [{ count: sentCount }, { count: failedCount }, { count: complaintCount }, { count: suppressionCount }] =
      await Promise.all([
        admin.schema("growth").from("delivery_attempts").select("id", { count: "exact", head: true }).in("sender_account_id", senderIds).gte("created_at", since24h).in("status", ["sent", "delivered"]),
        admin.schema("growth").from("delivery_attempts").select("id", { count: "exact", head: true }).in("sender_account_id", senderIds).gte("created_at", since24h).eq("status", "failed"),
        admin.schema("growth").from("email_complaints").select("id", { count: "exact", head: true }).in("sender_account_id", senderIds).gte("occurred_at", since24h),
        admin.schema("growth").from("suppression_entries").select("id", { count: "exact", head: true }).gte("suppressed_at", since24h),
      ])

    const sent = sentCount ?? 0
    const failed = failedCount ?? 0
    sendFailureRate = sent + failed > 0 ? Math.round((failed / (sent + failed)) * 1000) / 10 : 0
    complaintRate = sent > 0 ? Math.round(((complaintCount ?? 0) / sent) * 1000) / 10 : 0
    suppressionVelocity24h = suppressionCount ?? 0
  }

  const riskReasons: string[] = []
  const remediationSuggestions: string[] = []

  if (verificationError) {
    riskReasons.push(`DNS verification error: ${verificationError}`)
    remediationSuggestions.push("Re-run live DNS verification after fixing DNS records.")
  }
  if (!Boolean((domainRow as Record<string, unknown>).spf_valid)) {
    riskReasons.push("SPF not valid.")
    remediationSuggestions.push("Publish a valid SPF record for this domain.")
  }
  if (!Boolean((domainRow as Record<string, unknown>).dkim_valid)) {
    riskReasons.push("DKIM not valid.")
    remediationSuggestions.push("Configure DKIM with your mailbox provider selector.")
  }
  if (!Boolean((domainRow as Record<string, unknown>).dmarc_valid)) {
    riskReasons.push("DMARC not valid.")
    remediationSuggestions.push("Add DMARC policy at _dmarc subdomain.")
  }
  if (bounceRate >= 5) {
    riskReasons.push(`Elevated bounce rate (${bounceRate}%).`)
    remediationSuggestions.push("Pause high-risk senders and review list quality.")
  }
  if (complaintRate >= 0.3) {
    riskReasons.push(`Complaint rate elevated (${complaintRate}%).`)
    remediationSuggestions.push("Review recent campaigns and enforce suppression.")
  }
  if (sendFailureRate >= 10) {
    riskReasons.push(`Send failure rate ${sendFailureRate}%.`)
    remediationSuggestions.push("Inspect provider rejections and OAuth health.")
  }
  if (inactiveMailboxRatio >= 0.5 && (senders?.length ?? 0) > 1) {
    riskReasons.push("High inactive mailbox ratio on domain.")
  }
  if (spamRisk >= 50) {
    riskReasons.push("Spam risk flagged on domain record.")
  }

  let score = Math.round(dnsScore * 0.35 + (100 - Math.min(100, bounceRate * 8)) * 0.2 + (100 - Math.min(100, complaintRate * 20)) * 0.2 + (100 - sendFailureRate) * 0.15 + (100 - inactiveMailboxRatio * 100) * 0.1)
  score = Math.max(0, Math.min(100, score))

  let operationalStatus: GrowthDomainOperationalStatus = "healthy"
  if ((domainRow as Record<string, unknown>).operational_status === "paused") operationalStatus = "paused"
  else if (score < 30 || verificationError) operationalStatus = "critical"
  else if (score < 50 || bounceRate >= 8 || complaintRate >= 1) operationalStatus = "degraded"
  else if ((domainRow as Record<string, unknown>).status === "warning") operationalStatus = "warming"

  const domainRiskLevel = deliverabilityScoreToRiskLevel(score)

  return {
    domainId,
    domain,
    domainHealthScore: score,
    domainRiskLevel,
    operationalStatus,
    riskReasons,
    remediationSuggestions,
    signals: {
      dnsReadinessScore: dnsScore,
      bounceRate,
      complaintRate,
      sendFailureRate,
      suppressionVelocity24h,
      inactiveMailboxRatio: Math.round(inactiveMailboxRatio * 100) / 100,
    },
  }
}

export async function persistDomainHealthSnapshot(
  admin: SupabaseClient,
  health: DomainOperationalHealth,
): Promise<void> {
  const { error } = await admin.schema("growth").from("domain_health_snapshots").upsert(
    {
      domain_id: health.domainId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      domain_health_score: health.domainHealthScore,
      domain_risk_level: health.domainRiskLevel,
      operational_status: health.operationalStatus,
      bounce_rate: health.signals.bounceRate,
      complaint_rate: health.signals.complaintRate,
      send_failure_rate: health.signals.sendFailureRate,
      risk_reasons: health.riskReasons,
      metadata: health.signals,
    },
    { onConflict: "domain_id,snapshot_date" },
  )
  if (error) console.error("[domain-health-snapshot]", error.message)
}
