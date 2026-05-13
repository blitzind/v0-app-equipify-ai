export type {
  DemoWalkthroughHintDto,
  ExecutiveStatCardId,
  LaunchpadStepCopyOverride,
  OnboardingIndustryBundle,
  OnboardingIndustryPartial,
  QuickActionDto,
  WelcomeCopyDto,
} from "@/lib/onboarding-industry/types"
export { ONBOARDING_INDUSTRY_PARTIALS } from "@/lib/onboarding-industry/industry-overrides"
export { OPERATIONAL_HINTS } from "@/lib/onboarding-industry/operational-hints"
export {
  DEFAULT_EXECUTIVE_STAT_CARD_ORDER,
  resolveOnboardingIndustryBundle,
  resolveStatCardOrder,
} from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"
export { goldenPathActionsForIndustry, GOLDEN_PATH_REGISTRY_VERSION } from "@/lib/onboarding-industry/golden-path-registry"
export { recommendedModulesForIndustry } from "@/lib/onboarding-industry/recommended-modules-registry"
export { evaluateGoldenPathRule } from "@/lib/onboarding-industry/golden-path-completion"
export type { GoldenPathActionDefinition, GoldenPathCompletionRule } from "@/lib/onboarding-industry/golden-path-types"
