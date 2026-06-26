/**
 * GS-WARMUP-FIX-1A — Recipient pool skip reason + diagnostics certification.
 * Run: pnpm test:gs-warmup-fix-1a-recipient-pool
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  computeWarmupRecipientPoolHealth,
  GROWTH_WARMUP_RECIPIENT_POOL_FIX_1A_QA_MARKER,
  resolveWarmupRecipientSelectionFailure,
} from "../lib/growth/warmup/warmup-recipient-pool-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[GS-WARMUP-FIX-1A] Recipient pool fix certification`)

assert.equal(GROWTH_WARMUP_RECIPIENT_POOL_FIX_1A_QA_MARKER, "growth-warmup-recipient-pool-fix-1a-v1")

const selectorSource = readSource("lib/growth/warmup/warmup-recipient-selector.ts")
assert.match(selectorSource, /resolveWarmupRecipientSelectionFailure/)
assert.match(selectorSource, /analyzeWarmupRecipientSelection/)
const poolHealthSource = readSource("lib/growth/warmup/warmup-recipient-pool-health.ts")
assert.match(poolHealthSource, /per_sender_dedup_exhausted/)

const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
assert.match(executorSource, /getMailboxConnectionBySender/)
assert.match(executorSource, /selection\.metadata/)

const uiSource = readSource("components/growth/growth-warmup-executor-panel.tsx")
assert.match(uiSource, /Recipients available for this sender/)
assert.match(uiSource, /Per-sender dedup exhausted/)

const failure = resolveWarmupRecipientSelectionFailure({
  diagnostics: {
    totalApprovedRecipients: 4,
    recipientsWithRemainingCapacity: 4,
    excludedBySenderDedup: 4,
    excludedByDailyCap: 0,
    excludedByWeeklyCap: 0,
    availableForSender: 0,
  },
})
assert.equal(failure.code, "per_sender_dedup_exhausted")
assert.match(failure.message, /every available approved recipient/i)
console.log("  ✓ Dedup exhaustion maps to per_sender_dedup_exhausted")

const dailyCapFailure = resolveWarmupRecipientSelectionFailure({
  diagnostics: {
    totalApprovedRecipients: 4,
    recipientsWithRemainingCapacity: 0,
    excludedBySenderDedup: 0,
    excludedByDailyCap: 4,
    excludedByWeeklyCap: 0,
    availableForSender: 0,
  },
})
assert.equal(dailyCapFailure.code, "recipient_daily_cap")
console.log("  ✓ True daily cap maps to recipient_daily_cap")

const healthCritical = computeWarmupRecipientPoolHealth({
  approvedRecipients: 4,
  availableGlobally: 4,
  availableForSender: 0,
  warmingSenderCount: 6,
})
assert.equal(healthCritical.tier, "critical")
assert.ok(healthCritical.recommendations.length > 0)
console.log("  ✓ Pool health critical when senders exceed recipient diversity")

const healthWarning = computeWarmupRecipientPoolHealth({
  approvedRecipients: 8,
  availableGlobally: 8,
  availableForSender: 2,
  warmingSenderCount: 6,
})
assert.equal(healthWarning.tier, "warning")
console.log("  ✓ Pool health warning for thin recipient network")

console.log("[GS-WARMUP-FIX-1A] Running regressions…")
for (const script of [
  "test:growth-warmup-fairness-1p",
  "test:growth-warmup-executor-1e",
  "test:growth-warmup-health-fix-1k",
]) {
  const result = spawnSync("pnpm", [script], { stdio: "inherit", shell: true })
  assert.equal(result.status, 0, `${script} regression failed`)
}

console.log("[GS-WARMUP-FIX-1A] PASS")
