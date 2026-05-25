/** Client-safe onboarding finalization types + copy (signup plan step). */

export type OnboardingSampleDataStatus =
  | "created"
  | "already_exists"
  | "skipped"
  | "warning"
  | "failed_non_blocking"

export const ONBOARDING_SAMPLE_DATA_WARNING_STORAGE_KEY = "equipify_onboarding_sample_warning" as const

export function resolveOnboardingRedirectTarget(input: {
  inviteFlow: boolean
  selectedPlanFromQuery: boolean
  selectedPlan: string
}): string {
  if (input.inviteFlow) return "/"
  if (input.selectedPlanFromQuery) {
    return `/settings/billing?plan=${encodeURIComponent(input.selectedPlan)}&source=onboarding`
  }
  return "/"
}

export function sampleDataWarningMessage(status: OnboardingSampleDataStatus | null | undefined): string | null {
  switch (status) {
    case "failed_non_blocking":
      return "Sample data could not be loaded. Your workspace is ready — import examples anytime under Settings → Sample data."
    case "warning":
      return "Sample data may be incomplete. You can re-import examples under Settings → Sample data."
    default:
      return null
  }
}

export function isBlockingProvisioningFailure(input: {
  ok?: boolean
  organizationId?: string | null
}): boolean {
  if (input.ok) return false
  return !input.organizationId
}
