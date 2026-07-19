/**
 * GE-AIOS-LIVE-QUALIFICATION-1A — Production end-to-end sales progression probe.
 *
 * Read-only validation:
 *   node ... scripts/probe-ge-aios-live-qualification-1a.ts
 *
 * Apply qualification autonomy repair then validate:
 *   CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR=1 node ... scripts/probe-ge-aios-live-qualification-1a.ts
 */
import { execSync } from "node:child_process"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchDeployedGrowthAiosRuntimeConfigHealth } from "@/lib/growth/qa/growth-aios-runtime-config-health-deployed-probe"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import {
  CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR,
  GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER,
  runLiveQualificationProductionValidation,
  summarizePortfolioReplenishment,
  readOutboundSafety,
} from "@/lib/growth/training/live-qualification-production-unblock-1a"

function deployedSha(): string | null {
  try {
    return execSync("gh api repos/blitzind/v0-app-equipify-ai/deployments --jq '.[0].sha'", {
      encoding: "utf8",
    }).trim()
  } catch {
    return process.env.GE_AIOS_DEPLOYED_SHA?.trim() ?? null
  }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  const applyRepair = process.env[CONFIRM_GE_AIOS_LIVE_QUALIFICATION_1A_REPAIR] === "1"
  const sha = deployedSha()

  const bearer = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  }).catch(() => ({ access_token: null, error: "mint_failed" }))

  const [replenishment, outboundSafety, deployedConfigHealth, report] = await Promise.all([
    summarizePortfolioReplenishment(boot.admin, EQUIPIFY_PRODUCTION_ORG_ID),
    readOutboundSafety(boot.admin),
    bearer.access_token
      ? fetchDeployedGrowthAiosRuntimeConfigHealth({ bearerToken: bearer.access_token })
      : Promise.resolve({ ok: false as const, probed: false, error: bearer.error ?? "bearer_unavailable" }),
    runLiveQualificationProductionValidation(boot.admin, {
      organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      deployedSha: sha,
      applyRepair,
      maxResearchLeads: 3,
    }),
  ])

  console.log(
    JSON.stringify(
      {
        qaMarker: GROWTH_AIOS_LIVE_QUALIFICATION_1A_QA_MARKER,
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
        deployedSha: sha,
        repairApplied: applyRepair,
        phase1_queue: {
          admissionsPendingBefore: report.queueBefore.admissionsPending,
          admissionsPendingAfter: report.queueAfter.admissionsPending,
          blockedByQueueLimit: report.queueBefore.blockedByQueueLimit,
          replenishmentReason: report.queueBefore.replenishmentReason,
          admissionQueueFull: report.queueBefore.replenishmentReason === "Admission queue is full.",
        },
        phase2_datamoon: {
          deployedRuntimeConfigHealth: deployedConfigHealth,
          processEnvDiscovery: report.datamoon,
          replenishment,
        },
        phase3_outboundSafety: outboundSafety,
        phase4_progression: {
          researchOrchestratorRunId: report.researchOrchestratorRunId,
          researchCompleted: report.researchCompleted,
          qualificationCompleted: report.qualificationCompleted,
          qualificationBlocked: report.qualificationBlocked,
          readyForOutreachReview: report.readyForOutreachReview,
          sampleLeadIds: report.sampleLeadIds,
          operatorPackageCount: report.operatorPackageCount,
        },
        autonomy: {
          before: report.autonomyBefore,
          after: report.autonomyAfter,
        },
        executiveVerdict: report.executiveVerdict,
        verdictReasons: report.verdictReasons,
        firstRemainingBlocker: report.firstRemainingBlocker,
        recommendedNextAction: report.recommendedNextAction,
      },
      null,
      2,
    ),
  )

  console.log(`\nVERDICT: ${report.executiveVerdict}`)
  if (report.executiveVerdict === "FAIL") process.exit(2)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
