import "server-only"

import type { PlanId } from "@/lib/plans"

/** Monthly included AI budget (USD) shown in Settings — soft guidance vs org-set budget caps. */
export const PLAN_AI_INCLUDED_MONTHLY_BUDGET_USD: Record<PlanId, number> = {
  solo: 5,
  core: 25,
  growth: 75,
  scale: 200,
}

export const PLAN_TIER_RANK: Record<PlanId, number> = {
  solo: 0,
  core: 1,
  growth: 2,
  scale: 3,
}

export function planRank(plan: PlanId): number {
  return PLAN_TIER_RANK[plan] ?? 0
}

export function planMeetsMinimum(orgPlan: PlanId, minimum: PlanId): boolean {
  return planRank(orgPlan) >= planRank(minimum)
}

/**
 * When `AI_PLAN_GATING_DISABLED=1`, plan checks are skipped (development / preview by default).
 * Set `AI_ALLOW_PLAN_GATING_BYPASS_IN_PRODUCTION=1` only for controlled testing — never in customer prod.
 */
export function isPlanGatingDisabled(): boolean {
  if (process.env.AI_PLAN_GATING_DISABLED !== "1") return false
  if (process.env.AI_ALLOW_PLAN_GATING_BYPASS_IN_PRODUCTION === "1") return true
  const nodeEnv = process.env.NODE_ENV
  const vercelEnv = process.env.VERCEL_ENV
  if (nodeEnv !== "production") return true
  if (vercelEnv === "preview" || vercelEnv === "development") return true
  return false
}
