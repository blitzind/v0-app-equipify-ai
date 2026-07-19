/**
 * GE-AIOS-LIVE-QUALIFICATION-1A — Enable qualification autonomy in Production (dry-run default).
 *
 * Dry-run:
 *   node ... scripts/repair-ge-aios-live-qualification-1a.ts
 *
 * Apply:
 *   CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR=1 node ... scripts/repair-ge-aios-live-qualification-1a.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR,
  GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER,
  applyLiveQualificationAutonomyRepair,
  planLiveQualificationAutonomyRepair,
} from "@/lib/growth/training/live-qualification-production-unblock-1a"

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const apply = process.env[CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR] === "1"
  const plan = await planLiveQualificationAutonomyRepair(boot.admin, EQUIPIFY_PRODUCTION_ORG_ID)

  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER,
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
        apply,
        plan,
      },
      null,
      2,
    ),
  )

  if (!apply) {
    console.log("\nDRY RUN — set CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR=1 to apply.")
    return
  }

  const result = await applyLiveQualificationAutonomyRepair(boot.admin, EQUIPIFY_PRODUCTION_ORG_ID)
  console.log("\nAPPLIED")
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
