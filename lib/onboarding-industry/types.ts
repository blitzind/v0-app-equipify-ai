import type { FirstRunStepId } from "@/lib/first-run/types"

export type WelcomeCopyDto = {
  title: string
  paragraphs: string[]
}

export type DemoWalkthroughHintDto = {
  text: string
  href?: string
}

export type QuickActionDto = {
  label: string
  href: string
}

export type OnboardingTerminologyDto = {
  customerNoun?: string
  equipmentNoun?: string
  workOrderNoun?: string
}

export type DashboardEmptyCopyDto = {
  recentWorkOrders?: string
}

/** Keys for executive snapshot stat cards (dashboard reordering). */
export type ExecutiveStatCardId =
  | "equipment_due_this_month"
  | "overdue_service"
  | "open_work_orders"
  | "monthly_revenue"
  | "expiring_warranties"
  | "repeat_repairs"
  | "overdue_invoices"
  | "pm_plans_overdue"
  | "completed_this_month"
  | "quote_pipeline"
  | "unassigned_open_work"
  | "active_pm_plans"

export type LaunchpadStepCopyOverride = Partial<
  Record<FirstRunStepId, { label?: string; description?: string }>
>

export type OnboardingIndustryPartial = {
  operationalHint?: string
  welcomeTitle?: string
  welcomeParagraphs?: string[]
  launchpadSecondaryNote?: string
  exampleWorkflows?: string[]
  launchpadStepCopy?: LaunchpadStepCopyOverride
  demoWalkthroughHints?: DemoWalkthroughHintDto[]
  quickActions?: QuickActionDto[]
  statCardPriority?: ExecutiveStatCardId[]
  aidenSectorFraming?: string
  terminology?: OnboardingTerminologyDto
  dashboardEmptyCopy?: DashboardEmptyCopyDto
  /** Shown on self-serve signup workspace step (bullets). */
  signupExampleWorkflows?: string[]
}

export type OnboardingIndustryBundle = {
  operationalHint: string
  welcomeCopy: WelcomeCopyDto
  launchpadSecondaryNote: string
  exampleWorkflows: string[]
  launchpadStepCopy: LaunchpadStepCopyOverride
  demoWalkthroughHints: DemoWalkthroughHintDto[]
  quickActions: QuickActionDto[]
  statCardPriority: ExecutiveStatCardId[] | null
  aidenSectorFraming: string
  terminology: OnboardingTerminologyDto
  dashboardEmptyCopy: DashboardEmptyCopyDto
  signupExampleWorkflows: string[]
}
