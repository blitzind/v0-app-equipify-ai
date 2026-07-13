/**
 * GE-AIOS-AUTONOMY-1C — Map Draft Factory durable states to SV1-2 capacity classes.
 * Client-safe. Does not invent investment or portfolio scores.
 */

import type { AiOsDraftFactoryDurableState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import type { AiOsPortfolioCapacityClass } from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"
import type { AiOsScarceResourceClass } from "@/lib/growth/resource-allocation/resource-allocation-types"

export const GROWTH_AIOS_AUTONOMY_1C_QA_MARKER =
  "ge-aios-autonomy-1c-portfolio-aware-due-scheduler-v1" as const

/**
 * Stage → capacity class for due-tick bucketing.
 * Returns null when the durable state should not consume a due-advance slot
 * (terminal / portfolio-deferred handled elsewhere).
 */
export function mapDurableStateToPortfolioCapacityClass(
  state: AiOsDraftFactoryDurableState | string,
): AiOsPortfolioCapacityClass | null {
  switch (state) {
    case "waiting_for_research":
      return "website_research"
    case "research_complete":
      return "cheap_validation"
    case "waiting_for_dm":
      return "decision_maker_discovery"
    case "waiting_for_contact_verification":
      return "datamoon_person_enrichment"
    case "waiting_for_personalization":
    case "waiting_for_generation":
    case "draft_ready":
      return "llm_drafting"
    case "paused":
    case "rejected":
    case "waiting_for_approval":
    case "approved":
    case "executed":
    case "failed":
      return null
    default:
      return null
  }
}

/** SV1-2 capacity class → SV1-1 scarce resource class for investment projection. */
export function mapPortfolioCapacityClassToResourceClass(
  capacityClass: AiOsPortfolioCapacityClass,
): AiOsScarceResourceClass {
  switch (capacityClass) {
    case "website_research":
    case "cheap_validation":
      return "website_research"
    case "decision_maker_discovery":
    case "datamoon_person_enrichment":
    case "datamoon_company_enrichment":
      return "datamoon_enrichment"
    case "llm_drafting":
      return "email_drafting"
    case "sequence_preparation":
      return "sequence_preparation"
    case "voice_generation":
      return "voice_generation"
    case "sms_generation":
      return "sms_generation"
    case "browser_automation":
      return "browser_automation"
    case "human_approval":
    case "outreach_send":
      return "other_scarce"
    default:
      return "other_scarce"
  }
}

/**
 * Split a total advance budget across active capacity classes so one backlog
 * cannot consume the entire per-org cap.
 */
export function allocateDueSlotsByCapacityClass(input: {
  capacityClasses: readonly AiOsPortfolioCapacityClass[]
  totalBudget: number
}): Map<AiOsPortfolioCapacityClass, number> {
  const classes = [...new Set(input.capacityClasses)]
  const budget = Math.max(0, Math.floor(input.totalBudget))
  const result = new Map<AiOsPortfolioCapacityClass, number>()
  if (classes.length === 0 || budget === 0) return result

  const base = Math.floor(budget / classes.length)
  let remainder = budget - base * classes.length
  for (const capacityClass of classes) {
    let slots = base
    if (remainder > 0) {
      slots += 1
      remainder -= 1
    }
    // Prefer at least one slot per active class when budget allows.
    if (slots === 0 && budget >= classes.length) slots = 1
    result.set(capacityClass, slots)
  }

  // If we over-allocated while forcing mins, trim from the end.
  let sum = [...result.values()].reduce((a, b) => a + b, 0)
  const ordered = [...classes].reverse()
  while (sum > budget) {
    for (const capacityClass of ordered) {
      const current = result.get(capacityClass) ?? 0
      if (current > 0) {
        result.set(capacityClass, current - 1)
        sum -= 1
        if (sum <= budget) break
      }
    }
  }

  return result
}
