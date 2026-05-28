import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/deliverability-governance-events"
import {
  assessMailboxReputation,
  loadMailboxSendPolicy,
} from "@/lib/growth/deliverability/mailbox-reputation-repository"
import type { GrowthSendThrottleDecision } from "@/lib/growth/deliverability/reputation-protection-types"
import {
  evaluateSendThrottle,
  governanceEventTypeForThrottle,
} from "@/lib/growth/deliverability/send-throttle-engine"
import {
  loadSenderDeliverabilityPauseState,
  persistSenderDeliverabilityPause,
} from "@/lib/growth/deliverability/sender-pause-state"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"

export type GrowthReputationProtectionPreSendResult = {
  allowed: boolean
  reason: string | null
  blockCode: "reputation_paused" | "reputation_throttled" | null
  throttle: GrowthSendThrottleDecision | null
}

export async function evaluateReputationProtectionPreSend(
  admin: SupabaseClient,
  input: { senderAccountId: string },
): Promise<GrowthReputationProtectionPreSendResult> {
  const sender = await getSenderAccount(admin, input.senderAccountId)
  if (!sender) {
    return { allowed: true, reason: null, blockCode: null, throttle: null }
  }

  const pauseState = await loadSenderDeliverabilityPauseState(admin, input.senderAccountId)
  if (pauseState?.paused) {
    return {
      allowed: false,
      reason:
        pauseState.pause_reason ??
        "Mailbox is persistently paused by deliverability protection.",
      blockCode: "reputation_paused",
      throttle: {
        allowed: false,
        throttled: false,
        paused: true,
        reason: pauseState.pause_reason,
        rule_id: pauseState.pause_rule_id ?? "persistent_pause",
        recommended_delay_seconds: pauseState.cooldown_until
          ? Math.max(0, Math.ceil((Date.parse(pauseState.cooldown_until) - Date.now()) / 1000))
          : null,
      },
    }
  }

  const [assessment, policy] = await Promise.all([
    assessMailboxReputation(admin, input.senderAccountId),
    loadMailboxSendPolicy(admin, input.senderAccountId),
  ])

  if (!assessment) {
    return { allowed: true, reason: null, blockCode: null, throttle: null }
  }

  const throttle = evaluateSendThrottle({
    policy,
    assessment,
    last_send_at: sender.last_send_at,
  })

  if (throttle.paused || !throttle.allowed) {
    const eventType = governanceEventTypeForThrottle(throttle, assessment)
    if (eventType) {
      await appendDeliverabilityGovernanceEvent(admin, {
        event_type: eventType,
        sender_account_id: input.senderAccountId,
        mailbox_connection_id: assessment.metrics.mailbox_connection_id,
        title: throttle.paused ? "Mailbox paused — reputation protection" : "Send throttled — reputation protection",
        summary: throttle.reason ?? "Deliverability protection rule applied.",
        severity: throttle.paused ? "critical" : "high",
        reversible: true,
        metadata: {
          rule_id: throttle.rule_id,
          risk_score: assessment.risk_score,
          health_tier: assessment.health_tier,
        },
      }).catch(() => undefined)
    }

    if (throttle.paused) {
      await persistSenderDeliverabilityPause(admin, {
        senderAccountId: input.senderAccountId,
        mailboxConnectionId: assessment.metrics.mailbox_connection_id,
        throttle,
        cooldownHours: policy.cooldown_hours,
      }).catch(() => undefined)
    }

    return {
      allowed: false,
      reason: throttle.reason,
      blockCode: throttle.paused ? "reputation_paused" : "reputation_throttled",
      throttle,
    }
  }

  if (throttle.throttled && throttle.rule_id === "reputation_throttle") {
    await appendDeliverabilityGovernanceEvent(admin, {
      event_type: "deliverability_risk_detected",
      sender_account_id: input.senderAccountId,
      mailbox_connection_id: assessment.metrics.mailbox_connection_id,
      title: "Deliverability risk — reduced velocity",
      summary: throttle.reason ?? assessment.risk_reasons[0] ?? "Reputation tier requires caution.",
      severity: "medium",
      metadata: {
        rule_id: throttle.rule_id,
        risk_score: assessment.risk_score,
        health_tier: assessment.health_tier,
      },
    }).catch(() => undefined)
  }

  return { allowed: true, reason: throttle.reason, blockCode: null, throttle }
}
