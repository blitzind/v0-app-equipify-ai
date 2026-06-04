/**
 * Phase 6.35B — deliverability & warmup production hardening regression checks.
 * Run: pnpm test:growth-deliverability-production-hardening
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  DEFAULT_MAILBOX_SEND_POLICY,
  evaluateSendThrottle,
} from "../lib/growth/deliverability/send-throttle-engine"
import { computeMailboxReputationAssessment } from "../lib/growth/deliverability/mailbox-reputation-engine"
import { GROWTH_DELIVERABILITY_PRODUCTION_HARDENING_QA_MARKER } from "../lib/growth/deliverability/reputation-protection-types"
import { GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER } from "../lib/growth/warmup/warmup-execution-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(
    GROWTH_DELIVERABILITY_PRODUCTION_HARDENING_QA_MARKER,
    "growth-deliverability-production-hardening-v1",
  )
  assert.equal(GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER, "growth-native-warmup-execution-v1")

  const readiness = readSource("lib/growth/infrastructure/infrastructure-readiness.ts")
  assert.match(readiness, /resolveWarmupReadiness/)
  assert.doesNotMatch(readiness, /Warmup execution is not enabled/)
  assert.match(readiness, /Native warmup pre-send guards/)

  const preSend = readSource("lib/growth/deliverability/reputation-protection-pre-send.ts")
  assert.match(preSend, /countSenderSendsLastHour/)
  assert.match(preSend, /countActiveSequenceEnrollmentsForSender/)
  assert.match(preSend, /sends_last_hour: sendsLastHour/)
  assert.match(preSend, /blockCode: "reputation_throttled"/)
  assert.match(preSend, /throttle\.throttled/)

  const repo = readSource("lib/growth/deliverability/mailbox-reputation-repository.ts")
  assert.match(repo, /export async function countSenderSendsLastHour/)
  assert.match(repo, /export async function countActiveSequenceEnrollmentsForSender/)

  const intel = readSource("lib/growth/deliverability/mailbox-health-intelligence.ts")
  assert.match(intel, /from\("warmup_profiles"\)/)
  assert.doesNotMatch(intel, /warmupProgress: sender\.warmup_enabled \? 50 : 100/)

  const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(transport, /transportFailureEligibleForPoolSenderFailover/)
  assert.match(transport, /poolFallbackSenders/)
  assert.match(transport, /used_pool_sender_failover/)

  const hourlyCap = evaluateSendThrottle({
    policy: { ...DEFAULT_MAILBOX_SEND_POLICY, sender_account_id: "sa-h", hourly_send_cap: 5 },
    assessment: computeMailboxReputationAssessment({
      metrics: {
        sender_account_id: "sa-h",
        mailbox_connection_id: null,
        email_address: "hourly@example.com",
        daily_send_count: 3,
        rolling_7d_send_volume: 20,
        rolling_30d_send_volume: 40,
        bounce_rate: 0,
        reply_rate: 2,
        positive_reply_rate: 1,
        unsubscribe_rate: 0,
        spam_complaint_rate: 0,
        open_rate: 10,
        inactivity_days: 0,
        sequence_participation_count: 1,
        warmup_status: "warming",
        warmup_progress: 50,
      },
      sender_status: "active",
      daily_cap_utilization_pct: 20,
    }),
    sends_last_hour: 5,
  })
  assert.equal(hourlyCap.allowed, false)
  assert.equal(hourlyCap.rule_id, "hourly_cap")

  const cautionAssessment = computeMailboxReputationAssessment({
    metrics: {
      sender_account_id: "sa-s",
      mailbox_connection_id: null,
      email_address: "soft@example.com",
      daily_send_count: 5,
      rolling_7d_send_volume: 30,
      rolling_30d_send_volume: 60,
      bounce_rate: 4,
      reply_rate: 2,
      positive_reply_rate: 1,
      unsubscribe_rate: 0.5,
      spam_complaint_rate: 0,
      open_rate: 12,
      inactivity_days: 0,
      sequence_participation_count: 1,
      warmup_status: "active",
      warmup_progress: 100,
    },
    sender_status: "active",
    daily_cap_utilization_pct: 100,
  })
  assert.equal(cautionAssessment.health_tier, "caution")
  const softThrottle = evaluateSendThrottle({
    policy: { ...DEFAULT_MAILBOX_SEND_POLICY, sender_account_id: "sa-s" },
    assessment: cautionAssessment,
  })
  assert.equal(softThrottle.throttled, true)
  assert.equal(softThrottle.allowed, true)
  assert.equal(softThrottle.rule_id, "reputation_throttle")

  console.log("growth-deliverability-production-hardening: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
