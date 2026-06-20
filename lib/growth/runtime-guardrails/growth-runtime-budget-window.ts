/** GS-RG-1 — pure budget window helpers (client-safe). */

import type { GrowthRuntimeBudgetWindowKind } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function resolveBudgetWindowStart(
  windowKind: GrowthRuntimeBudgetWindowKind,
  now = Date.now(),
): string {
  const date = new Date(now)
  if (windowKind === "hourly") {
    date.setUTCMinutes(0, 0, 0)
    return date.toISOString()
  }
  if (windowKind === "daily") {
    date.setUTCHours(0, 0, 0, 0)
    return date.toISOString()
  }
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString()
}

export function shouldRollBudgetWindow(
  windowKind: GrowthRuntimeBudgetWindowKind,
  windowStart: string,
  now = Date.now(),
): boolean {
  const started = new Date(windowStart).getTime()
  const elapsed = Math.max(0, now - started)
  if (windowKind === "hourly") return elapsed >= HOUR_MS
  if (windowKind === "daily") return elapsed >= DAY_MS
  const startDate = new Date(windowStart)
  const nowDate = new Date(now)
  return (
    startDate.getUTCFullYear() !== nowDate.getUTCFullYear() ||
    startDate.getUTCMonth() !== nowDate.getUTCMonth()
  )
}

export function evaluateBudgetAllowance(
  input: {
    currentCount: number
    cap: number
    volume?: number
  },
): { allowed: boolean; remaining: number; reason: string | null } {
  const volume = Math.max(1, input.volume ?? 1)
  if (input.cap <= 0) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, reason: null }
  }
  const remaining = Math.max(0, input.cap - input.currentCount)
  if (input.currentCount + volume > input.cap) {
    return {
      allowed: false,
      remaining,
      reason: `Budget cap ${input.cap} exceeded (${input.currentCount} consumed).`,
    }
  }
  return { allowed: true, remaining: remaining - volume, reason: null }
}
