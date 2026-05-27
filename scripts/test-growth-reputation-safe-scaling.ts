/**
 * Regression checks for reputation-safe scaling (Phase 3).
 * Run: pnpm test:growth-reputation-safe-scaling
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER } from "../lib/growth/outbound/reputation-safe-scaling-types"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"

const SCALING_MIGRATION = "20270530120000_growth_reputation_safe_scaling.sql"

async function main(): Promise<void> {
  assert.equal(GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER, "growth-reputation-safe-scaling-v1")
  assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-sequence-recovery"))

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${SCALING_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /outbound_scheduler_decisions/)
  assert.match(migration, /throughput_snapshots/)
  assert.match(migration, /domain_segment/)

  const scheduler = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/outbound/reputation-safe-scheduler.ts"),
    "utf8",
  )
  assert.match(scheduler, /evaluateReputationSafeSchedule/)
  assert.match(scheduler, /operational_pause|pause_domain|skip/)

  const throughput = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/outbound/throughput-allocator.ts"),
    "utf8",
  )
  assert.match(throughput, /canAllocateThroughputSend/)

  const replyIntel = fs.readFileSync(path.join(process.cwd(), "lib/growth/outbound/reply-intelligence.ts"), "utf8")
  assert.match(replyIntel, /suppressFollowUp/)
  assert.match(replyIntel, /classifyCampaignReply/)

  const hardening = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/outbound/sequence-execution-hardening.ts"),
    "utf8",
  )
  assert.match(hardening, /detectStuckSequenceJobs/)
  assert.match(hardening, /recoverStuckSequenceJobs/)

  const ui = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-internal-outbound-operations-dashboard.tsx"),
    "utf8",
  )
  assert.match(ui, /GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER/)
  assert.match(ui, /throughput/)
  assert.match(ui, /allocation/)

  const queue = fs.readFileSync(path.join(process.cwd(), "lib/growth/outreach/run-outreach-queue.ts"), "utf8")
  assert.match(queue, /applyReputationSafeScheduleGate/)

  const jobRunner = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/execution/sequence-job-runner.ts"),
    "utf8",
  )
  assert.match(jobRunner, /applyReputationSafeScheduleGate/)
  assert.match(jobRunner, /shouldSuppressCampaignFollowUp/)

  console.log("growth reputation-safe scaling tests passed")
}

void main()
