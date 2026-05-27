import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthDeliverabilityProtectionAction } from "@/lib/growth/deliverability/deliverability-intelligence-types"
import { recordDeliveryTimelineEvent } from "@/lib/growth/deliverability/delivery-event-timeline"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { computeMailboxOperationalHealth } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { updateSenderPoolMemberOperationalStatus } from "@/lib/growth/sender-pools/sender-operational-pause"

export type DeliverabilityProtectionTrigger =
  | "dns_verification"
  | "bounce_spike"
  | "complaint_spike"
  | "provider_rejection"
  | "oauth_degradation"
  | "webhook_outage"
  | "scheduled_health_scan"

type ProtectionDecision = {
  protectionType: string
  action: GrowthDeliverabilityProtectionAction
  entityType: "sender" | "domain" | "mailbox" | "pool" | "platform"
  entityId: string | null
  reason: string
  metadata?: Record<string, unknown>
}

function protectionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_protection_events")
}

async function recordProtectionEvent(
  admin: SupabaseClient,
  decision: ProtectionDecision,
): Promise<void> {
  const { error } = await protectionTable(admin).insert({
    protection_type: decision.protectionType,
    action_taken: decision.action,
    entity_type: decision.entityType,
    entity_id: decision.entityId,
    reason: decision.reason,
    reversible: true,
    metadata: decision.metadata ?? {},
  })
  if (error) console.error("[deliverability-protection]", error.message)

  await recordDeliveryTimelineEvent(admin, {
    normalizedType: "protection_applied",
    severity: decision.action === "pause_sender" || decision.action === "pause_domain" ? "critical" : "high",
    title: `Protection: ${decision.protectionType}`,
    summary: decision.reason,
    senderAccountId: decision.entityType === "sender" ? decision.entityId : null,
    domainId: decision.entityType === "domain" ? decision.entityId : null,
    dedupeKey: `protection:${decision.protectionType}:${decision.entityType}:${decision.entityId ?? "platform"}:${new Date().toISOString().slice(0, 13)}`,
    occurredAt: new Date().toISOString(),
    metadata: { action: decision.action, ...decision.metadata },
  }).catch(() => undefined)
}

async function applyProtectionAction(admin: SupabaseClient, decision: ProtectionDecision): Promise<void> {
  await recordProtectionEvent(admin, decision)

  if (decision.action === "pause_domain" && decision.entityId) {
    await admin
      .schema("growth")
      .from("sender_domains")
      .update({ operational_status: "paused", updated_at: new Date().toISOString() })
      .eq("id", decision.entityId)

    await recordInternalOutboundAuditEvent(admin, {
      eventType: "domain_risk_alert",
      severity: "critical",
      title: "Domain operationally paused",
      summary: decision.reason,
      senderDomainId: decision.entityId,
      metadata: { protection_type: decision.protectionType, action: decision.action },
    }).catch(() => undefined)
  }

  if (decision.action === "pause_sender" && decision.entityId) {
    const pools = await listSenderPools(admin)
    for (const pool of pools) {
      const members = await listSenderPoolMembers(admin, pool.id)
      const member = members.find((m) => m.senderAccountId === decision.entityId)
      if (member) {
        await updateSenderPoolMemberOperationalStatus(admin, {
          memberId: member.id,
          memberStatus: "paused",
          operationalPauseReason: decision.protectionType,
        })
      }
    }
  }

  if (decision.action === "restrict_rotation" && decision.entityId) {
    await admin
      .schema("growth")
      .from("sender_pools")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", decision.entityId)
  }
}

