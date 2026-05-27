import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER,
  type GrowthDomainReadinessCard,
  type GrowthDeliverabilityTimelineEntry,
} from "@/lib/growth/deliverability/deliverability-intelligence-types"
import { buildDomainSenderMappings } from "@/lib/growth/deliverability/domain-sender-mapping"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { computeMailboxOperationalHealth } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { listDeliveryTimelineEvents } from "@/lib/growth/deliverability/delivery-event-timeline"
import { isLiveDnsVerificationEnabled } from "@/lib/growth/deliverability/live-dns-verifier"
import { listRecentProtectionEvents } from "@/lib/growth/deliverability/protection-rules"
import { computeDomainReadiness } from "@/lib/growth/infrastructure/domain-readiness"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"

export type GrowthDeliverabilityIntelligenceDashboard = {
  qa_marker: typeof GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER
  live_dns_enabled: boolean
  intelligence_summary: {
    unhealthyDomainCount: number
    degradedMailboxCount: number
    dnsFailureCount: number
    pausedSenderCount: number
    riskyPoolCount: number
    bounceSpikeDomains: number
    complaintSpikeDomains: number
    webhookOutageMailboxes: number
    providerRejectionSenders: number
  }
  domain_readiness_cards: GrowthDomainReadinessCard[]
  timeline_feed: GrowthDeliverabilityTimelineEntry[]
  domain_sender_mappings: Awaited<ReturnType<typeof buildDomainSenderMappings>>
  protection_events: Awaited<ReturnType<typeof listRecentProtectionEvents>>
  trend_snapshots: {
    domain_health: Array<{ date: string; score: number; domain: string }>
    mailbox_trust: Array<{ date: string; score: number; email: string }>
  }
}

function verificationLabel(source: string, manualOverride: boolean, liveEnabled: boolean): string {
  if (manualOverride) return "MANUAL OVERRIDE"
  if (source === "live" && liveEnabled) return "LIVE VERIFIED"
  if (source === "stub") return "STUB / STORED FLAGS ONLY"
  return "MANUAL VERIFICATION REQUIRED"
}

export async function fetchDeliverabilityIntelligenceDashboard(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityIntelligenceDashboard> {
  const liveEnabled = isLiveDnsVerificationEnabled()
  const [domains, mailboxes, pools, timeline, protectionEvents, mappings] = await Promise.all([
    listSenderDomains(admin),
    listMailboxConnections(admin),
    listSenderPools(admin),
    listDeliveryTimelineEvents(admin, 40),
    listRecentProtectionEvents(admin, 15),
    buildDomainSenderMappings(admin),
  ])

  const domainHealthRows = await Promise.all(domains.map((d) => computeDomainOperationalHealth(admin, d.id)))
  const mailboxHealthRows = (
    await Promise.all(mailboxes.map((m) => computeMailboxOperationalHealth(admin, m.sender_account_id)))
  ).filter(Boolean)

  const poolMembersNested = await Promise.all(pools.map((pool) => listSenderPoolMembers(admin, pool.id)))
  let pausedSenderCount = 0
  for (const members of poolMembersNested) {
    pausedSenderCount += members.filter((m) => m.memberStatus === "paused" || m.memberStatus === "blocked").length
  }

  const domainReadinessCards: GrowthDomainReadinessCard[] = domains.map((domain) => {
    const readiness = computeDomainReadiness(domain)
    const health = domainHealthRows.find((h) => h.domainId === domain.id)
    const source = domain.verification_source ?? "stub"
    return {
      domainId: domain.id,
      domain: domain.domain,
      verificationSource: source,
      verificationLabel: verificationLabel(source, domain.manual_override, liveEnabled),
      lastVerifiedAt: domain.last_verified_at,
      verificationError: domain.verification_error,
      manualOverride: domain.manual_override,
      spfStatus: readiness.spfStatus,
      dkimStatus: readiness.dkimStatus,
      dmarcStatus: readiness.dmarcStatus,
      mxStatus: readiness.mxStatus,
      trackingDomainReady: readiness.trackingDomainReady,
      readinessScore: readiness.readinessScore,
      domainHealthScore: health?.domainHealthScore ?? domain.domain_health_score ?? domain.deliverability_score,
      domainRiskLevel: health?.domainRiskLevel ?? domain.domain_risk_level ?? "medium",
      operationalStatus: health?.operationalStatus ?? domain.operational_status ?? "healthy",
      riskReasons: health?.riskReasons ?? readiness.reputationWarnings,
      recommendations: health?.remediationSuggestions ?? [],
    }
  })

  const { data: domainTrendRows } = await admin
    .schema("growth")
    .from("domain_health_snapshots")
    .select("snapshot_date, domain_health_score, domain_id")
    .order("snapshot_date", { ascending: false })
    .limit(60)

  const { data: mailboxTrendRows } = await admin
    .schema("growth")
    .from("mailbox_health_snapshots")
    .select("snapshot_date, trust_score, sender_account_id")
    .order("snapshot_date", { ascending: false })
    .limit(60)

  const domainNameById = new Map(domains.map((d) => [d.id, d.domain]))
  const senderEmailById = new Map(mailboxes.map((m) => [m.sender_account_id, m.email_address]))

  return {
    qa_marker: GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER,
    live_dns_enabled: liveEnabled,
    intelligence_summary: {
      unhealthyDomainCount: domainHealthRows.filter((h) => h.operationalStatus === "critical" || h.operationalStatus === "degraded").length,
      degradedMailboxCount: mailboxHealthRows.filter((h) => h!.operationalStatus !== "healthy").length,
      dnsFailureCount: domainReadinessCards.filter((c) => Boolean(c.verificationError)).length,
      pausedSenderCount,
      riskyPoolCount: mappings.filter((m) => m.concentrationRisk === "high").length,
      bounceSpikeDomains: domainHealthRows.filter((h) => h.signals.bounceRate >= 5).length,
      complaintSpikeDomains: domainHealthRows.filter((h) => h.signals.complaintRate >= 0.3).length,
      webhookOutageMailboxes: mailboxHealthRows.filter(
        (h) => h!.signals.webhookSilenceHours != null && h!.signals.webhookSilenceHours >= 48,
      ).length,
      providerRejectionSenders: mailboxHealthRows.filter((h) => h!.signals.providerRejections24h >= 3).length,
    },
    domain_readiness_cards: domainReadinessCards,
    timeline_feed: timeline,
    domain_sender_mappings: mappings,
    protection_events: protectionEvents,
    trend_snapshots: {
      domain_health: ((domainTrendRows ?? []) as Array<{ snapshot_date: string; domain_health_score: number; domain_id: string }>).map(
        (row) => ({
          date: row.snapshot_date,
          score: row.domain_health_score,
          domain: domainNameById.get(row.domain_id) ?? row.domain_id,
        }),
      ),
      mailbox_trust: ((mailboxTrendRows ?? []) as Array<{ snapshot_date: string; trust_score: number; sender_account_id: string }>).map(
        (row) => ({
          date: row.snapshot_date,
          score: row.trust_score,
          email: senderEmailById.get(row.sender_account_id) ?? row.sender_account_id,
        }),
      ),
    },
  }
}
