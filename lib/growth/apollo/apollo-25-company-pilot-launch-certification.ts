/** Apollo 25-company pilot cohort — launch certification (Phase 14.2G.1). */

import type {
  Apollo25CompanyPilotCohortLaunchCertification,
  Apollo25CompanyPilotCohortReview,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function buildApollo25CompanyPilotCohortLaunchCertification(
  review: Apollo25CompanyPilotCohortReview,
): Apollo25CompanyPilotCohortLaunchCertification {
  const blocking_issues: string[] = []

  if (review.duplicate_canonical_companies > 0) {
    blocking_issues.push(
      `canonical_duplicates_present:${review.duplicate_canonical_companies}`,
    )
  }

  const enrollment_ready_pct = review.enrollment_readiness.readiness_pct
  const personalization_ready_pct = review.personalization.readiness_pct

  if (enrollment_ready_pct < 100) {
    blocking_issues.push(`enrollment_readiness_incomplete:${enrollment_ready_pct}%`)
  }

  if (personalization_ready_pct < 100) {
    blocking_issues.push(`personalization_readiness_incomplete:${personalization_ready_pct}%`)
  }

  for (const issue of review.launch_recommendation.blocking_issues) {
    if (!blocking_issues.includes(issue)) blocking_issues.push(issue)
  }

  const certified =
    review.duplicate_canonical_companies === 0 &&
    enrollment_ready_pct === 100 &&
    personalization_ready_pct === 100 &&
    review.launch_recommendation.ready_for_launch &&
    blocking_issues.length === 0

  return {
    certified,
    enrollment_ready_pct,
    personalization_ready_pct,
    blocking_issues,
  }
}
