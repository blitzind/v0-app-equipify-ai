export const ONBOARDING_PRODUCT_EVENT_KEYS = [
  "onboarding_welcome_viewed",
  "onboarding_launchpad_viewed",
  "onboarding_demo_panel_clicked",
  "onboarding_guided_action_clicked",
  "onboarding_guided_action_completed",
  "onboarding_first_equipment_created",
  "onboarding_first_work_order_created",
  "onboarding_first_pm_plan_created",
  "onboarding_first_invoice_or_quote_created",
  "onboarding_ai_recommendation_viewed",
] as const

export type OnboardingProductEventKey = (typeof ONBOARDING_PRODUCT_EVENT_KEYS)[number]

export function isOnboardingProductEventKey(v: string): v is OnboardingProductEventKey {
  return (ONBOARDING_PRODUCT_EVENT_KEYS as readonly string[]).includes(v)
}
