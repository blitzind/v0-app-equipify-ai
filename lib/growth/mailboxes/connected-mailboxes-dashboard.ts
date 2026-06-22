import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import {
  GROWTH_CONNECTED_MAILBOXES_QA_MARKER,
  type GrowthConnectedMailboxRow,
  type GrowthConnectedMailboxesDashboardPayload,
  type GrowthConnectedMailboxesSummary,
} from "@/lib/growth/mailboxes/connected-mailboxes-dashboard-types"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { extractDomainFromEmail } from "@/lib/growth/sender/sender-domain-validator"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { listWarmupProfiles } from "@/lib/growth/warmup/warmup-repository"
import { listSenderProfiles } from "@/lib/growth/signatures/sender-profile-repository"

function isDisconnectedMailbox(status: string | null | undefined): boolean {
  return !status || status === "pending" || status === "connecting" || status === "error" || status === "expired"
}

function isHealthyRow(row: GrowthConnectedMailboxRow): boolean {
  return row.connectionStatus === "connected" && (row.healthTier === "healthy" || row.healthScore >= 80)
}

function isWarmingRow(row: GrowthConnectedMailboxRow): boolean {
  if (row.warmupStatus === "warming" || row.warmupStatus === "new") return true
  return row.senderStatus === "connected" && row.warmupStatus != null && row.warmupStatus !== "active"
}

function isPausedRow(row: GrowthConnectedMailboxRow): boolean {
  return (
    row.senderStatus === "disabled" ||
    row.operationalPaused ||
    row.warmupStatus === "paused" ||
    row.warmupStatus === "disabled" ||
    row.warmupStatus === "throttled"
  )
}

function buildSummary(rows: GrowthConnectedMailboxRow[]): GrowthConnectedMailboxesSummary {
  let connectedMailboxes = 0
  let disconnectedMailboxes = 0
  let warmingMailboxes = 0
  let healthyMailboxes = 0
  let pausedMailboxes = 0
  let dailyCapacity = 0
  let dailyUsed = 0

  for (const row of rows) {
    dailyCapacity += row.dailyCap
    dailyUsed += row.dailyUsed
    if (row.connectionStatus === "connected") connectedMailboxes += 1
    else disconnectedMailboxes += 1
    if (isWarmingRow(row)) warmingMailboxes += 1
    if (isHealthyRow(row)) healthyMailboxes += 1
    if (isPausedRow(row)) pausedMailboxes += 1
  }

  return {
    connectedMailboxes,
    disconnectedMailboxes,
    warmingMailboxes,
    healthyMailboxes,
    pausedMailboxes,
    dailyCapacity,
    dailyUsed,
  }
}

