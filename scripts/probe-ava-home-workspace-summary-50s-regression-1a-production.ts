/**
 * AVA-HOME-WORKSPACE-SUMMARY-50S-REGRESSION-1A — Read-only production timing probe.
 * Run: pnpm probe:ava-home-workspace-summary-50s-regression-1a:production
 */

import { BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID } from "@/lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

const CERT_ID = "ava-home-workspace-summary-50s-regression-1a-v1" as const
const TARGET_MS = 5_000

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] workspace-summary timing audit`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN =
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  process.env.GROWTH_ENGINE_AI_ORG_ID =
    process.env.GROWTH_ENGINE_AI_ORG_ID?.trim() || EQUIPIFY_PRODUCTION_ORG_ID

  const startedAt = Date.now()
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin: cert.admin,
    operatorEmail: cert.operatorEmail,
    actorUserId: cert.actorUserId,
  })
  const durationMs = Date.now() - startedAt
  const stages = summary.optimization?.stageTimingsMs ?? {}

  const blockInApproved = summary.supervisedOperatorAttention?.approvedReadyToSend?.some(
    (row) => row.leadId === BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  )
  const blockInReview = summary.supervisedOperatorAttention?.readyForReview?.some(
    (row) => row.leadId === BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  )
  const blockFirstTouchComplete = summary.supervisedOperatorAttention?.sentLeadIds.includes(
    BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  )

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
        durationMs,
        targetMs: TARGET_MS,
        withinTarget: durationMs <= TARGET_MS,
        reportedDurationMs: summary.optimization?.durationMs ?? null,
        stageTimingsMs: stages,
        slowStages: Object.entries(stages)
          .filter(([, ms]) => typeof ms === "number" && ms >= 500)
          .sort((left, right) => (right[1] as number) - (left[1] as number)),
        supervised: {
          readyForReview: summary.supervisedOperatorAttention?.readyForReview?.length ?? 0,
          approvedReadyToSend: summary.supervisedOperatorAttention?.approvedReadyToSend?.length ?? 0,
          blockImaging: {
            inApprovedReadyToSend: blockInApproved === true,
            inReadyForReview: blockInReview === true,
            firstTouchComplete: blockFirstTouchComplete === true,
          },
        },
        discovery: {
          missionDiscoveryState: summary.missionDiscovery?.lifecycleState ?? null,
          datamoonJobActive: summary.portfolioManager?.replenishment?.discoveryAlreadyRunning ?? null,
        },
        invariants: {
          sentDuringAudit: false,
          approvedDuringAudit: false,
          mutatedProduction: false,
          datamoonMutationDuringHomeLoad: false,
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
