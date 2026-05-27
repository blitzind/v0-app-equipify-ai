import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthInfrastructureInventorySummary } from "@/lib/growth/outbound/lifecycle-ops-types"
import { listInboxLifecycleRows } from "@/lib/growth/outbound/inbox-lifecycle-engine"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import { listSenderAccounts, listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { listProviderConnectionSettingsRows } from "@/lib/growth/provider-setup/dashboard"

export type InfrastructureInventoryRow = {
  entityType: "domain" | "mailbox" | "pool" | "oauth"
  id: string
  label: string
  status: string
  segment: string | null
  tag: string | null
  owner: string | null
  capacityUsed: number
  capacityLimit: number
}

export async function fetchInfrastructureInventorySummary(
  admin: SupabaseClient,
): Promise<GrowthInfrastructureInventorySummary> {
  const [senders, lifecycleRows] = await Promise.all([listSenderAccounts(admin), listInboxLifecycleRows(admin)])

  const activeSenders = lifecycleRows.filter((r) => r.lifecycleStage === "active").length
  const pausedSenders = lifecycleRows.filter((r) => r.lifecycleStage === "paused").length
  const retiredSenders = lifecycleRows.filter((r) => r.lifecycleStage === "retired").length
  const warmingSenders = lifecycleRows.filter((r) => r.lifecycleStage === "warming").length

  const availableDailyCapacity = senders.reduce((sum, s) => sum + Math.max(0, s.daily_send_limit - s.daily_send_used), 0)
  const usedDailyCapacity = senders.reduce((sum, s) => sum + s.daily_send_used, 0)

  const mailboxes = await listMailboxConnections(admin)
  const domains = await listSenderDomains(admin)

  return {
    totalDomains: domains.length,
    totalMailboxes: mailboxes.length,
    activeSenders,
    pausedSenders,
    retiredSenders,
    warmingSenders,
    availableDailyCapacity,
    usedDailyCapacity,
  }
}

export async function fetchInfrastructureInventoryRows(admin: SupabaseClient): Promise<InfrastructureInventoryRow[]> {
  const rows: InfrastructureInventoryRow[] = []
  const [domains, mailboxes, pools, providerSetup] = await Promise.all([
    listSenderDomains(admin),
    listMailboxConnections(admin),
    listSenderPools(admin),
    listProviderConnectionSettingsRows(admin).catch(() => []),
  ])

  for (const domain of domains) {
    rows.push({
      entityType: "domain",
      id: domain.id,
      label: domain.domain,
      status: domain.operational_status,
      segment: domain.domain_segment,
      tag: null,
      owner: null,
      capacityUsed: 0,
      capacityLimit: 0,
    })
  }

  for (const mailbox of mailboxes) {
    rows.push({
      entityType: "mailbox",
      id: mailbox.id,
      label: mailbox.email_address,
      status: mailbox.status,
      segment: null,
      tag: null,
      owner: null,
      capacityUsed: 0,
      capacityLimit: 0,
    })
  }

  for (const pool of pools) {
    const members = await listSenderPoolMembers(admin, pool.id)
    rows.push({
      entityType: "pool",
      id: pool.id,
      label: pool.name,
      status: pool.status,
      segment: null,
      tag: null,
      owner: null,
      capacityUsed: members.filter((m) => m.memberStatus !== "eligible").length,
      capacityLimit: members.length,
    })
  }

  rows.push({
    entityType: "oauth",
    id: "google",
    label: "Google Workspace OAuth",
    status: googleProviderOAuthConfigured() ? "connected" : "disconnected",
    segment: null,
    tag: null,
    owner: null,
    capacityUsed: providerSetup.filter((p) => p.provider_family === "google" && p.status === "connected").length,
    capacityLimit: providerSetup.filter((p) => p.provider_family === "google").length,
  })

  return rows
}
