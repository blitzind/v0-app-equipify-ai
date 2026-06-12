/** Apollo 25-company pilot — launch recommendation engine (Phase 14.2F). */

import type {
  Apollo25CompanyPilotCohortEnrollmentReadinessSummary,
  Apollo25CompanyPilotCohortPersonalizationReport,
  Apollo25CompanyPilotCohortSnapshot,
  Apollo25CompanyPilotLaunchRecommendation,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function buildApollo25CompanyPilotLaunchRecommendation(input: {
  snapshot: Apollo25CompanyPilotCohortSnapshot
  enrollment_readiness: Apollo25CompanyPilotCohortEnrollmentReadinessSummary
  personalization: Apollo25CompanyPilotCohortPersonalizationReport
}): Apollo25CompanyPilotLaunchRecommendation {
  const blocking_issues: string[] = []
  const recommended_launch_size = input.snapshot.cohort_size

  if (input.snapshot.cohort_size === 0) {
    blocking_issues.push("no_greenfield_eligible_companies")
  }

  if (input.snapshot.cohort_size < input.snapshot.target_size) {
    blocking_issues.push(
      `eligible_pool_below_target: ${input.snapshot.cohort_size}/${input.snapshot.target_size} greenfield companies qualify`,
    )
  }

  for (const company of input.enrollment_readiness.companies) {
    if (!company.ready) {
      blocking_issues.push(
        `enrollment_not_ready:${company.company_candidate_id}:${company.blockers.join(",")}`,
      )
    }
  }

  for (const company of input.personalization.companies) {
    if (!company.ready) {
      blocking_issues.push(
        `personalization_missing:${company.company_candidate_id}:${company.missing_assets.join(",")}`,
      )
    }
  }

  const enrollmentReady =
    input.enrollment_readiness.companies_evaluated > 0 &&
    input.enrollment_readiness.companies_ready === input.enrollment_readiness.companies_evaluated

  const personalizationReady =
    input.personalization.companies_evaluated > 0 &&
    input.personalization.companies_ready === input.personalization.companies_evaluated

  const ready_for_launch = recommended_launch_size > 0 && enrollmentReady && personalizationReady

  return {
    ready_for_launch,
    blocking_issues,
    recommended_launch_size,
  }
}
