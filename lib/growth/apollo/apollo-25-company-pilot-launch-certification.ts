/** Apollo 25-company pilot cohort — launch certification (Phase 14.2G.1). */

import { classifyApollo25CompanyPilotLaunchCertificationIssues } from "@/lib/growth/apollo/apollo-25-company-pilot-launch-certification-policy"
import type {
  Apollo25CompanyPilotCohortLaunchCertification,
  Apollo25CompanyPilotCohortReview,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function buildApollo25CompanyPilotCohortLaunchCertification(
  review: Apollo25CompanyPilotCohortReview,
): Apollo25CompanyPilotCohortLaunchCertification {
  const issueCandidates: string[] = []

  if (review.duplicate_canonical_companies > 0) {
    issueCandidates.push(
      `canonical_duplicates_present:${review.duplicate_canonical_companies}`,
    )
  }

  const enrollment_ready_pct = review.enrollment_readiness.readiness_pct
  const personalization_ready_pct = review.personalization.readiness_pct

  if (enrollment_ready_pct < 100) {
    issueCandidates.push(`enrollment_readiness_incomplete:${enrollment_ready_pct}%`)
  }

  if (personalization_ready_pct < 100) {
    issueCandidates.push(`personalization_readiness_incomplete:${personalization_ready_pct}%`)
  }

  for (const issue of review.launch_recommendation.blocking_issues) {
    if (!issueCandidates.includes(issue)) issueCandidates.push(issue)
  }

  const { fatal_blockers, warnings } = classifyApollo25CompanyPilotLaunchCertificationIssues(
    issueCandidates,
  )

  const certified =
    review.duplicate_canonical_companies === 0 &&
    enrollment_ready_pct === 100 &&
    personalization_ready_pct === 100 &&
    review.launch_recommendation.ready_for_launch &&
    fatal_blockers.length === 0

  return {
    certified,
    enrollment_ready_pct,
    personalization_ready_pct,
    fatal_blockers,
    warnings,
    blocking_issues: [...fatal_blockers, ...warnings],
  }
}
