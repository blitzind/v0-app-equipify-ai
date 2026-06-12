/** Apollo 25-company pilot — launch certification fatal vs warning classification (client-safe). */

export const APOLLO_25_COMPANY_PILOT_LAUNCH_CERTIFICATION_POLICY_QA_MARKER =
  "apollo-25-company-pilot-launch-certification-policy-v14-2j-19" as const

const NON_FATAL_LAUNCH_RECOMMENDATION_ISSUE_PREFIXES = [
  "eligible_pool_below_target:",
] as const

export function isApollo25CompanyPilotLaunchCertificationWarning(issue: string): boolean {
  const normalized = issue.trim()
  return NON_FATAL_LAUNCH_RECOMMENDATION_ISSUE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  )
}

export function classifyApollo25CompanyPilotLaunchCertificationIssues(issues: readonly string[]): {
  fatal_blockers: string[]
  warnings: string[]
} {
  const fatal_blockers: string[] = []
  const warnings: string[] = []

  for (const issue of issues) {
    const normalized = issue.trim()
    if (!normalized) continue
    if (isApollo25CompanyPilotLaunchCertificationWarning(normalized)) {
      if (!warnings.includes(normalized)) warnings.push(normalized)
      continue
    }
    if (!fatal_blockers.includes(normalized)) fatal_blockers.push(normalized)
  }

  return { fatal_blockers, warnings }
}
