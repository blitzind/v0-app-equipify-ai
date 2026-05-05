import type { PlanId } from "@/lib/plans"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"

export type Feature =
  | "automation"
  | "ai"
  | "reports_advanced"
  | "maintenance_plans"
  | "api_access"
  | "multi_location"
  | "priority_support"

export type PlanLimits = {
  users: number | "unlimited"
  equipment: number | "unlimited"
  /** `null` = not metered / unlimited for billing UI */
  apiCallsMonthly: number | null
}

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  solo: {
    users: 1,
    equipment: 50,
    apiCallsMonthly: null,
  },
  core: {
    users: 3,
    equipment: 250,
    apiCallsMonthly: null,
  },
  growth: {
    users: 10,
    equipment: 2500,
    apiCallsMonthly: 25000,
  },
  scale: {
    users: 25,
    equipment: "unlimited",
    apiCallsMonthly: 100000,
  },
}

const PLAN_FEATURES: Record<PlanId, Feature[]> = {
  solo: [],
  core: [],
  growth: [
    "automation",
    "ai",
    "reports_advanced",
    "maintenance_plans",
    "priority_support",
  ],
  scale: [
    "automation",
    "ai",
    "reports_advanced",
    "maintenance_plans",
    "api_access",
    "multi_location",
    "priority_support",
  ],
}

/** Active trial grants Scale-level limits (including API). */
const TRIAL_PLAN: PlanId = "scale"

function effectivePlanId(planId: PlanId | string, isTrialActive?: boolean): PlanId {
  const id = typeof planId === "string" ? normalizePlanIdForRead(planId) : planId
  return isTrialActive ? TRIAL_PLAN : id
}

export function getPlanLimits(planId: PlanId | string, isTrialActive?: boolean): PlanLimits {
  const id = effectivePlanId(planId, isTrialActive)
  return PLAN_LIMITS[id]
}

export function canUseFeature(
  planId: PlanId | string,
  feature: Feature,
  isTrialActive?: boolean,
) {
  const id = effectivePlanId(planId, isTrialActive)
  return PLAN_FEATURES[id].includes(feature)
}

export function getUsageLimits(planId: PlanId | string, isTrialActive?: boolean) {
  return getPlanLimits(planId, isTrialActive)
}

/** For UsageBar / billing: `-1` means unlimited equipment in plan config; API `null` = not capped in UI. */
export function getApiCallLimitDisplay(
  planId: PlanId | string,
  isTrialActive?: boolean,
): number | null {
  const limit = getPlanLimits(planId, isTrialActive).apiCallsMonthly
  return limit
}
