/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Production-safe DataMoon discovery health (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import {
  evaluateAutonomousProspectDiscoveryProviderPolicy,
  isProductionRuntime,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import type { DatamoonAutonomousDiscoveryHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  buildDatamoonProductionConfigurationAudit,
  extendDatamoonHealthSnapshotWithConfigurationAudit,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-production-configuration-audit-2b"

export async function buildDatamoonAutonomousDiscoveryHealthSnapshot(
  admin: SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<DatamoonAutonomousDiscoveryHealthSnapshot> {
  const organizationId = getGrowthEngineAiOrgId(env)
  const organizationResolved = organizationId != null

  let approvedBusinessProfilePresent = false
  if (organizationId) {
    const approved = await getActiveApprovedBusinessProfile(admin, organizationId)
    approvedBusinessProfilePresent = approved != null
  }

  const policy = evaluateAutonomousProspectDiscoveryProviderPolicy({
    authority: "autonomous_portfolio",
    env,
  })

  const configurationAudit = buildDatamoonProductionConfigurationAudit({
    env,
    approvedBusinessProfilePresent: approvedBusinessProfilePresent,
  })

  const datamoonEligibleForAutonomousDiscovery =
    policy.datamoonEnabled &&
    policy.datamoonConfigured &&
    policy.datamoonBudgetAvailable &&
    approvedBusinessProfilePresent &&
    policy.stopReason !== "datamoon_dry_run_only"

  const base: DatamoonAutonomousDiscoveryHealthSnapshot = {
    ok:
      datamoonEligibleForAutonomousDiscovery &&
      policy.fixtureFallbackBlockedInProduction &&
      policy.otherAutonomousProvidersDisabled,
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    organizationResolved,
    approvedBusinessProfilePresent,
    datamoonImplemented: true,
    datamoonConfigured: policy.datamoonConfigured,
    datamoonEnabled: policy.datamoonEnabled,
    datamoonBudgetAvailable: policy.datamoonBudgetAvailable,
    datamoonEligibleForAutonomousDiscovery,
    prospectSearchRoutesToDatamoon: policy.usesDatamoonAutonomousPath,
    fixtureFallbackBlockedInProduction:
      policy.fixtureFallbackBlockedInProduction && isProductionRuntime(env),
    otherAutonomousProvidersDisabled: policy.otherAutonomousProvidersDisabled,
  }

  return extendDatamoonHealthSnapshotWithConfigurationAudit({
    base,
    audit: configurationAudit,
  })
}
