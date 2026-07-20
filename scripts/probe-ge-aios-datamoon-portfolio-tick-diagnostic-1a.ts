/**
 * Read-only Production diagnostic — portfolio DataMoon tick without full scheduler.
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { buildDatamoonAutonomousDiscoveryHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-health-1a"
import { evaluateAutonomousProspectDiscoveryProviderPolicy } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"
import { tickAutonomousPortfolioManagerForScheduler } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a"
import {
  isDatamoonAudienceConfigured,
  isDatamoonDryRunOnly,
  isDatamoonProviderEnabled,
} from "@/lib/growth/providers/datamoon/datamoon-config"

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const health = await buildDatamoonAutonomousDiscoveryHealthSnapshot(admin)
  const policy = evaluateAutonomousProspectDiscoveryProviderPolicy({ authority: "autonomous_portfolio" })
  const tick = await tickAutonomousPortfolioManagerForScheduler(admin, {
    organizationIds: [orgId],
    maxOrganizations: 1,
  })

  const runs = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, run_name, status, datamoon_audience_id, error_message, created_at")
    .like("run_name", "ge-aios-autonomous-prospect-search:%")
    .order("created_at", { ascending: false })
    .limit(5)

  console.log(
    JSON.stringify(
      {
        orgId,
        datamoonEnv: {
          enabled: isDatamoonProviderEnabled(),
          dryRun: isDatamoonDryRunOnly(),
          audienceConfigured: isDatamoonAudienceConfigured(),
        },
        health,
        policy,
        portfolioTick: tick,
        recentAutonomousRuns: runs.data ?? [],
        runsError: runs.error?.message ?? null,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
