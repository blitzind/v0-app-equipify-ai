import { PLAN_IDS, type PlanId } from "@/lib/plans"

export const ONBOARDING_TRIAL_PARAM = "scale"
export const ONBOARDING_INTENDED_PLAN_STORAGE_KEY = "equipify:onboarding:intended-plan"

function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value)
}

export function parseOnboardingPlan(value: string | null): PlanId | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return isPlanId(normalized) ? normalized : null
}

export function hasScaleTrialParam(value: string | null): boolean {
  if (!value) return false
  return value.trim().toLowerCase() === ONBOARDING_TRIAL_PARAM
}
