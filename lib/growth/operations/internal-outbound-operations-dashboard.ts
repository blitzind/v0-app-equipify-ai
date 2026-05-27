import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthInfrastructureReadinessCatalog } from "@/lib/growth/infrastructure/infrastructure-readiness"
import { computeDomainReadiness } from "@/lib/growth/infrastructure/domain-readiness"
import { listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import { googleProviderOAuthConfigured } from "@/lib/growth/provider-setup/google-oauth"
import { listProviderConnectionSettingsRows } from "@/lib/growth/provider-setup/dashboard"
import { fetchGrowthOutboundOperationsDashboard } from "@/lib/growth/operations/outbound-operations-dashboard"
import { listRecentInternalOutboundAuditEvents } from "@/lib/growth/operations/internal-outbound-audit"
import {
  GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER,
  type GrowthInternalOutboundAuditEvent,
  type GrowthInternalOutboundDeliverabilitySummary,
  type GrowthInternalOutboundDomainRow,
  type GrowthInternalOutboundMailboxRow,
  type GrowthInternalOutboundSenderPoolRow,
} from "@/lib/growth/operations/internal-outbound-ops-types"
import { collectGrowthRuntimeDiagnostics } from "@/lib/growth/runtime/runtime-guards"
import { listSenderAccounts, listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { fetchGrowthSenderPoolDashboard } from "@/lib/growth/sender-pools/sender-pool-dashboard"
import {
  computeSenderHealthScore,
} from "@/lib/growth/sender-pools/sender-operational-pause"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { buildSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { fetchDeliverabilityIntelligenceDashboard } from "@/lib/growth/deliverability/deliverability-intelligence-dashboard"
import type { GrowthDeliverabilityIntelligenceDashboard } from "@/lib/growth/deliverability/deliverability-intelligence-dashboard"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"

export type GrowthInternalOutboundOperationsDashboard = {
  qa_marker: typeof GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER
  generated_at: string
  runtime: ReturnType<typeof collectGrowthRuntimeDiagnostics>
  mailboxes: GrowthInternalOutboundMailboxRow[]
  domains: GrowthInternalOutboundDomainRow[]
  sender_pools: GrowthInternalOutboundSenderPoolRow[]
  queue_health: Awaited<ReturnType<typeof fetchGrowthOutboundOperationsDashboard>>
  deliverability: GrowthInternalOutboundDeliverabilitySummary
  send_verifications: Array<{
    id: string
    senderAccountId: string
    status: string
    occurredAt: string
    isTest: boolean
    failureReason: string | null
  }>
  audit_events: GrowthInternalOutboundAuditEvent[]
  google_provider: {
    oauthConfigured: boolean
    connectedAccounts: number
    lastTestSendAt: string | null
    readinessStatus: string
  }
  readiness_catalog: ReturnType<typeof buildGrowthInfrastructureReadinessCatalog>
  deliverability_intelligence: GrowthDeliverabilityIntelligenceDashboard
}

function since24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? ""
}

export async function fetchGrowthInternalOutboundOperationsDashboard(
  admin: SupabaseClient,
): Promise<GrowthInternalOutboundOperationsDashboard> {
  const since24h = since24hIso()

  const [
    queueHealth,
    mailboxes,
    senders,
    domains,
    poolDashboard,
    pools,
    routes,
    providerSetup,
    auditEvents,
    deliveryAttempts,
    webhookEvents,
    bounces24h,
    complaints24h,
    deliverabilityIntelligence,
  ] = await Promise.all([
    fetchGrowthOutboundOperationsDashboard(admin),
    listMailboxConnections(admin),
    listSenderAccounts(admin),
    listSenderDomains(admin),
    fetchGrowthSenderPoolDashboard(admin),
    listSenderPools(admin),
    listDeliveryRoutes(admin),
    listProviderConnectionSettingsRows(admin).catch(() => []),
    listRecentInternalOutboundAuditEvents(admin, 30),
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id, sender_account_id, status, created_at, failure_reason, metadata")
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .schema("growth")
      .from("provider_delivery_events")
      .select("sender_account_id, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(200),
    admin
      .schema("growth")
      .from("email_bounces")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since24h),
    admin
      .schema("growth")
      .from("email_complaints")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", since24h),
    fetchDeliverabilityIntelligenceDashboard(admin),
  ])

  const senderById = new Map(senders.map((s) => [s.id, s]))
  const poolMembersNested = await Promise.all(pools.map((pool) => listSenderPoolMembers(admin, pool.id)))
  const senderPoolLabels = new Map<string, string[]>()
  for (let i = 0; i < pools.length; i += 1) {
    for (const member of poolMembersNested[i] ?? []) {
      const labels = senderPoolLabels.get(member.senderAccountId) ?? []
      labels.push(pools[i].name)
      senderPoolLabels.set(member.senderAccountId, labels)
    }
  }

  const lastSendBySender = new Map<string, string>()
  const lastWebhookBySender = new Map<string, string>()
  for (const row of (deliveryAttempts.data ?? []) as Array<{ sender_account_id?: string; created_at?: string; status?: string }>) {
    const senderId = row.sender_account_id ?? ""
    if (senderId && row.status === "sent" && !lastSendBySender.has(senderId)) {
      lastSendBySender.set(senderId, row.created_at ?? "")
    }
  }
  for (const row of (webhookEvents.data ?? []) as Array<{ sender_account_id?: string; occurred_at?: string }>) {
    const senderId = row.sender_account_id ?? ""
    if (senderId && !lastWebhookBySender.has(senderId)) {
      lastWebhookBySender.set(senderId, row.occurred_at ?? "")
    }
  }

  const mailboxRows: GrowthInternalOutboundMailboxRow[] = mailboxes.map((mailbox) => {
    const sender = senderById.get(mailbox.sender_account_id)
    return {
      id: mailbox.id,
      providerFamily: mailbox.provider_family,
      emailAddress: mailbox.email_address,
      domain: extractDomain(mailbox.email_address),
      status: mailbox.status,
      healthTier: mailbox.health_tier,
      connectionHealth: mailbox.connection_health,
      oauthConfigured: mailbox.provider_family === "google" ? googleProviderOAuthConfigured() : false,
      tokenExpiresAt: mailbox.token_expires_at,
      lastValidationAt: mailbox.last_validation_at,
      lastSuccessfulSendAt: lastSendBySender.get(mailbox.sender_account_id) ?? sender?.last_send_at ?? null,
      lastWebhookAt: lastWebhookBySender.get(mailbox.sender_account_id) ?? null,
      dailySendLimit: sender?.daily_send_limit ?? 0,
      dailySendUsed: sender?.daily_send_used ?? 0,
      warmupStage: sender?.warmup_enabled ? "warming" : sender?.warmup_eligible ? "eligible" : "off",
      senderPoolLabels: senderPoolLabels.get(mailbox.sender_account_id) ?? [],
      rotationStatus:
        (senderPoolLabels.get(mailbox.sender_account_id)?.length ?? 0) > 0 ? "pool_member" : "unassigned",
    }
  })

  const domainRows: GrowthInternalOutboundDomainRow[] = domains.map((domain) => {
    const readiness = computeDomainReadiness(domain)
    return {
      id: domain.id,
      domain: domain.domain,
      readinessStatus: readiness.readinessStatus,
      readinessScore: readiness.readinessScore,
      verificationLabel: readiness.verificationLabel,
      verificationSource: readiness.verificationSource,
      lastVerifiedAt: readiness.lastVerifiedAt,
      verificationError: readiness.verificationError,
      manualOverride: readiness.manualOverride,
      operationalStatus: readiness.operationalStatus,
      spfStatus: readiness.spfStatus,
      dkimStatus: readiness.dkimStatus,
      dmarcStatus: readiness.dmarcStatus,
      mxStatus: readiness.mxStatus,
      trackingDomainReady: readiness.trackingDomainReady,
      manualVerificationRequired: readiness.manualVerificationRequired,
      reputationWarnings: readiness.reputationWarnings,
      healthTier: readiness.healthTier,
    }
  })

  const senderPoolRows: GrowthInternalOutboundSenderPoolRow[] = await Promise.all(
    pools.map(async (pool, poolIndex) => {
      const members = poolMembersNested[poolIndex] ?? []
      const contexts = []
      for (const member of members) {
        const ctx = await buildSenderPoolMemberContext(admin, member, routes)
        if (ctx) contexts.push({ ctx, member })
      }

      const pausedSenders = members.filter((m) => m.memberStatus === "paused" || m.memberStatus === "blocked").length
      const unhealthySenders = contexts.filter(({ ctx }) =>
        computeSenderHealthScore({
          healthScore: ctx.healthScore,
          bounceRisk: ctx.bounceRisk,
          complaintRisk: ctx.complaintRisk,
          memberStatus: ctx.memberStatus,
          dailyCapRemaining: ctx.dailyCapRemaining,
        }) < 40,
      ).length

      const dailyCapacity = contexts.reduce((sum, { ctx }) => sum + ctx.dailyCapRemaining, 0)
      const dailyUsed = contexts.reduce((sum, { ctx }) => sum + ctx.recentVolume, 0)

      return {
        id: pool.id,
        name: pool.name,
        status: pool.status,
        activeSenders: contexts.filter(({ ctx }) => ctx.memberStatus === "eligible").length,
        pausedSenders,
        unhealthySenders,
        dailyCapacity,
        dailyUsed,
        fatigueWarnings: poolDashboard.fatigueWarnings,
        queueLoad: queueHealth.outreach_queue.scheduled + queueHealth.sequence_jobs.approved_due,
        rotationHealth: poolDashboard.rotationHealth,
      }
    }),
  )

  const sent24h = queueHealth.transport.sent_attempts_24h
  const failed24h = queueHealth.transport.failed_attempts_24h
  const deliverability: GrowthInternalOutboundDeliverabilitySummary = {
    bounceRate24h: sent24h > 0 ? Math.round(((bounces24h.count ?? 0) / sent24h) * 1000) / 10 : 0,
    complaintRate24h: sent24h > 0 ? Math.round(((complaints24h.count ?? 0) / sent24h) * 1000) / 10 : 0,
    suppressionHits24h: queueHealth.suppression.pre_send_blocks_24h,
    failedSends24h: failed24h,
    sent24h,
    unhealthyMailboxCount: mailboxRows.filter((m) => ["error", "expired", "critical"].includes(m.status)).length,
  }

  const sendVerifications = ((deliveryAttempts.data ?? []) as Array<{
    id: string
    sender_account_id: string
    status: string
    created_at: string
    failure_reason: string | null
    metadata: Record<string, unknown> | null
  }>)
    .filter((row) => row.metadata?.is_test === true || row.metadata?.test_send === true)
    .slice(0, 15)
    .map((row) => ({
      id: row.id,
      senderAccountId: row.sender_account_id,
      status: row.status,
      occurredAt: row.created_at,
      isTest: true,
      failureReason: row.failure_reason,
    }))

  const googleSetup = providerSetup.find((row) => row.provider_family === "google")

  return {
    qa_marker: GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER,
    generated_at: new Date().toISOString(),
    runtime: collectGrowthRuntimeDiagnostics(),
    mailboxes: mailboxRows,
    domains: domainRows,
    sender_pools: senderPoolRows,
    queue_health: queueHealth,
    deliverability,
    send_verifications: sendVerifications,
    audit_events: auditEvents,
    google_provider: {
      oauthConfigured: googleProviderOAuthConfigured(),
      connectedAccounts: providerSetup.filter((row) => row.provider_family === "google" && row.status === "connected")
        .length,
      lastTestSendAt: googleSetup?.last_test_send_at ?? null,
      readinessStatus: googleProviderOAuthConfigured() ? "live" : "stub",
    },
    readiness_catalog: buildGrowthInfrastructureReadinessCatalog(),
    deliverability_intelligence: deliverabilityIntelligence,
  }
}
