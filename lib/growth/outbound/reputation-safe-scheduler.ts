import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeDomainOperationalHealth } from "@/lib/growth/deliverability/domain-health-engine"
import { computeMailboxOperationalHealth } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { recordDeliveryTimelineEvent } from "@/lib/growth/deliverability/delivery-event-timeline"
import type { GrowthSchedulerDecision } from "@/lib/growth/outbound/reputation-safe-scaling-types"
import { canAllocateThroughputSend } from "@/lib/growth/outbound/throughput-allocator"
import { resolveDomainSegmentPolicy } from "@/lib/growth/outbound/domain-segmentation"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { getSenderPool, listSenderPoolMembers } from "@/lib/growth/sender-pools/sender-pool-repository"
import { buildSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"

export type ReputationSafeScheduleInput = {
  entityType: "outreach_queue" | "sequence_job"
  entityId: string
  senderAccountId?: string | null
  senderPoolId?: string | null
  domain?: string | null
  priority?: "low" | "normal" | "high" | "critical"
}

export type ReputationSafeScheduleResult = {
  decision: GrowthSchedulerDecision
  reasons: string[]
  deferredUntil: string | null
  recommendedSenderAccountId: string | null
  metadata: Record<string, unknown>
}

function schedulerDecisionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("outbound_scheduler_decisions")
}

export async function recordSchedulerDecision(
  admin: SupabaseClient,
  input: ReputationSafeScheduleInput & ReputationSafeScheduleResult,
): Promise<void> {
  await schedulerDecisionsTable(admin).insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    decision: input.decision,
    reasons: input.reasons,
    metadata: input.metadata,
  })
}

