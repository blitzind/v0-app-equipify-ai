import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendDeliverabilityGovernanceEvent } from "@/lib/growth/deliverability/deliverability-governance-events"
import {
  assessAllMailboxReputations,
  loadMailboxSendPolicy,
} from "@/lib/growth/deliverability/mailbox-reputation-repository"
import {
  evaluateDeliverabilityRiskAlerts,
  type GrowthDeliverabilityRiskAlert,
} from "@/lib/growth/deliverability/reputation-risk-alerts"
import { GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER } from "@/lib/growth/deliverability/reputation-protection-types"
import {
  persistSenderDeliverabilityPause,
  recoverSenderDeliverabilityPause,
} from "@/lib/growth/deliverability/sender-pause-state"
import { evaluateSendThrottle } from "@/lib/growth/deliverability/send-throttle-engine"
import { runMailboxHealthIntelligenceRollup } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import { GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER } from "@/lib/growth/deliverability/mailbox-health-score-types"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"

export type GrowthReputationSnapshotRunSummary = {
  qa_marker: typeof GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER
  mailbox_health_qa_marker: typeof GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER
  snapshot_date: string
  assessed_count: number
  alerts_emitted: number
  pauses_persisted: number
  recoveries_recorded: number
  mailbox_health_synced: number
  mailbox_health_snapshots_updated: number
}

async function loadPreviousSnapshot(
  admin: SupabaseClient,
  senderAccountId: string,
  beforeDate: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .schema("growth")
    .from("mailbox_reputation_snapshots")
    .select("risk_score, health_tier, reply_rate")
    .eq("sender_account_id", senderAccountId)
    .lt("snapshot_date", beforeDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Record<string, unknown>) ?? null
}

async function hasRecentAlert(
  admin: SupabaseClient,
  senderAccountId: string,
  ruleId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("deliverability_governance_events")
    .select("id")
    .eq("sender_account_id", senderAccountId)
    .gte("created_at", since)
    .contains("metadata", { alert_rule: ruleId })
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function emitRiskAlert(
  admin: SupabaseClient,
  senderAccountId: string,
  mailboxConnectionId: string | null,
  alert: GrowthDeliverabilityRiskAlert,
): Promise<boolean> {
  if (await hasRecentAlert(admin, senderAccountId, alert.rule_id)) return false

  await appendDeliverabilityGovernanceEvent(admin, {
    event_type: alert.event_type,
    sender_account_id: senderAccountId,
    mailbox_connection_id: mailboxConnectionId,
    title: alert.title,
    summary: alert.summary,
    severity: alert.severity,
    metadata: {
      alert_rule: alert.rule_id,
      ...alert.metadata,
    },
  }).catch(() => undefined)

  return true
}

/** Idempotent daily reputation rollup — cron-safe. */
export async function runGrowthReputationSnapshotRollup(
  admin: SupabaseClient,
): Promise<GrowthReputationSnapshotRunSummary> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const assessments = await assessAllMailboxReputations(admin, { persistSnapshots: true })
  const senders = await listSenderAccounts(admin)

  let alertsEmitted = 0
  let pausesPersisted = 0
  let recoveriesRecorded = 0

  for (const assessment of assessments) {
    const sender = senders.find((row) => row.id === assessment.metrics.sender_account_id)
    const policy = await loadMailboxSendPolicy(admin, assessment.metrics.sender_account_id)
    const capUtil =
      sender && sender.daily_send_limit > 0
        ? Math.round((sender.daily_send_used / sender.daily_send_limit) * 100)
        : 0

    const previous = await loadPreviousSnapshot(admin, assessment.metrics.sender_account_id, snapshotDate)
    const alerts = evaluateDeliverabilityRiskAlerts({
      assessment,
      previousRiskScore: previous ? Number(previous.risk_score) : null,
      previousReplyRate: previous ? Number(previous.reply_rate) : null,
      previousHealthTier: previous ? (String(previous.health_tier) as never) : null,
      dailyCapUtilizationPct: capUtil,
    })

    for (const alert of alerts) {
      const emitted = await emitRiskAlert(
        admin,
        assessment.metrics.sender_account_id,
        assessment.metrics.mailbox_connection_id,
        alert,
      )
      if (emitted) alertsEmitted += 1
    }

    const throttle = evaluateSendThrottle({
      policy,
      assessment,
      last_send_at: sender?.last_send_at,
    })

    if (throttle.paused) {
      await persistSenderDeliverabilityPause(admin, {
        senderAccountId: assessment.metrics.sender_account_id,
        mailboxConnectionId: assessment.metrics.mailbox_connection_id,
        throttle,
        cooldownHours: policy.cooldown_hours,
      })
      pausesPersisted += 1
    } else if (
      assessment.health_tier === "healthy" &&
      sender &&
      policy.operator_override
    ) {
      await recoverSenderDeliverabilityPause(admin, {
        senderAccountId: assessment.metrics.sender_account_id,
        mailboxConnectionId: assessment.metrics.mailbox_connection_id,
        reason: "Reputation recovered — operator override active.",
        operatorOverride: true,
        overrideReason: policy.override_reason,
      })
      recoveriesRecorded += 1
    } else if (assessment.health_tier === "healthy" || assessment.health_tier === "warming") {
      const pauseState = await admin
        .schema("growth")
        .from("sender_accounts")
        .select("deliverability_paused_at")
        .eq("id", assessment.metrics.sender_account_id)
        .maybeSingle()
      if (pauseState.data && (pauseState.data as Record<string, unknown>).deliverability_paused_at) {
        await recoverSenderDeliverabilityPause(admin, {
          senderAccountId: assessment.metrics.sender_account_id,
          mailboxConnectionId: assessment.metrics.mailbox_connection_id,
          reason: "Reputation metrics recovered — automatic pause cleared.",
        })
        recoveriesRecorded += 1
      }
    }
  }

  const healthRollup = await runMailboxHealthIntelligenceRollup(admin, {
    skipReputationAssess: true,
  })

  return {
    qa_marker: GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER,
    mailbox_health_qa_marker: healthRollup.qa_marker,
    snapshot_date: snapshotDate,
    assessed_count: assessments.length,
    alerts_emitted: alertsEmitted,
    pauses_persisted: pausesPersisted,
    recoveries_recorded: recoveriesRecorded,
    mailbox_health_synced: healthRollup.synced_sender_health,
    mailbox_health_snapshots_updated: healthRollup.snapshots_updated,
  }
}
