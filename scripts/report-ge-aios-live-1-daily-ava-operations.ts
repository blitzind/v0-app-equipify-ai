/**
 * GE-AIOS-LIVE-1 — Daily Ava operations report (read-only).
 *
 * Run each business day:
 *   pnpm report:ge-aios-live-1-daily-ava-operations
 *
 * JSON output:
 *   pnpm report:ge-aios-live-1-daily-ava-operations -- --json
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { buildLive1DailyAvaReport } from "@/lib/growth/live-operations/ge-aios-live-1-operations-analysis"

const PHASE = "GE-AIOS-LIVE-1" as const

function wantsJson(argv: string[]): boolean {
  return argv.includes("--json")
}

function parseCodeDeployed(argv: string[]): boolean {
  return !argv.includes("--pre-deploy")
}

async function main(): Promise<void> {
  const json = wantsJson(process.argv)
  const codeDeployed = parseCodeDeployed(process.argv)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    console.error("GROWTH_ENGINE_AI_ORG_ID not configured")
    process.exit(1)
  }

  const report = await buildLive1DailyAvaReport({
    admin,
    organizationId,
    codeDeployed,
  })

  if (json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`[${PHASE}] ${report.greeting}`)
  console.log(`Generated: ${report.generatedAt}`)
  console.log(`Organization: ${report.organizationId}`)
  console.log("")
  console.log("--- Morning Summary ---")
  console.log(`Research completed (24h): ${report.researchCompletedLast24h}`)
  console.log(`New leads (24h): ${report.newLeadsLast24h}`)
  console.log(`Leads rejected (24h): ${report.leadsRejectedLast24h}`)
  console.log(`Leads awaiting review: ${report.leadsAwaitingReview}`)
  console.log(`Operator approvals waiting: ${report.operatorApprovalsWaiting}`)
  console.log("")
  console.log("--- High-Priority Accounts ---")
  if (report.highPriorityAccounts.length === 0) {
    console.log("  (none identified — import approved ICP leads)")
  } else {
    for (const account of report.highPriorityAccounts) {
      console.log(`  • ${account}`)
    }
  }
  console.log("")
  console.log("--- Recommended Actions ---")
  for (const action of report.recommendedActions) {
    console.log(`  → ${action}`)
  }
  console.log("")
  console.log("--- Pipeline Risks ---")
  if (report.pipelineRisks.length === 0) {
    console.log("  None flagged.")
  } else {
    for (const risk of report.pipelineRisks) {
      console.log(`  ! ${risk}`)
    }
  }
  console.log("")
  console.log("--- Metrics ---")
  console.log(JSON.stringify(report.metrics, null, 2))
}

void main()
