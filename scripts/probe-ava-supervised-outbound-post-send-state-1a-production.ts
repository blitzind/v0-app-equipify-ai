/**
 * AVA-SUPERVISED-OUTBOUND-POST-SEND-STATE-1A — Read-only production projection probe.
 *
 * Run:
 *   pnpm probe:ava-supervised-outbound-post-send-state-1a:production
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { resolveCanonicalApprovalQueueCount } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  isSupervisedAvaGenerationSent,
  loadSupervisedAvaGenerationsForHome,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { buildGrowthHomeWorkspaceSummary } from "../lib/growth/home/growth-home-workspace-summary-service"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"

const QA_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const CERT_ID = "ava-supervised-outbound-post-send-state-1a-v1" as const

async function resolveActingUser(admin: SupabaseClient): Promise<{ userId: string; email: string }> {
  const preferredEmail = (getPlatformAdminEmails()[0] ?? "mike@blitzind.com").trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail)
  if (!match?.id) throw new Error(`acting_user_not_found:${preferredEmail}`)
  return { userId: match.id, email: match.email ?? preferredEmail }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] production read-only post-send projection probe`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const certBootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  const admin = certBootstrap?.admin ?? createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const actingUser = certBootstrap
    ? { userId: certBootstrap.actorUserId, email: certBootstrap.operatorEmail }
    : await resolveActingUser(admin)

  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const blitzGenerations = await loadSupervisedAvaGenerationsForHome(admin, [QA_LEAD_ID])
  const sentBlitz = blitzGenerations.filter((row) => isSupervisedAvaGenerationSent(row))

  console.log(
    JSON.stringify(
      {
        organizationId,
        blitzGenerationCount: blitzGenerations.length,
        blitzSentCount: sentBlitz.length,
        blitzSentSample: sentBlitz.slice(0, 3).map((row) => ({
          id: row.id,
          sentAt: row.sentAt,
          status: row.status,
        })),
      },
      null,
      2,
    ),
  )

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: actingUser.email,
    actorUserId: actingUser.userId,
  })

  const attention = summary.supervisedOperatorAttention
  const blitzInReady = (attention?.readyForReview ?? []).some((row) => row.leadId === QA_LEAD_ID)
  const blitzInSent = (attention?.sentLeadIds ?? []).includes(QA_LEAD_ID)
  const mergedCount = resolveCanonicalApprovalQueueCount(summary.canonicalOperatorApproval, 0)
  const waitingForApproval = summary.avaConsole.waitingForApproval
  const blitzInCanonical = (summary.canonicalOperatorApproval?.packages ?? []).some(
    (row) => row.leadId === QA_LEAD_ID,
  )

  console.log(
    JSON.stringify(
      {
        readyForReviewCount: attention?.readyForReview.length ?? 0,
        sentLeadIds: attention?.sentLeadIds ?? [],
        blitzInReadyForReview: blitzInReady,
        blitzInSentLeadIds: blitzInSent,
        readyCompanies: (attention?.readyForReview ?? []).map((row) => row.companyName),
        canonicalApprovalCount: mergedCount,
        waitingForApproval,
        blitzInCanonicalPackages: blitzInCanonical,
        topPackageCompany: summary.canonicalOperatorApproval?.topPackage?.companyName ?? null,
        currentLeadCompany: summary.canonicalOperatorFocus?.companyName ?? null,
      },
      null,
      2,
    ),
  )

  if (sentBlitz.length > 0) {
    if (blitzInReady) {
      throw new Error("production_regression: sent Blitz lead still in readyForReview")
    }
    if (blitzInCanonical) {
      throw new Error("production_regression: sent Blitz lead still in canonical approval packages")
    }
    if (!blitzInSent) {
      throw new Error("production_regression: sent Blitz lead missing from sentLeadIds")
    }
    console.log(`\n[${CERT_ID}] PASS — sent Blitz lead excluded from Home review projection`)
    return
  }

  console.log(`\n[${CERT_ID}] SKIP — no sent Blitz supervised generations in production (pre-send state)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
