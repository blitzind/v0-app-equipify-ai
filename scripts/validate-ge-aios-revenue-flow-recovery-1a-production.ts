/**
 * GE-AIOS-REVENUE-FLOW-RECOVERY-1A-PRODUCTION — Canonical revenue pipeline recovery validation.
 *
 * Dry-run (read-only):
 *   pnpm validate:ge-aios-revenue-flow-recovery-1a-production
 *
 * Apply corrections:
 *   CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A=1 pnpm validate:ge-aios-revenue-flow-recovery-1a-production
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A,
  GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER,
  runRevenueFlowRecoveryProductionValidation,
} from "@/lib/growth/training/revenue-flow-recovery-production-validation-1a"

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (Vercel Production only)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const applyCorrections = process.env[CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A] === "1"

  const report = await runRevenueFlowRecoveryProductionValidation(boot.admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    applyCorrections,
  })

  console.log(
    JSON.stringify(
      {
        phase: "GE-AIOS-REVENUE-FLOW-RECOVERY-1A-PRODUCTION",
        qaMarker: GROWTH_AIOS_REVENUE_FLOW_RECOVERY_1A_QA_MARKER,
        applyCorrections,
        report,
      },
      null,
      2,
    ),
  )

  if (!applyCorrections) {
    console.log(
      `\nDRY RUN — set ${CONFIRM_GE_AIOS_REVENUE_FLOW_RECOVERY_1A}=1 to apply admission reconciliation, outreach prep policy repair, and targeted outreach preparation triggers.`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
