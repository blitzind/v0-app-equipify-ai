/**
 * GE-AIOS-OPERATOR-PACKAGE-1A — Production draft factory & operator package probe.
 *
 * Read-only trace:
 *   node ... scripts/probe-ge-aios-operator-package-1a.ts
 *
 * Repair + regenerate:
 *   CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR=1 node ... scripts/probe-ge-aios-operator-package-1a.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR,
  GROWTH_AIOS_OPERATOR_PACKAGE_1A_QA_MARKER,
  runOperatorPackageProductionValidation,
} from "@/lib/growth/training/operator-package-production-validation-1a"

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const applyRepair = process.env[CONFIRM_GE_AIOS_OPERATOR_PACKAGE_1A_REPAIR] === "1"

  const report = await runOperatorPackageProductionValidation(boot.admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    applyRepair,
    attemptAdvance: true,
  })

  const outboundWindow = await boot.admin
    .schema("growth")
    .from("outbound_messages")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString())

  console.log(JSON.stringify({ ...report, outboundMessagesLastHour: outboundWindow.count ?? 0 }, null, 2))
  console.log(`\nVERDICT: ${report.executiveVerdict}`)
  if (report.executiveVerdict === "FAIL") process.exit(2)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
