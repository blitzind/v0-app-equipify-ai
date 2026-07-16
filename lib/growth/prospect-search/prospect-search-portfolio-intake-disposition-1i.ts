/**
 * GE-AIOS-PORTFOLIO-INTAKE-PUSH-REVALIDATION-FIX-1I — Durable intake disposition model (client-safe).
 */

import type { GrowthProspectSearchPushOutcome } from "@/lib/growth/prospect-search/prospect-search-push-metadata"

export const GROWTH_PORTFOLIO_INTAKE_PUSH_REVALIDATION_FIX_1I_QA_MARKER =
  "ge-aios-portfolio-intake-push-revalidation-fix-1i-v1" as const

/** Canonical durable disposition categories for portfolio intake survivors. */
export const PORTFOLIO_INTAKE_DURABLE_DISPOSITION_CATEGORIES = [
  "lead_created",
  "already_existing_lead",
  "canonical_duplicate",
  "intake_rejected",
  "admission_rejected",
  "explicit_permanent_skip",
] as const

export type PortfolioIntakeDurableDispositionCategory =
  (typeof PORTFOLIO_INTAKE_DURABLE_DISPOSITION_CATEGORIES)[number]

const DURABLE_PUSH_OUTCOMES = new Set<GrowthProspectSearchPushOutcome>([
  "pushed",
  "already_exists",
  "suppressed",
])

export function resolvePortfolioIntakeDispositionCategory(
  outcome: GrowthProspectSearchPushOutcome,
): PortfolioIntakeDurableDispositionCategory | null {
  switch (outcome) {
    case "pushed":
      return "lead_created"
    case "already_exists":
      return "already_existing_lead"
    case "suppressed":
      return "explicit_permanent_skip"
    case "skipped_invalid":
    case "failed":
      return null
    default:
      return null
  }
}

export function isDurablePortfolioIntakeDisposition(
  outcome: GrowthProspectSearchPushOutcome,
): boolean {
  return DURABLE_PUSH_OUTCOMES.has(outcome)
}

export function countDurablePortfolioIntakeDispositions(
  outcomes: GrowthProspectSearchPushOutcome[],
): number {
  return outcomes.filter(isDurablePortfolioIntakeDisposition).length
}

/**
 * Required invariant before writing intake_completed = true for a bounded batch.
 *
 * - selectedCount === 0 && postFilterSurvivorCount === 0 → allowed (true zero survivors)
 * - stopReason === datamoon_zero_results → allowed (provider confirmed zero after filters)
 * - selectedCount > 0 → durableDispositionCount must equal selectedCount
 * - selectedCount === 0 && postFilterSurvivorCount > 0 → not allowed (retry on next tick)
 *
 * Future multi-batch (1J): cursor advances only by durableDispositionCount, never over
 * skipped_invalid, failed, or unresolved references.
 */
export function shouldMarkAutonomousRunIntakeCompleted(input: {
  selectedCount: number
  durableDispositionCount: number
  postFilterSurvivorCount: number
  stopReason: string | null
}): boolean {
  if (input.stopReason === "datamoon_zero_results") return true
  if (input.selectedCount === 0) {
    return input.postFilterSurvivorCount === 0
  }
  return input.durableDispositionCount === input.selectedCount
}

export const PORTFOLIO_INTAKE_COMPLETION_INVARIANT_1I =
  "durableDispositionCount === selectedCount when selectedCount > 0; true zero survivors only when postFilterSurvivorCount === 0" as const

export const PORTFOLIO_INTAKE_MULTI_BATCH_CURSOR_RULE_1J =
  "intake_promotion_offset advances only by durableDispositionCount — never over skipped_invalid, transient_error, or unknown" as const
