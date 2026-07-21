/** GE-AIOS-LAUNCH-1C — Ava activation & employee mode types (client-safe). */

export const GROWTH_AVA_ACTIVATION_1C_QA_MARKER = "ge-aios-launch-1c-ava-activation-v1" as const

export const GROWTH_AVA_ACTIVATION_API_PATH = "/api/growth/workspace/ava/activate" as const

export type GrowthAvaActivationReadinessBlocker = {
  id: string
  label: string
  summary: string
}

export type GrowthAvaActivationReadiness = {
  qaMarker: typeof GROWTH_AVA_ACTIVATION_1C_QA_MARKER
  ready: boolean
  blockers: GrowthAvaActivationReadinessBlocker[]
}

export type GrowthAvaEmploymentStats = {
  qaMarker: typeof GROWTH_AVA_ACTIVATION_1C_QA_MARKER
  activatedAt: string | null
  activatedLabel: string | null
  daysActive: number | null
  companiesResearched: number
  opportunitiesPrepared: number
  approvalsCompleted: number | null
  companiesRejected: number | null
  discoveryCyclesToday: number | null
  autonomousMinutesToday: number | null
}

export type GrowthAvaActivationState = {
  qaMarker: typeof GROWTH_AVA_ACTIVATION_1C_QA_MARKER
  activated: boolean
  activatedAt: string | null
  autonomyEnabled: boolean
  objectiveModeEnabled: boolean
  readiness: GrowthAvaActivationReadiness
  employment: GrowthAvaEmploymentStats | null
}

export type GrowthAvaActivationApiResponse = {
  ok: boolean
  qa_marker: typeof GROWTH_AVA_ACTIVATION_1C_QA_MARKER
  activation: GrowthAvaActivationState
  immediateTick?: import("@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a").GrowthAvaActivationImmediateTick | null
  error?: string
}

export const GROWTH_AVA_ACTIVATION_SCREEN_TITLE = "Ava is ready" as const

export const GROWTH_AVA_ACTIVATION_SCREEN_INTRO =
  "I've learned about your company and your Growth Profile. I'm ready to begin building your sales pipeline." as const

export const GROWTH_AVA_ACTIVATION_SCREEN_PROMISES = [
  "Discover companies that match your Growth Profile",
  "Research decision makers and buying committees",
  "Build review-ready opportunity packages",
  "Continue working while you're away",
  "Never send outreach without your approval",
] as const

export const GROWTH_AVA_ACTIVATION_CTA = "Activate Ava" as const

export const GROWTH_AVA_ACTIVATION_OUTBOUND_NOTE =
  "Outbound messaging remains disabled until you explicitly enable it." as const
