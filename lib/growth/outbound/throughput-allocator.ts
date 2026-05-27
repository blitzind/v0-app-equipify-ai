import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthThroughputSaturationLevel,
  GrowthThroughputUtilizationRow,
} from "@/lib/growth/outbound/reputation-safe-scaling-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { getSenderPool, listSenderPoolMembers } from "@/lib/growth/sender-pools/sender-pool-repository"

function saturationFromUtilization(pct: number): GrowthThroughputSaturationLevel {
  if (pct >= 95) return "critical"
  if (pct >= 80) return "elevated"
  if (pct >= 50) return "normal"
  return "low"
}

export async function canAllocateThroughputSend(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    domain?: string | null
    senderPoolId?: string | null
  },
): Promise<{
  allowed: boolean
  reason: string
  utilizationPct: number
  saturationLevel: GrowthThroughputSaturationLevel
  suggestDefer: boolean
  deferHours: number
}> {
  const sender = await getSenderAccount(admin, input.senderAccountId)
  if (!sender) {
    return { allowed: false, reason: "Sender not found.", utilizationPct: 100, saturationLevel: "critical", suggestDefer: false, deferHours: 0 }
  }

  const dailyLimit = Math.max(1, sender.daily_send_limit)
  const utilizationPct = Math.round((sender.daily_send_used / dailyLimit) * 100)
  const saturationLevel = saturationFromUtilization(utilizationPct)

  if (sender.daily_send_used >= sender.daily_send_limit) {
    return {
      allowed: false,
      reason: "Daily mailbox cap exhausted.",
      utilizationPct,
      saturationLevel: "critical",
      suggestDefer: true,
      deferHours: 12,
    }
  }

  if (input.domain) {
    const { data: domainRow } = await admin
      .schema("growth")
      .from("sender_domains")
      .select("id, domain_segment, operational_status")
      .eq("domain", input.domain.toLowerCase())
      .maybeSingle()

    if (domainRow) {
      const { count: domainSendsToday } = await admin
        .schema("growth")
        .from("delivery_attempts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date().toISOString().slice(0, 10))
        .in("status", ["sent", "delivered"])

      const segment = String((domainRow as Record<string, unknown>).domain_segment ?? "primary")
      const domainDailyCap =
        segment === "experimental" ? 25 : segment === "warming" ? 15 : segment === "secondary" ? 75 : 200

      if ((domainSendsToday ?? 0) >= domainDailyCap) {
        return {
          allowed: false,
          reason: `Domain daily throughput cap reached (${domainDailyCap}).`,
          utilizationPct: 100,
          saturationLevel: "critical",
          suggestDefer: true,
          deferHours: 6,
        }
      }
    }
  }

  if (input.senderPoolId) {
    const pool = await getSenderPool(admin, input.senderPoolId)
    const members = await listSenderPoolMembers(admin, input.senderPoolId)
    const totalCap = members.reduce((sum, m) => sum + 1, 0) * 50
    const poolUsed = members.length * 10
    const poolUtil = totalCap > 0 ? Math.round((poolUsed / totalCap) * 100) : 0
    if (pool && pool.status === "paused") {
      return {
        allowed: false,
        reason: "Sender pool paused.",
        utilizationPct: poolUtil,
        saturationLevel: "critical",
        suggestDefer: false,
        deferHours: 0,
      }
    }
  }

  if (saturationLevel === "critical") {
    return {
      allowed: false,
      reason: "Mailbox utilization critical.",
      utilizationPct,
      saturationLevel,
      suggestDefer: true,
      deferHours: 4,
    }
  }

  return {
    allowed: true,
    reason: "Throughput allocation available.",
    utilizationPct,
    saturationLevel,
    suggestDefer: false,
    deferHours: 0,
  }
}

export async function computeThroughputUtilization(
  admin: SupabaseClient,
): Promise<GrowthThroughputUtilizationRow[]> {
  const rows: GrowthThroughputUtilizationRow[] = []

  const { data: senders } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address, daily_send_limit, daily_send_used")
    .is("deleted_at", null)

  for (const sender of senders ?? []) {
    const limit = Number((sender as Record<string, unknown>).daily_send_limit ?? 0)
    const used = Number((sender as Record<string, unknown>).daily_send_used ?? 0)
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
    rows.push({
      entityType: "mailbox",
      entityId: String((sender as Record<string, unknown>).id),
      label: String((sender as Record<string, unknown>).email_address),
      dailyLimit: limit,
      dailyUsed: used,
      utilizationPct: pct,
      saturationLevel: saturationFromUtilization(pct),
      queueCongestion: 0,
    })
  }

  const { data: domains } = await admin.schema("growth").from("sender_domains").select("id, domain, domain_segment")
  for (const domain of domains ?? []) {
    const domainName = String((domain as Record<string, unknown>).domain)
    const segment = String((domain as Record<string, unknown>).domain_segment ?? "primary")
    const cap = segment === "experimental" ? 25 : segment === "warming" ? 15 : segment === "secondary" ? 75 : 200
    const { count } = await admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date().toISOString().slice(0, 10))
    const used = count ?? 0
    const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
    rows.push({
      entityType: "domain",
      entityId: String((domain as Record<string, unknown>).id),
      label: domainName,
      dailyLimit: cap,
      dailyUsed: used,
      utilizationPct: pct,
      saturationLevel: saturationFromUtilization(pct),
      queueCongestion: 0,
    })
  }

  const { data: pools } = await admin.schema("growth").from("sender_pools").select("id, name, status")
  for (const pool of pools ?? []) {
    const members = await listSenderPoolMembers(admin, String((pool as Record<string, unknown>).id))
    const active = members.filter((m) => m.memberStatus === "eligible").length
    const pct = members.length > 0 ? Math.round((active / members.length) * 100) : 0
    rows.push({
      entityType: "pool",
      entityId: String((pool as Record<string, unknown>).id),
      label: String((pool as Record<string, unknown>).name),
      dailyLimit: members.length * 50,
      dailyUsed: (members.length - active) * 50,
      utilizationPct: 100 - pct,
      saturationLevel: String((pool as Record<string, unknown>).status) !== "active" ? "critical" : saturationFromUtilization(100 - pct),
      queueCongestion: members.filter((m) => m.memberStatus === "paused").length,
    })
  }

  return rows
}

export async function persistThroughputSnapshots(admin: SupabaseClient, rows: GrowthThroughputUtilizationRow[]): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  for (const row of rows) {
    await admin.schema("growth").from("throughput_snapshots").upsert(
      {
        snapshot_date: snapshotDate,
        entity_type: row.entityType,
        entity_id: row.entityId,
        entity_label: row.label,
        daily_limit: row.dailyLimit,
        daily_used: row.dailyUsed,
        utilization_pct: row.utilizationPct,
        queue_congestion: row.queueCongestion,
        saturation_level: row.saturationLevel,
      },
      { onConflict: "snapshot_date,entity_type,entity_id" },
    )
  }
}
