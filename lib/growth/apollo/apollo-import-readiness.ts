/** Apollo import → research → sequence enrollment readiness (client-safe). */

export const APOLLO_IMPORT_READINESS_QA_MARKER = "apollo-import-readiness-ai-1-v1" as const

export type ApolloImportReadinessFlag =
  | "research_complete"
  | "score_available"
  | "contactable"
  | "sequence_ready"

export type ApolloImportReadinessState =
  | "blocked"
  | "imported"
  | "research_in_progress"
  | "research_complete"
  | "contactable"
  | "sequence_ready"

export type ApolloImportReadinessInput = {
  suppressed?: boolean
  discovery_contacts?: number
  company_contacts_synced?: number
  canonical_persons_linked?: number
  lead_score?: number | null
  research_summary_present?: boolean
  buying_committee_completeness_pct?: number | null
  email_eligible?: boolean
  phone_eligible?: boolean
  sequence_readiness_state?: string | null
  apollo_source_metadata_present?: boolean
}

export type ApolloImportReadiness = {
  qa_marker: typeof APOLLO_IMPORT_READINESS_QA_MARKER
  flags: Record<ApolloImportReadinessFlag, boolean>
  overall_state: ApolloImportReadinessState
  blockers: string[]
  missing_requirements: string[]
  next_steps: string[]
  provenance: {
    apollo_metadata_tracked: boolean
    canonical_authoritative: true
  }
}

export function evaluateApolloImportReadiness(
  input: ApolloImportReadinessInput,
): ApolloImportReadiness {
  const blockers: string[] = []
  const missing_requirements: string[] = []
  const next_steps: string[] = []

  if (input.suppressed) {
    return {
      qa_marker: APOLLO_IMPORT_READINESS_QA_MARKER,
      flags: {
        research_complete: false,
        score_available: false,
        contactable: false,
        sequence_ready: false,
      },
      overall_state: "blocked",
      blockers: ["Lead or account suppressed"],
      missing_requirements: ["Resolve suppression"],
      next_steps: ["Review compliance block before Apollo import"],
      provenance: {
        apollo_metadata_tracked: input.apollo_source_metadata_present ?? false,
        canonical_authoritative: true,
      },
    }
  }

  const hasContacts = (input.company_contacts_synced ?? input.discovery_contacts ?? 0) > 0
  const research_complete = Boolean(
    input.research_summary_present &&
      hasContacts &&
      (input.canonical_persons_linked ?? 0) > 0,
  )
  const score_available =
    input.lead_score != null && Number.isFinite(input.lead_score) && input.lead_score >= 0
  const contactable = Boolean(input.email_eligible || input.phone_eligible)
  const sequence_ready =
    research_complete &&
    score_available &&
    contactable &&
    (input.sequence_readiness_state === "ready" ||
      input.sequence_readiness_state === "ready_with_caution")

  if (!hasContacts) {
    missing_requirements.push("Apollo contacts synced to company_contacts")
    next_steps.push("Run contact discovery with Apollo enabled for target company")
  }
  if (!input.research_summary_present) {
    missing_requirements.push("Company intelligence / research summary")
    next_steps.push("Trigger Lead Engine research after import")
  }
  if ((input.canonical_persons_linked ?? 0) === 0 && hasContacts) {
    missing_requirements.push("Canonical person linkage")
    next_steps.push("Run canonical person backfill for imported contacts")
  }
  if (!score_available) {
    missing_requirements.push("Lead fit score")
    next_steps.push("Wait for scoring pipeline or run fit scoring job")
  }
  if (!contactable) {
    missing_requirements.push("Eligible email or phone channel")
    next_steps.push("Verify contact channel eligibility before sequence enrollment")
  }
  if (research_complete && score_available && contactable && !sequence_ready) {
    missing_requirements.push("Sequence readiness gate")
    next_steps.push("Review prospect search sequence readiness blockers")
  }

  let overall_state: ApolloImportReadinessState = "imported"
  if (!hasContacts) overall_state = "imported"
  else if (!research_complete) overall_state = "research_in_progress"
  else if (!contactable || !score_available) overall_state = "research_complete"
  else if (contactable && !sequence_ready) overall_state = "contactable"
  else if (sequence_ready) overall_state = "sequence_ready"

  return {
    qa_marker: APOLLO_IMPORT_READINESS_QA_MARKER,
    flags: {
      research_complete,
      score_available,
      contactable,
      sequence_ready,
    },
    overall_state,
    blockers: blockers.slice(0, 4),
    missing_requirements: missing_requirements.slice(0, 6),
    next_steps: next_steps.slice(0, 6),
    provenance: {
      apollo_metadata_tracked: input.apollo_source_metadata_present ?? false,
      canonical_authoritative: true,
    },
  }
}
