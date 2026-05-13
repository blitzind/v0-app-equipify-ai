import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import { resolveOnboardingIndustryBundle } from "@/lib/onboarding-industry/resolve-onboarding-industry-bundle"
import { WORKSPACE_INDUSTRY_DEFINITIONS } from "@/lib/workspace-industry-registry"

export function industryLabelForLaunchpad(industryRaw: string | null | undefined): string {
  const k = normalizeIndustryKey(industryRaw ?? undefined)
  return WORKSPACE_INDUSTRY_DEFINITIONS[k]?.label ?? "your sector"
}

/** One-line operational hint for the launchpad intro (customer-facing). */
export function industryOperationalHint(industryRaw: string | null | undefined): string {
  const label = industryLabelForLaunchpad(industryRaw)
  return resolveOnboardingIndustryBundle(industryRaw, label).operationalHint
}
