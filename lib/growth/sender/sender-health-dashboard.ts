import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listSenderHealthEvents } from "@/lib/growth/sender/sender-health-events"
import { listSenderAccounts, listSenderDomains } from "@/lib/growth/sender/sender-repository"
import {
  GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER,
  type GrowthSenderInfrastructureDashboard,
} from "@/lib/growth/sender/sender-types"

function startOf24HoursAgoIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export async function fetchSenderInfrastructureDashboard(
  admin: SupabaseClient,
): Promise<GrowthSenderInfrastructureDashboard> {
  const [accounts, domains, recentEvents] = await Promise.all([
    listSenderAccounts(admin),
    listSenderDomains(admin),
    listSenderHealthEvents(admin, { limit: 200 }),
  ])

  const connected_senders = accounts.filter((account) => account.status === "connected").length
  const healthy_senders = accounts.filter((account) => account.health_status === "healthy").length
  const warning_senders = accounts.filter(
    (account) => account.status === "warning" || account.health_status === "degraded",
  ).length
  const disabled_senders = accounts.filter(
    (account) => account.status === "disabled" || account.deleted_at != null,
  ).length
  const warming_senders = accounts.filter((account) => account.health_status === "warming").length
  const critical_domains = domains.filter(
    (domain) => domain.status === "invalid" || domain.deliverability_score < 40,
  ).length

  const average_sender_score =
    accounts.length > 0
      ? Math.round(accounts.reduce((sum, account) => sum + account.sender_score, 0) / accounts.length)
      : 0

  const since = startOf24HoursAgoIso()
  const health_events_24h = recentEvents.filter((event) => event.created_at >= since).length

  return {
    qa_marker: GROWTH_SENDER_INFRASTRUCTURE_QA_MARKER,
    connected_senders,
    healthy_senders,
    warning_senders,
    disabled_senders,
    healthy_senders_count: healthy_senders,
    warming_senders,
    critical_domains,
    average_sender_score,
    health_events_24h,
  }
}
