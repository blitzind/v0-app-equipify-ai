/** Apollo intelligence recovery target pool — client-safe qualification recovery filters. */

import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import { buildApolloIntelligenceRecoveryScoreDecompositionRow } from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"

export const APOLLO_INTELLIGENCE_RECOVERY_TARGETING_QA_MARKER =
  "apollo-intelligence-recovery-targeting-v14-2d" as const

import type { ApolloIntelligenceRecoveryTarget } from "@/lib/growth/apollo/apollo-intelligence-recovery-types"

export const APOLLO_INTELLIGENCE_RECOVERY_QUALIFICATION_RECOVERY_MIN_SCORE = 55 as const

export function parseApolloIntelligenceRecoveryTarget(
  value: unknown,
  mode: "diagnostic_only" | "recover_missing_intelligence" | "recompute_scores",
): ApolloIntelligenceRecoveryTarget {
  const raw = typeof value === "string" ? value.trim() : ""
  if (raw === "all_discovered") return "all_discovered"
  if (raw === "qualification_recovery") return "qualification_recovery"
  if (mode === "recover_missing_intelligence") return "qualification_recovery"
  return "all_discovered"
}

export function resolveApolloIntelligenceRecoveryQualificationScore(
  input: Apollo25CompanyPilotSelectionInput,
  production_threshold: number,
): number {
  const row = buildApolloIntelligenceRecoveryScoreDecompositionRow({
    company_candidate_id: input.company_candidate_id,
    company_name: input.company_name,
    contacts: input.contacts,
    snapshot_summary: input.snapshot_summary,
    qualificationContext: {
      company_intelligence_present: input.company_intelligence_present ?? false,
      buying_committee_present: input.buying_committee_present ?? false,
      buying_committee_coverage: input.buying_committee_coverage ?? null,
      fit_score: input.fit_score ?? null,
      research_score: input.research_score ?? null,
    },
    production_threshold,
  })
  return row.current_score
}

export function isApolloIntelligenceRecoveryQualificationTarget(input: {
  snapshot_summary: Apollo25CompanyPilotSelectionInput["snapshot_summary"]
  qualification_score: number
  production_threshold: number
}): boolean {
  if (input.snapshot_summary.sequence_ready_contacts <= 0) return false
  if (input.snapshot_summary.contactable_contacts <= 0) return false
  return (
    input.qualification_score >= APOLLO_INTELLIGENCE_RECOVERY_QUALIFICATION_RECOVERY_MIN_SCORE &&
    input.qualification_score < input.production_threshold
  )
}

export function filterApolloIntelligenceRecoveryTargetPool(
  inputs: Apollo25CompanyPilotSelectionInput[],
  target: ApolloIntelligenceRecoveryTarget,
  production_threshold: number,
): Apollo25CompanyPilotSelectionInput[] {
  if (target === "all_discovered") return inputs

  return inputs.filter((input) =>
    isApolloIntelligenceRecoveryQualificationTarget({
      snapshot_summary: input.snapshot_summary,
      qualification_score: resolveApolloIntelligenceRecoveryQualificationScore(
        input,
        production_threshold,
      ),
      production_threshold,
    }),
  )
}