export async function evaluateDeliverabilityProtections(
  admin: SupabaseClient,
  input: {
    domainId?: string
    senderAccountId?: string
    trigger: DeliverabilityProtectionTrigger
  },
): Promise<ProtectionDecision[]> {
  const decisions: ProtectionDecision[] = []

  if (input.domainId) {
    const health = await computeDomainOperationalHealth(admin, input.domainId)
    const { data: domainRow } = await admin
      .schema("growth")
      .from("sender_domains")
      .select("verification_error, operational_status")
      .eq("id", input.domainId)
      .maybeSingle()

    const verificationError = String((domainRow as Record<string, unknown> | null)?.verification_error ?? "")

    if (verificationError && input.trigger === "dns_verification") {
      decisions.push({
        protectionType: "dns_failure",
        action: health.operationalStatus === "critical" ? "pause_domain" : "degrade",
        entityType: "domain",
        entityId: input.domainId,
        reason: `DNS verification failed: ${verificationError}`,
      })
    } else if (health.signals.bounceRate >= 8) {
      decisions.push({
        protectionType: "bounce_spike",
        action: health.signals.bounceRate >= 12 ? "pause_domain" : "warn",
        entityType: "domain",
        entityId: input.domainId,
        reason: `Bounce rate ${health.signals.bounceRate}% exceeds threshold.`,
        metadata: health.signals,
      })
    } else if (health.signals.complaintRate >= 0.5) {
      decisions.push({
        protectionType: "complaint_spike",
        action: health.signals.complaintRate >= 1 ? "pause_domain" : "cooldown",
        entityType: "domain",
        entityId: input.domainId,
        reason: `Complaint rate ${health.signals.complaintRate}% exceeds threshold.`,
        metadata: health.signals,
      })
    } else if (health.operationalStatus === "critical") {
      decisions.push({
        protectionType: "unhealthy_domain",
        action: "degrade",
        entityType: "domain",
        entityId: input.domainId,
        reason: health.riskReasons[0] ?? "Domain health critical.",
        metadata: { score: health.domainHealthScore },
      })
    }
  }

  if (input.senderAccountId) {
    const mailboxHealth = await computeMailboxOperationalHealth(admin, input.senderAccountId)
    if (!mailboxHealth) return decisions

    if (mailboxHealth.signals.oauthFailures >= 2) {
      decisions.push({
        protectionType: "oauth_degradation",
        action: "pause_sender",
        entityType: "sender",
        entityId: input.senderAccountId,
        reason: `${mailboxHealth.signals.oauthFailures} OAuth failures in 24h.`,
      })
    } else if (mailboxHealth.signals.providerRejections24h >= 5) {
      decisions.push({
        protectionType: "provider_rejection",
        action: "pause_sender",
        entityType: "sender",
        entityId: input.senderAccountId,
        reason: `${mailboxHealth.signals.providerRejections24h} provider rejections in 24h.`,
      })
    } else if (
      mailboxHealth.signals.webhookSilenceHours != null &&
      mailboxHealth.signals.webhookSilenceHours >= 72 &&
      mailboxHealth.signals.sendFailures24h === 0
    ) {
      decisions.push({
        protectionType: "webhook_outage",
        action: "warn",
        entityType: "mailbox",
        entityId: mailboxHealth.mailboxConnectionId,
        reason: `Webhook silence ~${mailboxHealth.signals.webhookSilenceHours}h after recent activity.`,
      })
    } else if (mailboxHealth.signals.bounces24h >= 3) {
      decisions.push({
        protectionType: "bounce_spike",
        action: "pause_sender",
        entityType: "sender",
        entityId: input.senderAccountId,
        reason: `${mailboxHealth.signals.bounces24h} bounces in 24h on mailbox.`,
      })
    } else if (mailboxHealth.signals.complaints24h >= 1) {
      decisions.push({
        protectionType: "complaint_spike",
        action: "pause_sender",
        entityType: "sender",
        entityId: input.senderAccountId,
        reason: `${mailboxHealth.signals.complaints24h} complaint(s) in 24h.`,
      })
    }
  }

  for (const decision of decisions) {
    await applyProtectionAction(admin, decision)
  }

  return decisions
}

export async function listRecentProtectionEvents(
  admin: SupabaseClient,
  limit = 20,
): Promise<
  Array<{
    id: string
    protectionType: string
    actionTaken: string
    entityType: string
    reason: string
    createdAt: string
  }>
> {
  const { data, error } = await protectionTable(admin)
    .select("id, protection_type, action_taken, entity_type, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []

  return (data ?? []).map((row) => ({
    id: String((row as Record<string, unknown>).id),
    protectionType: String((row as Record<string, unknown>).protection_type),
    actionTaken: String((row as Record<string, unknown>).action_taken),
    entityType: String((row as Record<string, unknown>).entity_type),
    reason: String((row as Record<string, unknown>).reason),
    createdAt: String((row as Record<string, unknown>).created_at),
  }))
}
