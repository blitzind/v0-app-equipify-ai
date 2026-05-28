/**
 * Regression checks for Growth Outbound Reliability H2.
 * Run: pnpm test:growth-outbound-reliability-h2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { classifyProviderFailure, isRetryEligibleFailureClass } from "../lib/growth/outbound/provider-failure-classifier"
import {
  GROWTH_OUTBOUND_RELIABILITY_H2_MIGRATION,
  GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER,
  GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES,
  GROWTH_PROVIDER_FAILURE_CLASSES,
} from "../lib/growth/outbound/outbound-reliability-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER, "growth-outbound-reliability-h2-v1")
  assert.equal(GROWTH_PROVIDER_FAILURE_CLASSES.length, 10)
  assert.equal(GROWTH_OUTBOUND_RELIABILITY_MAX_RETRIES, 3)

  const migration = readSource(`supabase/migrations/${GROWTH_OUTBOUND_RELIABILITY_H2_MIGRATION}`)
  assert.match(migration, /send_plane/)
  assert.match(migration, /outreach_queue_id/)
  assert.match(migration, /dead_letter/)
  assert.match(migration, /failure_class/)

  const reputationBlocked = classifyProviderFailure({
    message: "Blocked by deliverability reputation protection",
    blockCode: "reputation_paused",
  })
  assert.equal(reputationBlocked.failure_class, "reputation_blocked")
  assert.equal(reputationBlocked.retry_eligible, false)

  const rateLimit = classifyProviderFailure({ message: "429 rate limit exceeded", code: "rate_limit" })
  assert.equal(rateLimit.failure_class, "rate_limit")
  assert.equal(isRetryEligibleFailureClass(rateLimit.failure_class), true)

  const execute = readSource("lib/growth/outreach/execute-outreach.ts")
  assert.match(execute, /runOutreachExecutionGuard/)
  assert.match(execute, /beginAdapterDeliveryAttempt/)
  assert.match(execute, /markOutreachQueueFailure/)
  assert.match(execute, /assertGrowthProductionRuntimeSafe/)

  const guard = readSource("lib/growth/outreach/outreach-execution-guard.ts")
  assert.match(guard, /applyReputationSafeScheduleGate/)
  assert.match(guard, /runGrowthOutreachPreflight/)

  const recovery = readSource("lib/growth/outreach/outreach-queue-recovery.ts")
  assert.match(recovery, /replayGrowthOutreachQueueItem/)
  assert.match(recovery, /dead_letter/)

  const alerts = readSource("lib/growth/operations/outbound-queue-health-alerts.ts")
  assert.match(alerts, /scheduled_overdue/)
  assert.match(alerts, /queue_lag_high/)

  const dashboard = readSource("lib/growth/operations/outbound-operations-dashboard.ts")
  assert.match(dashboard, /recovery_queue/)
  assert.match(dashboard, /h2_qa_marker/)

  const ui = readSource("components/growth/growth-outbound-operations-dashboard.tsx")
  assert.match(ui, /GROWTH_OUTBOUND_RELIABILITY_H2_QA_MARKER/)
  assert.match(ui, /Failed outreach recovery/)

  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/outreach/queue/[queueId]/replay/route.ts")))
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/outreach/queue/[queueId]/preflight/route.ts")))

  console.log("growth-outbound-reliability-h2: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
