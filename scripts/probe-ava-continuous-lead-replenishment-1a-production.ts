/**
 * AVA-CONTINUOUS-LEAD-REPLENISHMENT-1A — Production observability probe (read-only by default).
 *
 *   pnpm probe:ava-continuous-lead-replenishment-1a:production
 *
 * Bounded scheduler portfolio tick (same path as cron, no approval/send):
 *   AVA_CONTINUOUS_LEAD_REPLENISHMENT_1A_EXECUTE=true pnpm probe:ava-continuous-lead-replenishment-1a:production
 */

import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadContinuousLeadReplenishmentObservability } from "@/lib/growth/portfolio-manager/growth-continuous-lead-replenishment-observability-1a"
import { tickAutonomousPortfolioManagerForScheduler } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a"

const CERT_ID = "ava-continuous-lead-replenishment-1a-v1" as const

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] continuous lead replenishment audit`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN =
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")
  const admin = cert.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const execute = process.env.AVA_CONTINUOUS_LEAD_REPLENISHMENT_1A_EXECUTE === "true"

  const before = await loadContinuousLeadReplenishmentObservability(admin, { organizationId: orgId })

  let portfolioTick = null
  let after = before
  if (execute) {
    portfolioTick = await tickAutonomousPortfolioManagerForScheduler(admin, {
      organizationIds: [orgId],
      maxOrganizations: 1,
    })
    after = await loadContinuousLeadReplenishmentObservability(admin, { organizationId: orgId })
  }

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        organizationId: orgId,
        executeRequested: execute,
        before,
        portfolioTick,
        after,
        invariants: {
          sentDuringAudit: false,
          approvedDuringAudit: false,
          mutatedProduction: execute,
        },
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
