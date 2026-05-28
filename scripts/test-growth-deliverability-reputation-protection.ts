/**
 * Regression checks for Growth Deliverability & Reputation Protection v1 + H1 hardening.
 * Run: pnpm test:growth-deliverability-reputation-protection
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeMailboxReputationAssessment } from "../lib/growth/deliverability/mailbox-reputation-engine"
import { evaluateDeliverabilityRiskAlerts } from "../lib/growth/deliverability/reputation-risk-alerts"
import {
  DEFAULT_MAILBOX_SEND_POLICY,
  evaluateSendThrottle,
  governanceEventTypeForThrottle,
} from "../lib/growth/deliverability/send-throttle-engine"
import { buildWarmupRampGuidance } from "../lib/growth/deliverability/warmup-ramp-engine"
import {
  GROWTH_DELIVERABILITY_GOVERNANCE_EVENT_TYPES,
  GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER,
  GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER,
  GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER,
  GROWTH_MAILBOX_REPUTATION_HEALTH_TIERS,
  GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER,
  GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER,
  GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER,
} from "../lib/growth/deliverability/reputation-protection-types"
import {
  GROWTH_DELIVERABILITY_H1_HARDENING_MIGRATION,
  GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_MIGRATION,
} from "../lib/growth/deliverability/reputation-protection-schema-health"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER, "growth-deliverability-reputation-protection-v1")
  assert.equal(GROWTH_DELIVERABILITY_H1_HARDENING_QA_MARKER, "growth-deliverability-h1-hardening-v1")
  assert.equal(GROWTH_MAILBOX_REPUTATION_INTELLIGENCE_QA_MARKER, "growth-mailbox-reputation-intelligence-v1")
  assert.equal(GROWTH_SEND_THROTTLE_ENGINE_QA_MARKER, "growth-send-throttle-engine-v1")
  assert.equal(GROWTH_WARMUP_RAMP_ENGINE_QA_MARKER, "growth-warmup-ramp-engine-v1")
  assert.equal(GROWTH_DELIVERABILITY_GOVERNANCE_QA_MARKER, "growth-deliverability-governance-v1")
  assert.equal(GROWTH_MAILBOX_REPUTATION_HEALTH_TIERS.length, 6)
  assert.equal(GROWTH_DELIVERABILITY_GOVERNANCE_EVENT_TYPES.length, 8)
  assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-reputation-snapshot"))

  const migration = readSource(`supabase/migrations/${GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_MIGRATION}`)
  assert.match(migration, /mailbox_reputation_snapshots/)
  assert.match(migration, /mailbox_send_policies/)
  assert.match(migration, /deliverability_governance_events/)
  assert.match(migration, /health_tier/)

  const h1Migration = readSource(`supabase/migrations/${GROWTH_DELIVERABILITY_H1_HARDENING_MIGRATION}`)
  assert.match(h1Migration, /deliverability_paused_at/)
  assert.match(h1Migration, /risk_score_delta/)

  const repo = readSource("lib/growth/deliverability/mailbox-reputation-repository.ts")
  assert.match(repo, /aggregateMailboxEngagementMetrics/)
  assert.match(repo, /reply_rate: engagementRates\.reply_rate/)

  const healthy = computeMailboxReputationAssessment({
    metrics: {
      sender_account_id: "sa-1",
      mailbox_connection_id: null,
      email_address: "ops@example.com",
      daily_send_count: 10,
      rolling_7d_send_volume: 80,
      rolling_30d_send_volume: 200,
      bounce_rate: 1,
      reply_rate: 4,
      positive_reply_rate: 2,
      unsubscribe_rate: 0.2,
      spam_complaint_rate: 0,
      open_rate: 20,
      inactivity_days: 2,
      sequence_participation_count: 1,
      warmup_status: "warming",
      warmup_progress: 40,
    },
    sender_status: "active",
    daily_cap_utilization_pct: 40,
  })
  assert.equal(healthy.health_tier, "warming")
  assert.ok(healthy.risk_score >= 60)

  const risky = computeMailboxReputationAssessment({
    metrics: {
      sender_account_id: "sa-2",
      mailbox_connection_id: null,
      email_address: "risk@example.com",
      daily_send_count: 50,
      rolling_7d_send_volume: 400,
      rolling_30d_send_volume: 900,
      bounce_rate: 9,
      reply_rate: 0.5,
      positive_reply_rate: 0,
      unsubscribe_rate: 2.5,
      spam_complaint_rate: 0.4,
      open_rate: 5,
      inactivity_days: 0,
      sequence_participation_count: 6,
      warmup_status: "active",
      warmup_progress: null,
    },
    sender_status: "active",
    daily_cap_utilization_pct: 100,
  })
  assert.ok(risky.risk_score < 40)
  assert.match(risky.health_tier, /paused|high_risk|protected/)

  const alerts = evaluateDeliverabilityRiskAlerts({
    assessment: risky,
    previousReplyRate: 4,
    dailyCapUtilizationPct: 100,
  })
  assert.ok(alerts.some((row) => row.rule_id === "bounce_spike"))
  assert.ok(alerts.some((row) => row.rule_id === "reply_collapse"))

  const throttle = evaluateSendThrottle({
    policy: { ...DEFAULT_MAILBOX_SEND_POLICY, sender_account_id: "sa-2" },
    assessment: risky,
  })
  assert.equal(throttle.paused, true)
  assert.equal(governanceEventTypeForThrottle(throttle), "bounce_threshold_triggered")

  const warmup = buildWarmupRampGuidance({
    sender_email: "warm@example.com",
    warmup_enabled: true,
    warmup_status: "warming",
    warmup_progress: 30,
    target_daily_volume: 50,
    current_daily_volume: 15,
    daily_increment: 5,
    warmup_days: 21,
    daily_send_used: 20,
    bounce_rate: 6,
  })
  assert.equal(warmup.unsafe_to_scale, true)
  assert.ok(warmup.guidance.some((line) => /unsafe/i.test(line)))

  const preSend = readSource("lib/growth/compliance/pre-send-infrastructure-guards.ts")
  assert.match(preSend, /evaluateReputationProtectionPreSend/)
  assert.match(preSend, /reputation_paused/)

  const reputationPreSend = readSource("lib/growth/deliverability/reputation-protection-pre-send.ts")
  assert.match(reputationPreSend, /loadSenderDeliverabilityPauseState/)
  assert.match(reputationPreSend, /persistSenderDeliverabilityPause/)

  const outreachPreflight = readSource("lib/growth/outreach/outreach-preflight.ts")
  assert.match(outreachPreflight, /resolveOutreachPreflightSenderAccountId/)
  assert.match(outreachPreflight, /senderAccountId/)

  const cronRoute = readSource("app/api/cron/growth-reputation-snapshot/route.ts")
  assert.match(cronRoute, /runGrowthReputationSnapshotRollup/)

  const apiRoute = readSource("app/api/platform/growth/deliverability/protection/console/route.ts")
  assert.match(apiRoute, /buildDeliverabilityProtectionConsole/)

  const page = readSource("app/(admin)/admin/growth/deliverability/page.tsx")
  assert.match(page, /GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER/)
  assert.match(page, /Protection/)

  const dashboard = readSource("components/growth/growth-reputation-protection-dashboard.tsx")
  assert.match(dashboard, /deliverability-protection-console/)
  assert.match(dashboard, /GrowthDeliverabilityProtectionConsole/)

  const nav = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(nav, /label: "Protection"/)
  assert.match(nav, /Deliverability Ops/)
  assert.match(nav, /Deliverability Infrastructure/)

  const governance = readSource("lib/growth/deliverability/deliverability-governance-events.ts")
  assert.match(governance, /appendDeliverabilityGovernanceEvent/)
  assert.match(governance, /recordDeliveryTimelineEvent/)

  console.log("growth-deliverability-reputation-protection: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
