/**
 * Smoke test for industry onboarding resolver (run: pnpm tsx scripts/test-onboarding-industry-config.ts).
 */
import { resolveOnboardingIndustryBundle } from "../lib/onboarding-industry/resolve-onboarding-industry-bundle"
import { industryOperationalHint } from "../lib/first-run/launchpad-copy"

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg)
}

const hvac = resolveOnboardingIndustryBundle("hvac_r", "HVAC-R")
assert(hvac.welcomeCopy.title.includes("HVAC"), "HVAC welcome title")
assert(hvac.launchpadStepCopy.customer?.label?.includes("commercial"), "HVAC customer step label")
assert(hvac.demoWalkthroughHints.length >= 1, "HVAC demo hints")
assert(hvac.statCardPriority?.includes("pm_plans_overdue"), "HVAC stat priority")

const rental = resolveOnboardingIndustryBundle("equipment_rental", "Equipment rental")
assert(rental.quickActions.some((a) => a.href === "/dispatch"), "Rental quick action dispatch")

const ref = resolveOnboardingIndustryBundle("refrigeration_service", "Refrigeration")
assert(ref.dashboardEmptyCopy.recentWorkOrders?.includes("emergency"), "Refrigeration empty WO copy")

assert(
  industryOperationalHint("hvac_r") === resolveOnboardingIndustryBundle("hvac_r", "HVAC-R").operationalHint,
  "launchpad-copy hint matches bundle",
)

console.log("onboarding-industry-config OK")
