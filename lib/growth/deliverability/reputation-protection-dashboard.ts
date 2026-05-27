import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listDeliverabilityGovernanceEvents } from "@/lib/growth/deliverability/deliverability-governance-events"
import {
  assessAllMailboxReputations,
  buildReputationTrendSections,
  loadMailboxSendPolicy,
} from "@/lib/growth/deliverability/mailbox-reputation-repository"
import {
  GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER,
  GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER,
  GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER,
  GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE,
  GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER,
  GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER,
  type GrowthReputationProtectionDashboard,
} from "@/lib/growth/deliverability/reputation-protection-types"
import { evaluateSendThrottle } from "@/lib/growth/deliverability/send-throttle-engine"
import { buildWarmupRampGuidance } from "@/lib/growth/deliverability/warmup-ramp-engine"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"

export async function buildReputationProtectionDashboard(
  admin: SupabaseClient,
): Promise<GrowthReputationProtectionDashboard> {
  const assessments = await assessAllMailboxReputations(admin)
  const trends = buildReputationTrendSections(assessments)
  const senders = await listSenderAccounts(admin)

  const atRisk = assessments.filter((row) =>
    ["caution", "high_risk", "protected"].includes(row.health_tier),
  )
  const paused = assessments.filter((row) => row.health_tier === "paused")
  const warming = assessments.filter((row) => row.health_tier === "warming")
  const healthy = assessments.filter((row) => row.health_tier === "healthy")

  const warmup_progress = await Promise.all(
    senders.slice(0, 20).map(async (sender) => {
      const assessment = assessments.find((row) => row.metrics.sender_account_id === sender.id)
      const { data: warmupProfile } = await admin
        .schema("growth")
        .from("warmup_profiles")
        .select("*")
        .eq("sender_account_id", sender.id)
        .is("deleted_at", null)
        .maybeSingle()

      const profile = warmupProfile as Record<string, unknown> | null
      return buildWarmupRampGuidance({
        sender_email: sender.email_address,
        warmup_enabled: sender.warmup_enabled,
        warmup_status: assessment?.metrics.warmup_status,
        warmup_progress: assessment?.metrics.warmup_progress,
        target_daily_volume: profile ? Number(profile.target_daily_volume ?? 50) : null,
        current_daily_volume: profile ? Number(profile.current_daily_volume ?? 10) : null,
        daily_increment: profile ? Number(profile.daily_increment ?? 5) : null,
        warmup_days: profile ? Number(profile.warmup_days ?? 21) : null,
        daily_send_used: sender.daily_send_used,
        bounce_rate: assessment?.metrics.bounce_rate ?? 0,
      })
    }),
  )

  const sending_velocity = await Promise.all(
    assessments.slice(0, 12).map(async (row) => {
      const policy = await loadMailboxSendPolicy(admin, row.metrics.sender_account_id)
      const throttle = evaluateSendThrottle({ policy, assessment: row })
      return {
        label: row.metrics.email_address,
        daily_send_count: row.metrics.daily_send_count,
        cap_utilization_pct:
          policy.daily_send_cap > 0
            ? Math.round((row.metrics.daily_send_count / policy.daily_send_cap) * 100)
            : 0,
        throttled: throttle.throttled,
        paused: throttle.paused,
      }
    }),
  )

  const sequence_risk = assessments
    .filter((row) => row.metrics.sequence_participation_count > 0)
    .slice(0, 8)
    .map((row) => ({
      label: row.metrics.email_address,
      sequence_count: row.metrics.sequence_participation_count,
      risk_score: row.risk_score,
    }))

  const reply_performance = assessments.slice(0, 8).map((row) => ({
    label: row.metrics.email_address,
    reply_rate: row.metrics.reply_rate,
    positive_reply_rate: row.metrics.positive_reply_rate,
  }))

  const recommended_actions = [
    ...new Set([
      ...atRisk.flatMap((row) => row.recommended_actions),
      ...paused.map(() => "Review paused mailboxes before resuming outbound."),
    ]),
  ].slice(0, 8)

  const recent_governance_events = await listDeliverabilityGovernanceEvents(admin, 20)
  const average_risk_score =
    assessments.length > 0
      ? Math.round(assessments.reduce((sum, row) => sum + row.risk_score, 0) / assessments.length)
      : 100

  return {
    qa_marker: GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER,
    mailbox_reputation_qa_marker: GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER,
    throttle_qa_marker: GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER,
    warmup_qa_marker: GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER,
    governance_qa_marker: GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER,
    privacy_note: GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE,
    summary: {
      total_mailboxes: assessments.length,
      healthy_count: healthy.length,
      at_risk_count: atRisk.length,
      paused_count: paused.length,
      warming_count: warming.length,
      average_risk_score,
    },
    mailbox_health: assessments,
    at_risk_mailboxes: atRisk,
    paused_mailboxes: paused,
    bounce_trends: trends.bounce_trends,
    complaint_trends: trends.complaint_trends,
    reply_performance,
    warmup_progress,
    sequence_risk,
    sending_velocity: sending_velocity.map(({ label, daily_send_count, cap_utilization_pct }) => ({
      label,
      daily_send_count,
      cap_utilization_pct,
    })),
    recommended_actions,
    recent_governance_events,
  }
}
