/** GE-AIOS-HOTFIX-LIVE-1A — Bounded optional loaders for Home workspace summary (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"

/** Max wait for optional Home loaders (schema probes, engagement, sequences). */
export const GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS = 2_500

/** Runtime-critical Home loaders (sales outcomes, hero decision, runtime trust). */
export const GROWTH_HOME_RUNTIME_CRITICAL_LOADER_BUDGET_MS = 6_000

/** Sales outcomes fan-in can exceed generic critical budget under production load. */
export const GROWTH_HOME_SALES_OUTCOMES_LOADER_BUDGET_MS = 8_000

export type GrowthHomeLoaderTiming = {
  label: string
  durationMs: number
  timedOut: boolean
}

export async function withGrowthHomeLoaderBudget<T>(input: {
  label: string
  budgetMs?: number
  fn: () => Promise<T>
  fallback: T
}): Promise<{ value: T; timing: GrowthHomeLoaderTiming }> {
  const budgetMs = input.budgetMs ?? GROWTH_HOME_WORKSPACE_LOADER_BUDGET_MS
  const start = Date.now()
  let timedOut = false

  const value = await Promise.race([
    input.fn().catch(() => input.fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => {
        timedOut = true
        resolve(input.fallback)
      }, budgetMs)
    }),
  ])

  const timing: GrowthHomeLoaderTiming = {
    label: input.label,
    durationMs: Date.now() - start,
    timedOut,
  }

  if (timedOut) {
    logGrowthEngine("home_workspace_loader_budget_exceeded", {
      label: input.label,
      budgetMs,
      durationMs: timing.durationMs,
    })
  }

  return { value, timing }
}

export function logGrowthHomePipelineTimings(input: {
  totalMs: number
  timings: GrowthHomeLoaderTiming[]
}): void {
  const slow = input.timings.filter((row) => row.durationMs >= 500 || row.timedOut)
  if (slow.length === 0 && input.totalMs < 3_000) return

  logGrowthEngine("home_workspace_summary_pipeline_timing", {
    totalMs: input.totalMs,
    stages: input.timings.map((row) => ({
      label: row.label,
      durationMs: row.durationMs,
      timedOut: row.timedOut,
    })),
  })
}
