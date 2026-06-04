/**
 * Phase 6.31B — mailbox health intelligence regression checks.
 * Run: pnpm test:growth-mailbox-health-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildCapacityRecommendation,
  buildHealthTrendDirection,
  buildThrottleRecommendation,
  computeMailboxHealthScore,
  deriveMailboxHealthState,
  mailboxHealthStateLabel,
} from "../lib/growth/deliverability/mailbox-health-score"
import {
  GROWTH_MAILBOX_HEALTH_INTELLIGENCE_MIGRATION,
  GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER,
  GROWTH_MAILBOX_HEALTH_STATES,
} from "../lib/growth/deliverability/mailbox-health-score-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_MAILBOX_HEALTH_INTELLIGENCE_QA_MARKER, "growth-mailbox-health-intelligence-v1")
assert.deepEqual([...GROWTH_MAILBOX_HEALTH_STATES], [
  "healthy",
  "warning",
  "at_risk",
  "critical",
  "disabled",
])

const baseAssessment = {
  metrics: {
    sender_account_id: "s1",
    mailbox_connection_id: null,
    email_address: "ops@example.com",
    daily_send_count: 10,
    rolling_7d_send_volume: 80,
    rolling_30d_send_volume: 200,
    bounce_rate: 2,
    reply_rate: 4,
    positive_reply_rate: 1,
    unsubscribe_rate: 0.2,
    spam_complaint_rate: 0.05,
    open_rate: 20,
    inactivity_days: 0,
    sequence_participation_count: 1,
    warmup_status: "warming",
    warmup_progress: 40,
  },
  risk_score: 88,
  health_tier: "warming" as const,
  risk_reasons: [],
  recommended_actions: ["Follow warmup ramp"],
  score_explanation: [],
}

const score = computeMailboxHealthScore({ assessment: baseAssessment })
assert.ok(score >= 80 && score <= 100)
assert.equal(deriveMailboxHealthState({ assessment: baseAssessment, warmup_status: "warming" }), "healthy")
assert.equal(
  deriveMailboxHealthState({
    assessment: { ...baseAssessment, risk_score: 20, health_tier: "high_risk" },
    deliverability_paused: true,
  }),
  "critical",
)
assert.equal(mailboxHealthStateLabel("at_risk"), "At risk")

assert.equal(
  buildHealthTrendDirection([
    { snapshot_date: "2026-06-01", health_score: 60, health_state: "warning", risk_score_delta: null },
    { snapshot_date: "2026-06-04", health_score: 85, health_state: "healthy", risk_score_delta: 25 },
  ]),
  "improving",
)

assert.match(buildThrottleRecommendation({ throttled: true, paused: false, reason: "Slow down" }) ?? "", /Slow down/)
assert.match(
  buildCapacityRecommendation({
    daily_capacity: 20,
    sends_today: 19,
    warmup_status: "warming",
    cap_utilization_pct: 95,
  }) ?? "",
  /remaining/i,
)

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_MAILBOX_HEALTH_INTELLIGENCE_MIGRATION}`),
  "utf8",
)
assert.match(migration, /health_score/)
assert.match(migration, /health_state/)
assert.match(migration, /delivery_success_rate/)

const intel = readSource("lib/growth/deliverability/mailbox-health-intelligence.ts")
assert.match(intel, /buildMailboxHealthIntelligenceDashboard/)
assert.match(intel, /runMailboxHealthIntelligenceRollup/)
assert.match(intel, /sender_reputation_snapshots/)

const runner = readSource("lib/growth/deliverability/reputation-snapshot-runner.ts")
assert.match(runner, /runMailboxHealthIntelligenceRollup/)

const consoleUi = readSource("components/growth/deliverability/deliverability-protection-console.tsx")
assert.match(consoleUi, /mailbox_rows/)
assert.match(consoleUi, /Mailbox health intelligence/)

console.log("growth mailbox health intelligence tests passed")
