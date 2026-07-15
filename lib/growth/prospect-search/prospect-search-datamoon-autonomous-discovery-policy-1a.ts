/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Single-provider policy for autonomous Production discovery (client-safe). */

import {
  isDatamoonAudienceConfigured,
  isDatamoonDryRunOnly,
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import {
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type AutonomousProspectDiscoveryProviderPolicy,
  type DatamoonAutonomousDiscoveryStopReason,
  type ProspectSearchDiscoveryAuthority,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

const AUTONOMOUS_AUTHORITIES = new Set<ProspectSearchDiscoveryAuthority>([
  "autonomous_portfolio",
  "portfolio_manual",
])

export function isAutonomousProspectDiscoveryAuthority(
  authority: ProspectSearchDiscoveryAuthority | undefined | null,
): boolean {
  return authority != null && AUTONOMOUS_AUTHORITIES.has(authority)
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production"
}

export function evaluateAutonomousProspectDiscoveryProviderPolicy(input: {
  authority?: ProspectSearchDiscoveryAuthority | null
  env?: NodeJS.ProcessEnv
  discoveriesToday?: number
  maximumDailyDiscovery?: number
}): AutonomousProspectDiscoveryProviderPolicy {
  const env = input.env ?? process.env
  const usesDatamoonAutonomousPath = isAutonomousProspectDiscoveryAuthority(input.authority)
  const fixtureFallbackBlockedInProduction =
    usesDatamoonAutonomousPath && isProductionRuntime(env)
  const otherAutonomousProvidersDisabled = usesDatamoonAutonomousPath

  const datamoonEnabled = isDatamoonProviderEnabled(env)
  const datamoonConfigured = isDatamoonProviderConfigured(env)
  const datamoonAudienceConfigured = isDatamoonAudienceConfigured(env)
  const datamoonDryRunOnly = isDatamoonDryRunOnly(env)
  const discoveriesToday = Math.max(0, input.discoveriesToday ?? 0)
  const maximumDailyDiscovery = Math.max(0, input.maximumDailyDiscovery ?? 50)
  const datamoonBudgetAvailable = discoveriesToday < maximumDailyDiscovery

  let stopReason: DatamoonAutonomousDiscoveryStopReason | null = null

  if (usesDatamoonAutonomousPath) {
    if (!datamoonEnabled) {
      stopReason = "datamoon_disabled"
    } else if (!datamoonAudienceConfigured) {
      stopReason = "datamoon_not_configured"
    } else if (isProductionRuntime(env) && datamoonDryRunOnly) {
      stopReason = "datamoon_dry_run_only"
    } else if (!datamoonBudgetAvailable) {
      stopReason = "datamoon_budget_exhausted"
    }
  }

  const eligible =
    usesDatamoonAutonomousPath &&
    stopReason == null &&
    datamoonEnabled &&
    datamoonConfigured &&
    datamoonAudienceConfigured &&
    datamoonBudgetAvailable &&
    (!isProductionRuntime(env) || !datamoonDryRunOnly)

  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    usesDatamoonAutonomousPath,
    preferredProvider: usesDatamoonAutonomousPath ? "datamoon" : null,
    fixtureFallbackBlockedInProduction,
    otherAutonomousProvidersDisabled,
    eligible,
    stopReason,
    datamoonConfigured,
    datamoonEnabled,
    datamoonBudgetAvailable,
  }
}

export function autonomousDiscoveryStopReasonMessage(
  reason: DatamoonAutonomousDiscoveryStopReason,
): string {
  switch (reason) {
    case "datamoon_not_configured":
      return "DataMoon needs configuration before autonomous discovery can run."
    case "datamoon_disabled":
      return "DataMoon is disabled for this environment."
    case "datamoon_dry_run_only":
      return "DataMoon dry-run mode is active — live Production discovery requires live credentials."
    case "datamoon_budget_exhausted":
      return "Provider budget paused — daily discovery limit reached."
    case "datamoon_request_active":
      return "DataMoon discovery job already active for this organization."
    case "datamoon_job_failed":
      return "DataMoon discovery job failed."
    case "datamoon_zero_results":
      return "No matching companies found."
    case "datamoon_provider_error":
      return "DataMoon provider returned an error."
    case "business_profile_missing":
      return "Approved Business Profile required for autonomous discovery."
    case "fixture_fallback_forbidden":
      return "Fixture fallback is forbidden for autonomous Production discovery."
    default:
      return "Autonomous discovery unavailable."
  }
}
