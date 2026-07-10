/** GE-AIOS-HOTFIX-LIVE-1A — End-to-end Home summary timing (production). */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"

async function main(): Promise<void> {
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed")
    process.exit(1)
  }

  console.log("[HOTFIX-LIVE-1A] Home request started")
  const wallStart = Date.now()
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin: bootstrap.admin,
    operatorEmail: "hotfix-live-1a@test",
    actorUserId: "hotfix-live-1a",
  })

  console.log(`Total (optimization.durationMs): ${summary.optimization.durationMs}ms`)
  console.log(`Wall clock: ${Date.now() - wallStart}ms`)
  console.log("Stage timings:")
  for (const [label, durationMs] of Object.entries(summary.optimization.stageTimingsMs ?? {})) {
    console.log(`  ${label}: ${durationMs}ms`)
  }
}

void main()
