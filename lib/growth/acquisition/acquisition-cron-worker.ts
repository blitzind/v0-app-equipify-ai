import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listRunnableBulkAcquisitionRuns } from "@/lib/growth/acquisition/acquisition-repository"
import { tickBulkAcquisitionRun } from "@/lib/growth/acquisition/bulk-acquisition-runner"

export type BulkAcquisitionCronResult = {
  runs_processed: number
  ticks_executed: number
  runs_completed: number
  runs: Array<{
    run_id: string
    ticks: number
    done: boolean
    phase: string
  }>
}

export async function processBulkAcquisitionRuns(
  admin: SupabaseClient,
  options?: {
    maxRuns?: number
    maxTicksPerRun?: number
    maxDurationMs?: number
  },
): Promise<BulkAcquisitionCronResult> {
  const maxRuns = Math.min(Math.max(options?.maxRuns ?? 3, 1), 10)
  const maxTicksPerRun = Math.min(Math.max(options?.maxTicksPerRun ?? 20, 1), 50)
  const maxDurationMs = Math.min(Math.max(options?.maxDurationMs ?? 110_000, 5_000), 280_000)
  const startedMs = Date.now()

  const runnable = await listRunnableBulkAcquisitionRuns(admin, maxRuns)
  const runs: BulkAcquisitionCronResult["runs"] = []
  let ticksExecuted = 0
  let runsCompleted = 0

  for (const run of runnable) {
    if (Date.now() - startedMs >= maxDurationMs) break

    let ticks = 0
    let done = false
    let phase = run.state.phase
    let currentRunId = run.id

    for (let i = 0; i < maxTicksPerRun; i++) {
      if (Date.now() - startedMs >= maxDurationMs) break

      const tick = await tickBulkAcquisitionRun(admin, currentRunId, {
        created_by: run.created_by,
      })
      if (!tick) break

      ticks += 1
      ticksExecuted += 1
      done = tick.done
      phase = tick.phase
      currentRunId = tick.run.id

      if (tick.done) break
    }

    if (done) runsCompleted += 1
    runs.push({ run_id: currentRunId, ticks, done, phase })
  }

  return {
    runs_processed: runs.length,
    ticks_executed: ticksExecuted,
    runs_completed: runsCompleted,
    runs,
  }
}
