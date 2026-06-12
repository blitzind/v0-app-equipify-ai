/** Apollo 25-company pilot cohort review — assemble diagnostic response (Phase 14.2F). */

import {
  ensureApollo25CompanyPilotCanonicalUniqueSnapshot,
  buildApollo25CompanyPilotGreenfieldCohortSnapshot,
} from "@/lib/growth/apollo/apollo-25-company-pilot-draft-cohort"
import { evaluateApollo25CompanyPilotCohortEnrollmentReadiness } from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-readiness"
import {
  evaluateApollo25CompanyPilotCohortPersonalization,
  type Apollo25CompanyPilotPersonalizationMaterializationState,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation"
import { buildApollo25CompanyPilotLaunchRecommendation } from "@/lib/growth/apollo/apollo-25-company-pilot-launch-recommendation"
import { buildApollo25CompanyPilotCohortLaunchCertification } from "@/lib/growth/apollo/apollo-25-company-pilot-launch-certification"
import {
  APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
  type Apollo25CompanyPilotCohortReview,
  type Apollo25CompanyPilotCohortSnapshot,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"

export function buildApollo25CompanyPilotCohortReview(input: {
  selection_inputs: Apollo25CompanyPilotSelectionInput[]
  production_threshold?: number
  target_size?: number
  snapshot?: Apollo25CompanyPilotCohortSnapshot | null
  cohort_id?: string | null
  cohort_name?: string | null
  cohort_status?: string | null
  materialization_by_company?: Record<string, Apollo25CompanyPilotPersonalizationMaterializationState>
  company_ids_in_other_active_pilot_cohorts?: ReadonlySet<string> | readonly string[]
  computed_at?: string
}): Apollo25CompanyPilotCohortReview {
  const rawSnapshot =
    input.snapshot ??
    buildApollo25CompanyPilotGreenfieldCohortSnapshot({
      selection_inputs: input.selection_inputs,
      production_threshold: input.production_threshold,
      target_size: input.target_size,
      generated_at: input.computed_at,
    })
  const snapshot = ensureApollo25CompanyPilotCanonicalUniqueSnapshot(rawSnapshot)
  const canonical_dedupe = snapshot.canonical_dedupe

  const enrollment_readiness = evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
    snapshot_companies: snapshot.companies,
    selection_inputs: input.selection_inputs,
    production_threshold: input.production_threshold ?? snapshot.production_qualification_threshold,
    cohort_id: input.cohort_id,
    company_ids_in_other_active_pilot_cohorts: input.company_ids_in_other_active_pilot_cohorts,
  })

  const personalization = evaluateApollo25CompanyPilotCohortPersonalization({
    snapshot_companies: snapshot.companies,
    materialization_by_company: input.materialization_by_company ?? {},
  })

  const launch_recommendation = buildApollo25CompanyPilotLaunchRecommendation({
    snapshot,
    enrollment_readiness,
    personalization,
    duplicate_canonical_companies: canonical_dedupe?.duplicate_canonical_companies ?? 0,
  })

  const review: Apollo25CompanyPilotCohortReview = {
    qa_marker: APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER,
    computed_at: input.computed_at ?? new Date().toISOString(),
    cohort_id: input.cohort_id ?? null,
    cohort_name: input.cohort_name ?? null,
    cohort_status: input.cohort_status ?? null,
    snapshot,
    cohort_size: snapshot.cohort_size,
    target_size: snapshot.target_size,
    canonical_company_count: canonical_dedupe?.canonical_company_count ?? snapshot.cohort_size,
    duplicate_canonical_companies: canonical_dedupe?.duplicate_canonical_companies ?? 0,
    dedupe_audit: canonical_dedupe?.dedupe_audit ?? [],
    companies: snapshot.companies,
    enrollment_readiness,
    personalization,
    launch_recommendation,
    launch_certification: {
      certified: false,
      enrollment_ready_pct: enrollment_readiness.readiness_pct,
      personalization_ready_pct: personalization.readiness_pct,
      blocking_issues: [],
    },
    no_outreach_side_effects: true,
  }

  review.launch_certification = buildApollo25CompanyPilotCohortLaunchCertification(review)
  return review
}