export async function buildConnectedMailboxesDashboard(
  admin: SupabaseClient,
): Promise<GrowthConnectedMailboxesDashboardPayload> {
  const [senders, mailboxes, pools, warmupProfiles, routes, senderProfiles] = await Promise.all([
    listSenderAccounts(admin),
    listMailboxConnections(admin),
    listSenderPools(admin),
    listWarmupProfiles(admin).catch(() => []),
    listDeliveryRoutes(admin),
    listSenderProfiles(admin).catch(() => []),
  ])

  const membersNested = await Promise.all(pools.map((pool) => listSenderPoolMembers(admin, pool.id)))
  const membershipsBySender = new Map<string, GrowthConnectedMailboxRow["poolMemberships"]>()
  for (let index = 0; index < pools.length; index += 1) {
    const pool = pools[index]
    const members = membersNested[index] ?? []
    for (const member of members) {
      const list = membershipsBySender.get(member.senderAccountId) ?? []
      list.push({
        poolId: pool.id,
        poolName: pool.name,
        memberId: member.id,
        memberStatus: member.memberStatus,
        poolStatus: pool.status,
      })
      membershipsBySender.set(member.senderAccountId, list)
    }
  }

  const mailboxBySender = new Map(
    mailboxes.map((mailbox) => [mailbox.sender_account_id, mailbox]),
  )
  const warmupBySender = new Map(warmupProfiles.map((profile) => [profile.sender_account_id, profile]))
  const routesBySender = new Map<string, boolean>()
  for (const route of routes) {
    if (route.sender_account_id && route.enabled) {
      routesBySender.set(route.sender_account_id, true)
    }
  }

  const activeProfileBySender = new Map<string, { active: boolean; mailbox_connection_id: string | null }>()
  const activeProfileByMailbox = new Map<string, boolean>()
  for (const profile of senderProfiles) {
    if (!profile.active) continue
    activeProfileBySender.set(profile.sender_account_id, {
      active: true,
      mailbox_connection_id: profile.mailbox_connection_id,
    })
    if (profile.mailbox_connection_id) {
      activeProfileByMailbox.set(profile.mailbox_connection_id, true)
    }
  }

  function resolveMailboxSignatureStatus(
    senderId: string,
    mailboxId: string | null,
  ): GrowthConnectedMailboxRow["signatureStatus"] {
    const senderProfile = activeProfileBySender.get(senderId)
    if (senderProfile?.active) {
      return senderProfile.mailbox_connection_id ? "inherited" : "configured"
    }
    if (mailboxId && activeProfileByMailbox.has(mailboxId)) return "inherited"
    return "missing"
  }

  const rows: GrowthConnectedMailboxRow[] = senders.map((sender) => {
    const mailbox = mailboxBySender.get(sender.id)
    const warmup = warmupBySender.get(sender.id)
    const domainName = extractDomainFromEmail(sender.email_address)
    const poolMemberships = membershipsBySender.get(sender.id) ?? []
    const operationalPaused = poolMemberships.some(
      (entry) => entry.memberStatus === "paused" || entry.memberStatus === "blocked",
    )

    const connectionStatus = mailbox?.status ?? "no_mailbox"
    const needsReconnect =
      sender.provider_family === "google" &&
      (!mailbox ||
        !mailbox.token_configured ||
        isDisconnectedMailbox(mailbox.status) ||
        mailbox.status === "warning")

    return {
      senderId: sender.id,
      senderDisplayName: sender.display_name,
      email: sender.email_address,
      domain: domainName,
      connectionStatus,
      healthTier: mailbox?.health_tier ?? sender.health_status,
      healthScore: mailbox?.connection_health ?? sender.sender_score,
      warmupStatus: warmup?.status ?? (sender.warmup_enabled ? "warming" : null),
      warmupProfileId: warmup?.id ?? null,
      poolMemberships,
      dailyCap: sender.daily_send_limit,
      dailyUsed: sender.daily_send_used,
      lastValidationAt: mailbox?.last_validation_at ?? null,
      mailboxId: mailbox?.id ?? null,
      mailboxTokenConfigured: mailbox?.token_configured ?? false,
      senderStatus: sender.status,
      deliveryRouteEnabled: routesBySender.get(sender.id) ?? false,
      providerFamily: sender.provider_family,
      needsReconnect,
      operationalPaused,
      signatureStatus: resolveMailboxSignatureStatus(sender.id, mailbox?.id ?? null),
    }
  })

  // Sort: disconnected first, then email
  rows.sort((a, b) => {
    const aDisconnected = a.connectionStatus !== "connected"
    const bDisconnected = b.connectionStatus !== "connected"
    if (aDisconnected !== bDisconnected) return aDisconnected ? -1 : 1
    return a.email.localeCompare(b.email)
  })

  const uniqueDomains = [...new Set(rows.map((row) => row.domain).filter(Boolean))].sort()
  const poolOptions = pools.map((pool) => ({ id: pool.id, name: pool.name }))

  return {
    qa_marker: GROWTH_CONNECTED_MAILBOXES_QA_MARKER,
    summary: buildSummary(rows),
    rows,
    domains: uniqueDomains,
    pools: poolOptions,
  }
}
