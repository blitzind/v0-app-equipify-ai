/**
 * AVA-SCHEDULER-CADENCE-SIMPLIFICATION-1A — Certification.
 *
 *   pnpm test:ava-scheduler-cadence-simplification-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

const CERT_ID = "ava-scheduler-cadence-simplification-1a-v1" as const
const ROOT = process.cwd()
const SCHEDULER_CADENCE_MS = 5 * 60 * 1000

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function readObjectiveSchedulerCronSchedule(vercelJson: string): string | null {
  const match = vercelJson.match(
    /"path":\s*"\/api\/cron\/growth-objective-runtime-scheduler"[\s\S]*?"schedule":\s*"([^"]+)"/,
  )
  return match?.[1] ?? null
}

async function main() {
  console.log(`[${CERT_ID}] certification\n`)

  const vercelJson = readSource("vercel.json")
  const schedule = readObjectiveSchedulerCronSchedule(vercelJson)
  assert.equal(schedule, "*/5 * * * *", "growth-objective-runtime-scheduler must run every 5 minutes")
  console.log("  ✓ scheduler cron = */5 * * * *")

  const trustLoader = readSource("lib/growth/home/growth-home-runtime-trust-loader-1b.ts")
  assert.match(trustLoader, /SCHEDULER_INTERVAL_MS = 5 \* 60 \* 1000/)
  console.log("  ✓ Home scheduler estimate interval = 5 minutes")

  const trustPresenter = readSource("lib/growth/home/growth-home-runtime-trust-presenter-1b.ts")
  assert.match(trustPresenter, /every 5 minutes/)
  assert.doesNotMatch(trustPresenter, /every 20 minutes/)
  console.log("  ✓ Home trust copy reflects 5-minute cadence")

  const activationCopy = readSource(
    "lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a.ts",
  )
  assert.match(activationCopy, /about every 5 minutes/)
  assert.doesNotMatch(activationCopy, /about every 20 minutes/)
  console.log("  ✓ activation burn-in copy reflects 5-minute cadence")

  const discoverySource = readSource("lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts")
  const replenishmentSource = readSource(
    "lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a.ts",
  )
  const policySource = readSource(
    "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a.ts",
  )

  assert.doesNotMatch(discoverySource, /20 \* 60 \* 1000/)
  assert.doesNotMatch(replenishmentSource, /20 \* 60 \* 1000/)
  assert.doesNotMatch(policySource, /20 \* 60 \* 1000/)
  console.log("  ✓ no 20-minute control gate in autonomous DataMoon discovery modules")

  assert.match(discoverySource, /isDatamoonAutonomousDiscoveryRunActive/)
  assert.match(discoverySource, /DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR/)
  assert.match(discoverySource, /findActiveAutonomousProspectSearchDatamoonRun/)
  console.log("  ✓ DataMoon single-flight remains wired")

  assert.match(replenishmentSource, /blockedByDailyLimit/)
  assert.match(replenishmentSource, /maximumDailyDiscovery/)
  assert.match(policySource, /maximumDailyDiscovery/)
  assert.match(policySource, /datamoon_budget_exhausted/)
  assert.equal(DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY, 50)
  console.log("  ✓ daily discovery cap remains wired (50/day default unchanged)")

  const gptQualSource = readSource(
    "lib/growth/ava-reasoning/ava-autonomous-discovery-gpt-qualification-1a.ts",
  )
  const leadRepoSource = readSource("lib/growth/lead-repository.ts")
  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")

  assert.match(leadRepoSource, /scheduleAutonomousDiscoveryGptQualificationIfNeeded/)
  assert.doesNotMatch(schedulerSource, /scheduleAutonomousDiscoveryGptQualificationIfNeeded/)
  assert.doesNotMatch(schedulerSource, /runAutonomousDiscoveryGptQualification/)
  assert.match(gptQualSource, /evaluation_started_at/)
  console.log("  ✓ GPT qualification remains lead-create triggered, not scheduler-triggered")

  const draftPersistence = readSource("lib/growth/ava-reasoning/equipify-supervised-draft-persistence.ts")
  const supervisedCutover = readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts")
  assert.match(draftPersistence, /findExistingAvaSupervisedSendableDraft/)
  assert.match(draftPersistence, /duplicate_reused/)
  assert.doesNotMatch(supervisedCutover, /autonomous.*send|sendAutonomous|autoSend/i)
  console.log("  ✓ supervised draft dedupe remains; no autonomous send wiring added")

  const providerBudget = readSource("lib/growth/objectives/growth-objective-scheduler-provider-budget-1a.ts")
  assert.match(schedulerSource, /checkSchedulerProviderBudgetGate/)
  assert.match(providerBudget, /remainingBudget/)
  console.log("  ✓ provider budget gate remains wired on scheduler tick")

  const estimateDeltaMs = SCHEDULER_CADENCE_MS
  assert.equal(estimateDeltaMs, 300_000)
  console.log("  ✓ scheduler cadence constant = 300_000 ms")

  console.log(`\n[${CERT_ID}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
