/** Apollo enrichment recovery — client-safe types and helpers (Phase 14.3D). */

import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"

export const APOLLO_ENRICHMENT_RECOVERY_QA_MARKER =
  "apollo-enrichment-recovery-v14-3d" as const

export type ApolloEnrichmentRecoveryStrategy = "enrichment_only" | "full_reacquisition"

export function resolveApolloEnrichmentRecoveryStrategy(
  input: Apollo25CompanyPilotSelectionInput,
): ApolloEnrichmentRecoveryStrategy {
  if (input.snapshot_summary.mapped_contacts > 0) return "enrichment_only"
  return "full_reacquisition"
}

export function selectApolloEnrichmentRecoveryTargets(
  inputs: Apollo25CompanyPilotSelectionInput[],
): Apollo25CompanyPilotSelectionInput[] {
  return inputs.filter((input) => input.snapshot_summary.verified_email_contacts === 0)
}

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}
