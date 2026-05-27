import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import {
  computeSenderFatigueScore,
  computeSenderHealthScore,
} from "@/lib/growth/sender-pools/sender-operational-pause"

export type MailboxOperationalHealth = {
  senderAccountId: string
  mailboxConnectionId: string | null
  emailAddress: string
  trustScore: number
  fatigueScore: number
  operationalStatus: "healthy" | "degraded" | "critical" | "paused"
  riskReasons: string[]
  cooldownRecommendation: string | null
  signals: {
    oauthFailures: number
    tokenRefreshFailures: number
    providerRejections24h: number
    bounces24h: number
    complaints24h: number
    sendFailures24h: number
    webhookSilenceHours: number | null
    dailyCapUtilization: number
  }
}

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function computeMailboxOperationalHealth(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<MailboxOperationalHealth | null> {
  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender || sender.deleted_at) return null

  const mailbox = await getMailboxConnectionBySender(admin, senderAccountId).catch(() => null)
  const since24h = since24hIso()

  const [{ count: failedSends }, { count: bounces }, { count: complaints }] = await Promise.all([
    admin.schema("growth").from("delivery_attempts").select("id", { count: "exact", head: true }).eq("sender_account_id", senderAccountId).eq("status", "failed").gte("created_at", since24h),
    admin.schema("growth").from("email_bounces").select("id", { count: "exact", head: true }).eq("sender_account_id", senderAccountId).gte("occurred_at", since24h),
    admin.schema("growth").from("email_complaints").select("id", { count: "exact", head: true }).eq("sender_account_id", senderAccountId).gte("occurred_at", since24h),
  ])

  const { data: auditEvents } = await admin
    .schema("growth")
    .from("internal_outbound_audit_events")
    .select("event_type")
    .eq("sender_account_id", senderAccountId)
    .gte("created_at", since24h)

  const oauthFailures = (auditEvents ?? []).filter((e) => e.event_type === "oauth_failure").length
  const tokenRefreshFailures = (auditEvents ?? []).filter((e) => e.event_type === "token_refresh_failure").length

  const { data: lastWebhook } = await admin
    .schema("growth")
    .from("provider_delivery_events")
    .select("occurred_at")
    .eq("sender_account_id", senderAccountId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let webhookSilenceHours: number | null = null
  if (lastWebhook?.occurred_at) {
    webhookSilenceHours = Math.round((Date.now() - Date.parse(String(lastWebhook.occurred_at))) / 3600000)
  } else if (sender.last_send_at) {
    webhookSilenceHours = Math.round((Date.now() - Date.parse(sender.last_send_at)) / 3600000)
  }

  const dailyCapUtilization =
    sender.daily_send_limit > 0 ? Math.round((sender.daily_send_used / sender.daily_send_limit) * 100) : 0

  const bounceRate = sender.daily_send_used > 0 ? ((bounces ?? 0) / sender.daily_send_used) * 100 : 0
  const fatigueScore = computeSenderFatigueScore({
    recentVolume: sender.daily_send_used,
    bounceRisk: bounceRate,
    complaintRisk: (complaints ?? 0) * 10,
    warmupProgress: sender.warmup_enabled ? 50 : 100,
    warmupEnabled: sender.warmup_enabled,
  })

  const trustScore = computeSenderHealthScore({
    healthScore: sender.sender_score,
    bounceRisk: bounceRate,
    complaintRisk: (complaints ?? 0) * 10,
    memberStatus: sender.health_status === "critical" ? "paused" : "eligible",
    dailyCapRemaining: Math.max(0, sender.daily_send_limit - sender.daily_send_used),
  })

  const riskReasons: string[] = []
  if (mailbox && !["connected", "healthy", "warning"].includes(mailbox.status)) {
    riskReasons.push(`Mailbox status: ${mailbox.status}`)
  }
  if (oauthFailures > 0) riskReasons.push(`${oauthFailures} OAuth failure(s) in 24h.`)
  if (tokenRefreshFailures > 0) riskReasons.push(`${tokenRefreshFailures} token refresh failure(s) in 24h.`)
  if ((failedSends ?? 0) >= 3) riskReasons.push(`${failedSends} send failures in 24h.`)
  if ((bounces ?? 0) >= 2) riskReasons.push(`${bounces} bounces in 24h.`)
  if ((complaints ?? 0) >= 1) riskReasons.push(`${complaints} complaint(s) in 24h.`)
  if (webhookSilenceHours != null && webhookSilenceHours >= 48 && sender.last_send_at) {
    riskReasons.push(`Webhook silence ~${webhookSilenceHours}h after recent sends.`)
  }

  let operationalStatus: MailboxOperationalHealth["operationalStatus"] = "healthy"
  if (sender.status === "disabled" || mailbox?.status === "disabled") operationalStatus = "paused"
  else if (trustScore < 30 || oauthFailures >= 2) operationalStatus = "critical"
  else if (trustScore < 55 || riskReasons.length >= 2) operationalStatus = "degraded"

  const cooldownRecommendation =
    fatigueScore >= 70 ? "Recommend cooldown — fatigue score elevated." : dailyCapUtilization >= 95 ? "Daily cap nearly exhausted." : null

  return {
    senderAccountId,
    mailboxConnectionId: mailbox?.id ?? null,
    emailAddress: sender.email_address,
    trustScore,
    fatigueScore,
    operationalStatus,
    riskReasons,
    cooldownRecommendation,
    signals: {
      oauthFailures,
      tokenRefreshFailures,
      providerRejections24h: failedSends ?? 0,
      bounces24h: bounces ?? 0,
      complaints24h: complaints ?? 0,
      sendFailures24h: failedSends ?? 0,
      webhookSilenceHours,
      dailyCapUtilization,
    },
  }
}

export async function persistMailboxHealthSnapshot(
  admin: SupabaseClient,
  health: MailboxOperationalHealth,
): Promise<void> {
  const { error } = await admin.schema("growth").from("mailbox_health_snapshots").upsert(
    {
      sender_account_id: health.senderAccountId,
      mailbox_connection_id: health.mailboxConnectionId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      trust_score: health.trustScore,
      fatigue_score: health.fatigueScore,
      operational_status: health.operationalStatus,
      risk_reasons: health.riskReasons,
      metadata: health.signals,
    },
    { onConflict: "sender_account_id,snapshot_date" },
  )
  if (error) console.error("[mailbox-health-snapshot]", error.message)
}
