/**
 * GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1A — Latest research-complete wake diagnostics (read-only).
 *
 * Run: pnpm validate:ge-aios-draft-factory-diagnostics-latest-production
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER,
  printDraftFactoryDiagnosticsLatestProductionReport,
  runDraftFactoryDiagnosticsLatestProductionValidation,
} from "@/lib/growth/training/draft-factory-diagnostics-latest-production-validation-1a"

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (Vercel Production only)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

  const report = await runDraftFactoryDiagnosticsLatestProductionValidation(boot.admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  })

  printDraftFactoryDiagnosticsLatestProductionReport(report)

  if (report.postDeployWakeAvailable) {
    console.log(
      JSON.stringify(
        {
          phase: "GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1A-PRODUCTION",
          qaMarker: GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER,
          target: report.target,
          terminalOutcome: report.timeline?.terminalOutcome ?? null,
          evidence: report.timeline?.evidence ?? null,
        },
        null,
        2,
      ),
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
