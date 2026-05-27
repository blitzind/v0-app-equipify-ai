import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthInboxLifecycleRow,
  GrowthInboxLifecycleStage,
} from "@/lib/growth/outbound/lifecycle-ops-types"
import { computeMailboxOperationalHealth } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import { listSenderAccounts, listSenderDomains } from "@/lib/growth/sender/sender-repository"

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.round((Date.now() - Date.parse(iso)) / 86400000)
}

export function computeDeterministicLifecycleStage(input: {
  senderStatus: string
  warmupEnabled: boolean
  trustScore: number
  fatigueScore: number
  operationalStatus: string
  inactivityDays: number | null
  complaintCount30d: number
  overrideStage?: GrowthInboxLifecycleStage | null
  overrideEnabled?: boolean
}): GrowthInboxLifecycleStage {
  if (input.overrideEnabled && input.overrideStage) return input.overrideStage
  if (input.senderStatus === "disabled") return "retired"
  if (input.operationalStatus === "paused" || input.senderStatus === "error") return "paused"
  if (input.complaintCount30d >= 2 || input.trustScore < 30) return "elevated_risk"
  if (input.fatigueScore >= 65) return "cooling_down"
  if (input.warmupEnabled) return "warming"
  if (input.inactivityDays != null && input.inactivityDays >= 21) return "cooling_down"
  if (input.trustScore >= 55 && input.fatigueScore < 50) return "active"
  if (input.senderStatus === "pending" || input.senderStatus === "connecting") return "provisioning"
  return "active"
}

export async function computeInboxLifecycleRow(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<GrowthInboxLifecycleRow | null> {
  const senders = await listSenderAccounts(admin)
  const sender = senders.find((s) => s.id === senderAccountId)
  if (!sender || sender.deleted_at) return null

  const mailboxes = await listMailboxConnections(admin)
  const mailbox = mailboxes.find((m) => m.sender_account_id === senderAccountId) ?? null
  const health = await computeMailboxOperationalHealth(admin, senderAccountId)
  const domain = sender.email_address.split("@")[1]?.toLowerCase() ?? ""

  const domains = await listSenderDomains(admin)
  const domainRow = domains.find((d) => d.domain === domain)

  const since30d = new Date(Date.now() - 30 * 86400000).toISOString()
  const [{ count: pauseCount }, { count: complaintCount }] = await Promise.all([
    admin
      .schema("growth")
      .from("internal_outbound_audit_events")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .eq("event_type", "sender_operational_pause")
      .gte("created_at", since30d),
    admin
      .schema("growth")
      .from("email_complaints")
      .select("id", { count: "exact", head: true })
      .eq("sender_account_id", senderAccountId)
      .gte("occurred_at", since30d),
  ])

  const lifecycleStage = computeDeterministicLifecycleStage({
    senderStatus: sender.status,
    warmupEnabled: sender.warmup_enabled,
    trustScore: health?.trustScore ?? sender.sender_score,
    fatigueScore: health?.fatigueScore ?? 0,
    operationalStatus: health?.operationalStatus ?? "healthy",
    inactivityDays: daysSince(sender.last_send_at),
    complaintCount30d: complaintCount ?? 0,
    overrideStage: (sender as Record<string, unknown>).lifecycle_stage as GrowthInboxLifecycleStage | undefined,
    overrideEnabled: Boolean((sender as Record<string, unknown>).lifecycle_stage_override),
  })

  const recommendations: string[] = []
  if (lifecycleStage === "elevated_risk") recommendations.push("Review send volume and pause if complaints continue.")
  if (lifecycleStage === "cooling_down") recommendations.push("Recommend cooldown — reduce cadence before next campaign.")
  if (daysSince(sender.last_send_at) != null && daysSince(sender.last_send_at)! >= 30) {
    recommendations.push("Inactivity ≥30d — verify OAuth and mailbox connectivity.")
  }

  const retirementCandidate =
    lifecycleStage === "retired" ||
    (lifecycleStage === "paused" && (pauseCount ?? 0) >= 3) ||
    ((complaintCount ?? 0) >= 3 && (health?.trustScore ?? 100) < 40)

  if (retirementCandidate) {
    recommendations.push("Retirement candidate — operator review recommended (no auto-retire).")
  }

  return {
    senderAccountId: sender.id,
    mailboxConnectionId: mailbox?.id ?? null,
    emailAddress: sender.email_address,
    domain,
    lifecycleStage,
    lifecycleStageOverride: Boolean((sender as Record<string, unknown>).lifecycle_stage_override),
    inboxAgeDays: daysSince(String((sender as Record<string, unknown>).provisioned_at ?? sender.created_at)),
    domainAgeNote: domainRow?.domain_age_note ?? null,
    lastSendAt: sender.last_send_at,
    inactivityDays: daysSince(sender.last_send_at),
    fatigueScore: health?.fatigueScore ?? 0,
    trustScore: health?.trustScore ?? sender.sender_score,
    pauseCount30d: pauseCount ?? 0,
    complaintCount30d: complaintCount ?? 0,
    recommendations,
    retirementCandidate,
  }
}

export async function listInboxLifecycleRows(admin: SupabaseClient): Promise<GrowthInboxLifecycleRow[]> {
  const senders = await listSenderAccounts(admin)
  const rows = await Promise.all(senders.map((s) => computeInboxLifecycleRow(admin, s.id)))
  return rows.filter(Boolean) as GrowthInboxLifecycleRow[]
}

export async function recordLifecycleTransition(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    mailboxConnectionId?: string | null
    fromStage: GrowthInboxLifecycleStage | null
    toStage: GrowthInboxLifecycleStage
    reason: string
    operatorOverride?: boolean
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  await admin.schema("growth").from("inbox_lifecycle_events").insert({
    sender_account_id: input.senderAccountId,
    mailbox_connection_id: input.mailboxConnectionId ?? null,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    transition_reason: input.reason,
    operator_override: Boolean(input.operatorOverride),
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "domain_risk_alert",
    severity: input.toStage === "elevated_risk" ? "high" : "medium",
    title: `Lifecycle transition: ${input.fromStage ?? "?"} → ${input.toStage}`,
    summary: input.reason,
    senderAccountId: input.senderAccountId,
    mailboxConnectionId: input.mailboxConnectionId ?? null,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    metadata: { lifecycle_transition: true, operator_override: input.operatorOverride ?? false },
  }).catch(() => undefined)
}

export async function persistComputedLifecycleStages(admin: SupabaseClient): Promise<number> {
  const rows = await listInboxLifecycleRows(admin)
  let updated = 0
  for (const row of rows) {
    if (row.lifecycleStageOverride) continue
    const { error } = await admin
      .schema("growth")
      .from("sender_accounts")
      .update({ lifecycle_stage: row.lifecycleStage, updated_at: new Date().toISOString() })
      .eq("id", row.senderAccountId)
    if (!error) updated += 1
  }
  return updated
}

export async function listLifecycleTimeline(
  admin: SupabaseClient,
  limit = 30,
): Promise<Array<{ id: string; title: string; summary: string; occurredAt: string }>> {
  const { data, error } = await admin
    .schema("growth")
    .from("inbox_lifecycle_events")
    .select("id, from_stage, to_stage, transition_reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    title: `Lifecycle: ${row.from_stage ?? "?"} → ${row.to_stage}`,
    summary: String(row.transition_reason),
    occurredAt: String(row.created_at),
  }))
}
