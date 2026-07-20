/**
 * GE-AIOS-OPERATOR-PACKAGE-1A — Enable outreach preparation autonomy in Production (dry-run default).
 *
 * Dry-run:
 *   node ... scripts/repair-ge-aios-operator-package-1a.ts
 *
 * Apply:
 *   CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR=1 node ... scripts/repair-ge-aios-operator-package-1a.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import {
  CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR,
  GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER,
  applyOperatorPackageAutonomyRepair,
} from "@/lib/growth/training/operator-package-production-validation-1a"

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const apply = process.env[CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR] === "1"
  const before = await fetchGrowthAutonomySettings(boot.admin, EQUIPIFY_PRODUCTION_ORG_ID)

  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER,
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
        apply,
        before: {
          masterMode: before.masterMode,
          capabilityToggles: before.capabilityToggles,
        },
      },
      null,
      2,
    ),
  )

  if (!apply) {
    console.log("\nDRY RUN — set CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR=1 to apply.")
    return
  }

  const result = await applyOperatorPackageAutonomyRepair(boot.admin, EQUIPIFY_PRODUCTION_ORG_ID)
  const after = await fetchGrowthAutonomySettings(boot.admin, EQUIPIFY_PRODUCTION_ORG_ID)
  console.log("\nAPPLIED")
  console.log(
    JSON.stringify(
      {
        ...result,
        after: {
          masterMode: after.masterMode,
          capabilityToggles: after.capabilityToggles,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
