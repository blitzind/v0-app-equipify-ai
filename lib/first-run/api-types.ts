import type {
  DemoWalkthroughHintDto,
  ExecutiveStatCardId,
  OnboardingTerminologyDto,
  WelcomeCopyDto,
} from "@/lib/onboarding-industry/types"
import type { FirstRunStepId } from "@/lib/first-run/types"

export type FirstRunStepDto = {
  id: FirstRunStepId
  label: string
  description: string
  done: boolean
  href: string
  applicable: boolean
}

export type FirstRunGetResponse = {
  industry: string | null
  industryLabel: string
  industryHint: string
  welcomeCopy: WelcomeCopyDto
  launchpadSecondaryNote: string
  exampleWorkflows: string[]
  demoWalkthroughHints: DemoWalkthroughHintDto[]
  quickActions: { label: string; href: string }[]
  statCardPriority: ExecutiveStatCardId[] | null
  aidenSectorFraming: string
  terminology: OnboardingTerminologyDto
  dashboardEmptyCopy: { recentWorkOrders?: string }
  signupExampleWorkflows: string[]
  hasSampleWorkspace: boolean
  demoSeedSucceeded: boolean
  welcomeAckedForOrg: boolean
  launchpadHiddenForOrg: boolean
  counts: Record<string, number>
  steps: FirstRunStepDto[]
  resourceLinks: { label: string; href: string }[]
}