export async function evaluateReputationSafeSchedule(
  admin: SupabaseClient,
  input: ReputationSafeScheduleInput,
): Promise<ReputationSafeScheduleResult> {
  const reasons: string[] = []
  let decision: GrowthSchedulerDecision = "execute"
  let deferredUntil: string | null = null
  let recommendedSenderAccountId = input.senderAccountId ?? null
  const metadata: Record<string, unknown> = {}

  const domains = await listSenderDomains(admin)
  const domainName = input.domain?.toLowerCase() ?? null
  const domainRow = domainName ? domains.find((d) => d.domain.toLowerCase() === domainName) : null

  if (domainRow) {
    const segmentPolicy = resolveDomainSegmentPolicy(domainRow.domain_segment)
    if (!segmentPolicy.allowOutbound) {
      return finalize("skip", [`Domain segment '${domainRow.domain_segment}' blocks outbound.`])
    }
    if (segmentPolicy.throttleMultiplier < 1) {
      decision = "throttle"
      reasons.push(`Domain segment '${domainRow.domain_segment}' requires throttled throughput.`)
      metadata.throttle_multiplier = segmentPolicy.throttleMultiplier
    }

    const domainHealth = await computeDomainOperationalHealth(admin, domainRow.id)
    metadata.domain_health_score = domainHealth.domainHealthScore
    if (domainRow.operational_status === "paused" || domainHealth.operationalStatus === "paused") {
      return finalize("skip", ["Domain operationally paused — protection rule active."])
    }
    if (domainHealth.operationalStatus === "critical") {
      return finalize("skip", domainHealth.riskReasons.length ? domainHealth.riskReasons : ["Domain health critical."])
    }
    if (domainHealth.operationalStatus === "degraded") {
      decision = input.priority === "critical" ? "throttle" : "defer"
      reasons.push("Domain health degraded — deferring non-critical sends.")
      deferredUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    }
  }

  if (input.senderPoolId) {
    const pool = await getSenderPool(admin, input.senderPoolId)
    if (!pool || pool.status !== "active") {
      return finalize("skip", ["Sender pool inactive or paused."])
    }

    const members = await listSenderPoolMembers(admin, input.senderPoolId)
    const routes = await listDeliveryRoutes(admin)
    const contexts = (
      await Promise.all(members.map((m) => buildSenderPoolMemberContext(admin, m, routes)))
    ).filter(Boolean)

    const eligible = contexts.filter(
      (ctx) =>
        ctx!.memberStatus === "eligible" &&
        ctx!.dailyCapRemaining > 0 &&
        !ctx!.suppressed &&
        !ctx!.domainDeliverabilityCritical,
    )

    if (eligible.length === 0) {
      return finalize("defer", ["No eligible senders in pool — all paused, capped, or unhealthy."], 4)
    }

    eligible.sort((a, b) => b!.healthScore - a!.healthScore + b!.dailyCapRemaining - a!.dailyCapRemaining)
    recommendedSenderAccountId = eligible[0]!.senderAccountId

    const pausedCount = members.filter((m) => m.memberStatus === "paused" || m.memberStatus === "blocked").length
    if (pausedCount / Math.max(1, members.length) >= 0.5) {
      decision = decision === "execute" ? "throttle" : decision
      reasons.push("Pool has elevated paused sender ratio.")
    }

    metadata.pool_eligible_senders = eligible.length
    metadata.pool_paused_senders = pausedCount
  }

  if (recommendedSenderAccountId) {
    const mailboxHealth = await computeMailboxOperationalHealth(admin, recommendedSenderAccountId)
    if (mailboxHealth) {
      metadata.mailbox_trust_score = mailboxHealth.trustScore
      metadata.mailbox_fatigue_score = mailboxHealth.fatigueScore
      if (mailboxHealth.operationalStatus === "critical") {
        return finalize("skip", mailboxHealth.riskReasons.length ? mailboxHealth.riskReasons : ["Mailbox critical."])
      }
      if (mailboxHealth.fatigueScore >= 70) {
        decision = decision === "execute" ? "defer" : decision
        reasons.push("Sender fatigue elevated — cooldown recommended.")
        deferredUntil = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
      }
      if (mailboxHealth.cooldownRecommendation) {
        reasons.push(mailboxHealth.cooldownRecommendation)
      }
    }

    const throughput = await canAllocateThroughputSend(admin, {
      senderAccountId: recommendedSenderAccountId,
      domain: domainName,
      senderPoolId: input.senderPoolId ?? null,
    })
    metadata.throughput_utilization = throughput.utilizationPct
    if (!throughput.allowed) {
      return finalize(throughput.suggestDefer ? "defer" : "skip", [throughput.reason], throughput.deferHours)
    }
    if (throughput.saturationLevel === "elevated" && decision === "execute") {
      decision = "throttle"
      reasons.push("Throughput saturation elevated on infrastructure.")
    }
  }

  const { count: queueDepth } = await admin
    .schema("growth")
    .from("outreach_queue")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved", "scheduled"])

  metadata.queue_depth = queueDepth ?? 0
  if ((queueDepth ?? 0) >= 100 && decision === "execute" && input.priority !== "critical") {
    decision = "defer"
    reasons.push("Queue congestion — deferring lower-priority item.")
    deferredUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  return finalize(decision, reasons)

  function finalize(
    finalDecision: GrowthSchedulerDecision,
    finalReasons: string[],
    deferHours = 2,
  ): ReputationSafeScheduleResult {
    const result: ReputationSafeScheduleResult = {
      decision: finalDecision,
      reasons: finalReasons,
      deferredUntil:
        finalDecision === "defer"
          ? new Date(Date.now() + deferHours * 60 * 60 * 1000).toISOString()
          : deferredUntil,
      recommendedSenderAccountId,
      metadata,
    }

    if (finalDecision !== "execute") {
      void recordDeliveryTimelineEvent(admin, {
        normalizedType: finalDecision === "throttle" ? "throttled" : "send_failure",
        severity: finalDecision === "skip" ? "high" : "medium",
        title: `Scheduler ${finalDecision}: ${input.entityType}`,
        summary: finalReasons.join(" "),
        senderAccountId: recommendedSenderAccountId,
        dedupeKey: `scheduler:${input.entityType}:${input.entityId}:${finalDecision}:${new Date().toISOString().slice(0, 13)}`,
        occurredAt: new Date().toISOString(),
        metadata: { decision: finalDecision, ...metadata },
      }).catch(() => undefined)
    }

    return result
  }
}

export async function applyReputationSafeScheduleGate(
  admin: SupabaseClient,
  input: ReputationSafeScheduleInput,
): Promise<{ proceed: boolean; result: ReputationSafeScheduleResult }> {
  const result = await evaluateReputationSafeSchedule(admin, input)
  await recordSchedulerDecision(admin, { ...input, ...result })
  const proceed = result.decision === "execute" || result.decision === "throttle" || result.decision === "redistribute"
  return { proceed, result }
}
