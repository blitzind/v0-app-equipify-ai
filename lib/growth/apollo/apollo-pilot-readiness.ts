/** Apollo pilot operations readiness — client-safe. */

import {
  APOLLO_PILOT_COHORT_SIZES,
  APOLLO_PILOT_OPERATIONS_QA_MARKER,
  type ApolloPilotReadinessPayload,
} from "@/lib/growth/apollo/apollo-pilot-types"

export const APOLLO_PILOT_CERTIFIED_PIPELINE_CHAIN = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
  "Personalized Drafts",
  "Pending Approval Jobs",
] as const

export function buildApolloPilotReadinessPayload(input?: {
  migration_present?: boolean
  blockers?: string[]
}): ApolloPilotReadinessPayload {
  const blockers = [...(input?.blockers ?? [])]
  if (!input?.migration_present) {
    blockers.push("apollo_pilot_cohorts_migration_missing")
  }

  return {
    qa_marker: APOLLO_PILOT_OPERATIONS_QA_MARKER,
    ready: blockers.length === 0,
    blockers,
    certified_pipeline: [...APOLLO_PILOT_CERTIFIED_PIPELINE_CHAIN],
    recommended_cohort_sizes: [...APOLLO_PILOT_COHORT_SIZES],
  }
}
