/**
 * GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Production certification (read-only).
 *
 * Run: pnpm validate:ge-aios-draft-factory-observability-1a-production
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_AIOS_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
  runDraftFactoryWakeObservabilityProductionValidation,
} from "@/lib/growth/training/draft-factory-wake-observability-production-validation-1a"

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (Vercel Production only)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

  const report = await runDraftFactoryWakeObservabilityProductionValidation(boot.admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    lookbackHours: 168,
  })

  console.log(
    JSON.stringify(
      {
        phase: "GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A-PRODUCTION",
        qaMarker: GROWTH_AIOS_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
        report,
      },
      null,
      2,
    ),
  )

  for (const gate of report.gates) {
    const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
    console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
  }

  console.log(`\n${report.certification}`)

  if (report.gates.some((gate) => gate.status === "fail")) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
