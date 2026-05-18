import { PLAN_IDS, type PlanId } from "@/lib/plans"

export const ONBOARDING_TRIAL_PARAM = "scale"
export const ONBOARDING_INTENDED_PLAN_STORAGE_KEY = "equipify:onboarding:intended-plan"
export const ONBOARDING_INTENT_STORAGE_KEY = "equipify:onboarding:intent"
export const ONBOARDING_TEAM_SIZE_VALUES = ["1-3", "4-10", "11-25", "26-50", "51-100", "100+"] as const

export type OnboardingTeamSize = (typeof ONBOARDING_TEAM_SIZE_VALUES)[number]

export type OnboardingIntent = {
  selectedPlan: PlanId
  trial: "scale"
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  industry?: string
  teamSize?: OnboardingTeamSize
  currentSystem?: string
  howHeardAboutEquipify?: string
  howHeardAboutEquipifyOther?: string
}

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

export function parseOnboardingIndustry(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return normalized
}

export function parseOnboardingTeamSize(value: string | null): OnboardingTeamSize | null {
  if (!value) return null
  const normalized = value.trim()
  return (ONBOARDING_TEAM_SIZE_VALUES as readonly string[]).includes(normalized)
    ? (normalized as OnboardingTeamSize)
    : null
}

export function parseOnboardingText(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}
