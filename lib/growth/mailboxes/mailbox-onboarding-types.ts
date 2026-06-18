/** GE-MAIL-1C — Mailbox onboarding wizard (client-safe). */

export const GROWTH_MAILBOX_ONBOARDING_QA_MARKER = "growth-mailbox-onboarding-1c-v1" as const

export const GROWTH_MAILBOX_ONBOARDING_STEPS = [
  "create_sender",
  "connect_gmail",
  "validate",
  "warmup",
  "pool",
  "activation",
] as const

export type GrowthMailboxOnboardingStep = (typeof GROWTH_MAILBOX_ONBOARDING_STEPS)[number]

export type GrowthMailboxOnboardingSenderSnapshot = {
  id: string
  displayName: string
  email: string
  status: string
  dailySendLimit: number
  providerFamily: string
  warmupEnabled: boolean
  healthStatus: string
  domain: string
}

export type GrowthMailboxOnboardingMailboxSnapshot = {
  id: string
  status: string
  tokenConfigured: boolean
  healthTier: string
  connectionHealth: number
  lastValidationAt: string | null
  needsReconnect: boolean
} | null

export type GrowthMailboxOnboardingWarmupSnapshot = {
  id: string
  status: string
  warmupDays: number
  currentDailyVolume: number
  warmupProgress: number
} | null

export type GrowthMailboxOnboardingPoolSnapshot = {
  poolId: string
  poolName: string
  poolStatus: string
  memberId: string
  memberStatus: string
} | null

export type GrowthMailboxOnboardingStatusPayload = {
  qa_marker: typeof GROWTH_MAILBOX_ONBOARDING_QA_MARKER
  sender: GrowthMailboxOnboardingSenderSnapshot
  mailbox: GrowthMailboxOnboardingMailboxSnapshot
  warmup: GrowthMailboxOnboardingWarmupSnapshot
  poolMembership: GrowthMailboxOnboardingPoolSnapshot
  deliveryRouteEnabled: boolean
  suggestedStep: GrowthMailboxOnboardingStep
}

export type GrowthMailboxOnboardingFinalizeResult = {
  qa_marker: typeof GROWTH_MAILBOX_ONBOARDING_QA_MARKER
  senderId: string
  warmupProfileId: string | null
  poolId: string | null
  poolMemberId: string | null
  status: GrowthMailboxOnboardingStatusPayload
}
