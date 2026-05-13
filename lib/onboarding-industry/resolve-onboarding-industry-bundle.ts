import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import { ONBOARDING_INDUSTRY_PARTIALS } from "@/lib/onboarding-industry/industry-overrides"
import { OPERATIONAL_HINTS } from "@/lib/onboarding-industry/operational-hints"
import type { FirstRunStepId } from "@/lib/first-run/types"
import type {
  DashboardEmptyCopyDto,
  ExecutiveStatCardId,
  LaunchpadStepCopyOverride,
  OnboardingIndustryBundle,
  OnboardingIndustryPartial,
  OnboardingTerminologyDto,
  WelcomeCopyDto,
} from "@/lib/onboarding-industry/types"

export const DEFAULT_EXECUTIVE_STAT_CARD_ORDER: ExecutiveStatCardId[] = [
  "equipment_due_this_month",
  "overdue_service",
  "open_work_orders",
  "monthly_revenue",
  "expiring_warranties",
  "repeat_repairs",
  "overdue_invoices",
  "pm_plans_overdue",
  "completed_this_month",
  "quote_pipeline",
  "unassigned_open_work",
  "active_pm_plans",
]

const DEFAULT_LAUNCHPAD_SECONDARY =
  "Example jobs and invoices are for practice — add your own anytime."

const DEFAULT_AIDEN_FRAMING =
  "This is a field service and asset maintenance workspace. Keep recommendations grounded in snapshot facts; use generic dispatch, PM, billing, and collections language when vertical-specific cues are missing."

function buildDefaultWelcomeCopy(industryLabel: string): WelcomeCopyDto {
  return {
    title: "Welcome to your workspace",
    paragraphs: [
      "We have already added example customers, jobs, and billing so you can explore a realistic workflow — not an empty shell.",
      `Your workspace is tuned for ${industryLabel}. Add your own records whenever you like; they stay separate from the examples.`,
      "Removing example data later clears only those labeled items — nothing you create is touched. You can bring examples back anytime under Settings → Sample data.",
    ],
  }
}

function mergeTerminology(a: OnboardingTerminologyDto, b?: OnboardingTerminologyDto): OnboardingTerminologyDto {
  if (!b) return { ...a }
  return { ...a, ...b }
}

function mergeDashboardEmpty(a: DashboardEmptyCopyDto, b?: DashboardEmptyCopyDto): DashboardEmptyCopyDto {
  if (!b) return { ...a }
  return { ...a, ...b }
}

function mergeLaunchpadSteps(
  base: LaunchpadStepCopyOverride,
  extra?: LaunchpadStepCopyOverride,
): LaunchpadStepCopyOverride {
  if (!extra) return { ...base }
  const out: LaunchpadStepCopyOverride = { ...base }
  for (const [k, v] of Object.entries(extra) as [FirstRunStepId, { label?: string; description?: string }][]) {
    out[k] = { ...base[k], ...v }
  }
  return out
}

function mergePartial(into: OnboardingIndustryBundle, partial: OnboardingIndustryPartial): OnboardingIndustryBundle {
  return {
    operationalHint: partial.operationalHint ?? into.operationalHint,
    welcomeCopy: {
      title: partial.welcomeTitle ?? into.welcomeCopy.title,
      paragraphs: partial.welcomeParagraphs ?? into.welcomeCopy.paragraphs,
    },
    launchpadSecondaryNote: partial.launchpadSecondaryNote ?? into.launchpadSecondaryNote,
    exampleWorkflows: partial.exampleWorkflows ?? into.exampleWorkflows,
    launchpadStepCopy: mergeLaunchpadSteps(into.launchpadStepCopy, partial.launchpadStepCopy),
    demoWalkthroughHints: partial.demoWalkthroughHints ?? into.demoWalkthroughHints,
    quickActions: partial.quickActions ?? into.quickActions,
    statCardPriority: partial.statCardPriority ?? into.statCardPriority,
    aidenSectorFraming: partial.aidenSectorFraming ?? into.aidenSectorFraming,
    terminology: mergeTerminology(into.terminology, partial.terminology),
    dashboardEmptyCopy: mergeDashboardEmpty(into.dashboardEmptyCopy, partial.dashboardEmptyCopy),
    signupExampleWorkflows: partial.signupExampleWorkflows ?? into.signupExampleWorkflows,
  }
}

/**
 * Reorder stat card ids: `priority` first (deduped), then remaining defaults in original order.
 */
export function resolveStatCardOrder(priority: ExecutiveStatCardId[] | null | undefined): ExecutiveStatCardId[] {
  if (!priority?.length) return [...DEFAULT_EXECUTIVE_STAT_CARD_ORDER]
  const seen = new Set<ExecutiveStatCardId>()
  const head: ExecutiveStatCardId[] = []
  for (const id of priority) {
    if (seen.has(id)) continue
    seen.add(id)
    head.push(id)
  }
  for (const id of DEFAULT_EXECUTIVE_STAT_CARD_ORDER) {
    if (seen.has(id)) continue
    seen.add(id)
    head.push(id)
  }
  return head
}

/**
 * Central resolver for industry-aware onboarding / first-run / dashboard copy.
 * Server and client safe (no IO).
 */
export function resolveOnboardingIndustryBundle(
  industryRaw: string | null | undefined,
  industryLabel: string,
): OnboardingIndustryBundle {
  const key = normalizeIndustryKey(industryRaw ?? undefined) as WorkspaceIndustryKey

  const base: OnboardingIndustryBundle = {
    operationalHint: OPERATIONAL_HINTS[key],
    welcomeCopy: buildDefaultWelcomeCopy(industryLabel),
    launchpadSecondaryNote: DEFAULT_LAUNCHPAD_SECONDARY,
    exampleWorkflows: [],
    launchpadStepCopy: {},
    demoWalkthroughHints: [],
    quickActions: [
      { label: "Work orders", href: "/work-orders" },
      { label: "Customers", href: "/customers" },
      { label: "Equipment", href: "/equipment" },
    ],
    statCardPriority: null,
    aidenSectorFraming: DEFAULT_AIDEN_FRAMING,
    terminology: {},
    dashboardEmptyCopy: {},
    signupExampleWorkflows: [],
  }

  const partial = ONBOARDING_INDUSTRY_PARTIALS[key]
  if (!partial) return base
  return mergePartial(base, partial)
}
