/** GS-GROWTH-WARMUP-CRON-1N — cron execution outcome helpers (client-safe). */

import type { GrowthWarmupExecutorRunResult } from "@/lib/growth/warmup/warmup-executor-types"

export function deriveWarmupCronExecutionOk(result: GrowthWarmupExecutorRunResult): boolean {
  if (result.sendsSucceeded > 0) return true
  if (result.sendsFailed > 0 && result.sendsSucceeded === 0) return false
  return true
}

export function deriveWarmupCronFailureReason(result: GrowthWarmupExecutorRunResult): string | null {
  if (deriveWarmupCronExecutionOk(result)) return null
  const runLevel = result.skipReasons[0]
  if (runLevel?.message) return runLevel.message
  const profileFailure = result.senderResults.find((row) => row.failed > 0)?.skipReasons[0]
  return profileFailure?.message ?? "All warmup profile sends failed."
}
