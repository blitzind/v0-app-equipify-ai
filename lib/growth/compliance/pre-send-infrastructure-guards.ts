import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import { extractDomainFromEmail } from "@/lib/growth/sender/sender-domain-validator"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"
import { computeDomainReadiness } from "@/lib/growth/infrastructure/domain-readiness"
import { listSenderPoolMembers, listSenderPools } from "@/lib/growth/sender-pools/sender-pool-repository"
import { evaluateSenderPoolMemberEligibility } from "@/lib/growth/sender-pools/sender-eligibility"
import { buildSenderPoolMemberContext } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { evaluateReputationProtectionPreSend } from "@/lib/growth/deliverability/reputation-protection-pre-send"
import { evaluateWarmupPreSendAllowed } from "@/lib/growth/warmup/warmup-pre-send-guard"

export type GrowthPreSendInfrastructureResult = {
  allowed: boolean
  reason: string | null
  blockCode:
    | "sender_disabled"
    | "sender_paused"
    | "mailbox_unhealthy"
    | "domain_protection"
    | "pool_inactive"
    | "daily_cap_exhausted"
    | "reputation_paused"
    | "reputation_throttled"
    | "warmup_disabled"
    | "warmup_not_started"
    | "warmup_paused"
    | "warmup_throttled"
    | "warmup_cap_exhausted"
    | null
}

export async function evaluatePreSendInfrastructureAllowed(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    senderPoolId?: string | null
    recipientEmail?: string
  },
): Promise<GrowthPreSendInfrastructureResult> {
  const sender = await getSenderAccount(admin, input.senderAccountId)
  if (!sender || sender.deleted_at) {
    return { allowed: false, reason: "Sender account not found.", blockCode: "sender_disabled" }
  }

  if (sender.status === "disabled" || sender.status === "error") {
    return {
      allowed: false,
      reason: `Sender is ${sender.status} — outbound send blocked.`,
      blockCode: "sender_disabled",
    }
  }

  if (sender.health_status === "critical" || sender.health_status === "blocked") {
    return {
      allowed: false,
      reason: "Sender health is critical — operator review required.",
      blockCode: "sender_paused",
    }
  }

  const warmup = await evaluateWarmupPreSendAllowed(admin, {
    senderAccountId: input.senderAccountId,
  })
  if (!warmup.allowed && warmup.blockCode) {
    return {
      allowed: false,
      reason: warmup.reason ?? "Warmup policy blocked send.",
      blockCode: warmup.blockCode,
    }
  }

  // Warming mailboxes pace against warmup daily targets (profile sends_today vs planned).
  // Do not treat a stale/low sender_accounts.daily_send_limit as a one-send-per-day cap.
  const warmupPacesSenderDailyCap = warmup.profile_status === "warming"
  if (
    !warmupPacesSenderDailyCap &&
    sender.daily_send_used >= sender.daily_send_limit
  ) {
    return {
      allowed: false,
      reason: "Sender daily send cap exhausted.",
      blockCode: "daily_cap_exhausted",
    }
  }

  const reputation = await evaluateReputationProtectionPreSend(admin, {
    senderAccountId: input.senderAccountId,
  })
  if (!reputation.allowed) {
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "pre_send_blocked",
      severity: reputation.blockCode === "reputation_paused" ? "critical" : "high",
      title: "Send blocked — deliverability reputation protection",
      summary: reputation.reason,
      senderAccountId: input.senderAccountId,
      metadata: {
        block_code: reputation.blockCode,
        rule_id: reputation.throttle?.rule_id,
      },
    }).catch(() => undefined)

    return {
      allowed: false,
      reason: reputation.reason ?? "Deliverability reputation protection blocked send.",
      blockCode: reputation.blockCode,
    }
  }

  const mailbox = await getMailboxConnectionBySender(admin, input.senderAccountId).catch(() => null)
  if (mailbox && !["connected", "healthy", "warning"].includes(mailbox.status)) {
    await recordInternalOutboundAuditEvent(admin, {
      eventType: "pre_send_blocked",
      severity: "high",
      title: "Send blocked — unhealthy mailbox",
      summary: mailbox.health_reason ?? `Mailbox status: ${mailbox.status}`,
      senderAccountId: input.senderAccountId,
      mailboxConnectionId: mailbox.id,
      metadata: { block_code: "mailbox_unhealthy" },
    }).catch(() => undefined)

    return {
      allowed: false,
      reason: `Mailbox connection unhealthy (${mailbox.status}).`,
      blockCode: "mailbox_unhealthy",
    }
  }

  const domainName = extractDomainFromEmail(sender.email_address)
  if (domainName) {
    const domains = await listSenderDomains(admin)
    const domainRow = domains.find((d) => d.domain.toLowerCase() === domainName.toLowerCase())
    if (domainRow) {
      const readiness = computeDomainReadiness(domainRow)
      if (readiness.readinessStatus === "error" || domainRow.operational_status === "paused") {
        await recordInternalOutboundAuditEvent(admin, {
          eventType: "domain_risk_alert",
          severity: "critical",
          title: "Send blocked — domain protection",
          summary: readiness.reputationWarnings.join(" ") || "Domain deliverability critical.",
          senderAccountId: input.senderAccountId,
          senderDomainId: domainRow.id,
          metadata: { domain: domainName, block_code: "domain_protection" },
        }).catch(() => undefined)

        return {
          allowed: false,
          reason: "Domain protection rule blocked send — critical deliverability risk.",
          blockCode: "domain_protection",
        }
      }
    }
  }

  if (input.senderPoolId) {
    const pool = (await listSenderPools(admin)).find((p) => p.id === input.senderPoolId)
    if (!pool || pool.status !== "active") {
      return {
        allowed: false,
        reason: "Sender pool is not active.",
        blockCode: "pool_inactive",
      }
    }

    const members = await listSenderPoolMembers(admin, input.senderPoolId)
    const member = members.find((m) => m.senderAccountId === input.senderAccountId)
    if (member && (member.memberStatus === "paused" || member.memberStatus === "blocked")) {
      return {
        allowed: false,
        reason: `Sender paused in pool (${member.operationalPauseReason ?? member.memberStatus}).`,
        blockCode: "sender_paused",
      }
    }

    if (member) {
      const routes = await listDeliveryRoutes(admin)
      const ctx = await buildSenderPoolMemberContext(admin, member, routes)
      if (ctx) {
        const eligibility = evaluateSenderPoolMemberEligibility(ctx, pool.minComplianceScore, pool.requiresMailbox)
        if (!eligibility.eligible) {
          return {
            allowed: false,
            reason: eligibility.blockedReasons[0] ?? "Sender not eligible in pool.",
            blockCode: eligibility.blockedReasons.some((r) => r.includes("cooldown") || r.includes("paused"))
              ? "sender_paused"
              : "pool_inactive",
          }
        }
      }
    }
  }

  return { allowed: true, reason: null, blockCode: null }
}
