/**
 * AVA-HOME-PROJECTION-CUTOVER-1A — Production-backed Home projection validation (read-only).
 *
 * Run:
 *   pnpm run:ava-home-projection-cutover-1a-production-validation
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "../lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "../lib/growth/home/growth-home-workspace-summary-service"
import { AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER } from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a-types"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { synthesizeGrowthHomeExecutiveBriefing } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { partitionOperatorWaitingItems } from "../lib/growth/aios/operator-experience/growth-operator-home-ava-direct-2a"

const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function bootstrapSupabaseFromLegacyHideFiles(cwd = process.cwd()): void {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return
  }
  for (const relative of [
    ".env.local.active.equipify-vercel-run-hidden",
    ".env.local.rebuild.equipify-build-hidden",
  ]) {
    const absolute = resolve(cwd, relative)
    if (!existsSync(absolute)) continue
    for (const line of readFileSync(absolute, "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]?.trim()) process.env[key] = value
    }
  }
}

async function bootstrapProductionAdminAsync(): Promise<SupabaseClient> {
  bootstrapSupabaseFromLegacyHideFiles()
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    const ref = resolveLinkedSupabaseProjectRef()
    if (!ref) throw new Error("Supabase credentials unavailable.")
    process.env.NEXT_PUBLIC_SUPABASE_URL = resolveSupabaseUrlForProjectRef(ref)
    process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = await fetchSupabaseServiceRoleKeyFromCli(ref)
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function resolveActingUser(admin: SupabaseClient): Promise<{ userId: string; email: string }> {
  const preferredEmail = (
    process.env.GROWTH_PROOF_ACTOR_EMAIL?.trim() ||
    getPlatformAdminEmails()[0] ||
    "mike@blitzind.com"
  )
    .trim()
    .toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail)
  if (!match?.id) throw new Error(`acting_user_not_found:${preferredEmail}`)
  return { userId: match.id, email: match.email ?? preferredEmail }
}

async function main(): Promise<void> {
  console.log(`[${AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER}] production validation (read-only)`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"

  const certBootstrap =
    bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false }) ??
    null

  const admin = certBootstrap?.admin ?? (await bootstrapProductionAdminAsync())
  const actingUser = certBootstrap
    ? { userId: certBootstrap.actorUserId, email: certBootstrap.operatorEmail }
    : await resolveActingUser(admin)

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const workspaceSummary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: actingUser.email,
    actorUserId: actingUser.userId,
  })

  const attention = workspaceSummary.supervisedOperatorAttention
  const approval = workspaceSummary.canonicalOperatorApproval
  const focus = workspaceSummary.canonicalOperatorFocus

  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard: workspaceSummary.dashboard,
    missionDiscovery: workspaceSummary.missionDiscovery,
    portfolioBelowTarget: (workspaceSummary.portfolioManager?.health.needsCount ?? 0) > 0,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.health.counts.activeCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.target.targetActiveCompanies ?? null,
    canonicalOperatorApproval: approval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: focus,
    supervisedOperatorAttention: attention,
  })

  const partitioned = partitionOperatorWaitingItems(briefing.aiOsUx.waitingOnYou)

  const readyForReviewCount = attention?.readyForReview.length ?? 0
  const needsInformationCount = attention?.needsInformation.length ?? 0
  const primaryMission =
    workspaceSummary.productionMissionAuthority?.operatorSummaryLines[0] ??
    focus?.title ??
    workspaceSummary.canonicalOperatorTask?.title ??
    null
  const primaryCompany =
    approval?.topPackage?.companyName ??
    focus?.companyName ??
    null
  const blockImagingInReady = (attention?.readyForReview ?? []).some(
    (row) => row.leadId === BLOCK_IMAGING_LEAD_ID || /block imaging/i.test(row.companyName),
  )
  const blockImagingIsPrimary = /block imaging/i.test(primaryCompany ?? "")
  const diversePowerIsPrimary = /diverse power/i.test(primaryCompany ?? "")
  const reviewUrl =
    attention?.readyForReview.find((row) => row.leadId === BLOCK_IMAGING_LEAD_ID)?.reviewHref ??
    approval?.topPackage?.reviewHref ??
    null

  console.log("")
  console.log("Production validation report")
  console.log("==========================")
  console.log(`organizationId: ${organizationId}`)
  console.log(`readyForReviewCount: ${readyForReviewCount}`)
  console.log(`needsInformationCount: ${needsInformationCount}`)
  console.log(`uiReadyForReviewCount: ${partitioned.readyForReview.length}`)
  console.log(`uiNeedsInformationCount: ${partitioned.needsInformation.length}`)
  console.log(`primaryMission: ${primaryMission ?? "(none)"}`)
  console.log(`primaryCompany: ${primaryCompany ?? "(none)"}`)
  console.log(`blockImagingInReadyForReview: ${blockImagingInReady}`)
  console.log(`blockImagingIsPrimaryCompany: ${blockImagingIsPrimary}`)
  console.log(`diversePowerSuppressedFromPrimary: ${!diversePowerIsPrimary}`)
  console.log(`reviewUrl: ${reviewUrl ?? "(none)"}`)
  console.log(`rejectedCount: ${attention?.rejectedCount ?? 0}`)
  console.log(`approvalPackageCount: ${approval?.packages.length ?? 0}`)
  console.log(`topPackageItemId: ${approval?.topPackage?.itemId ?? "(none)"}`)

  if (readyForReviewCount > 0) {
    console.log("")
    console.log("Ready for review:")
    for (const row of attention?.readyForReview ?? []) {
      console.log(
        `  - ${row.companyName} (${row.leadId}) subject="${row.subject}" review=${row.reviewHref}`,
      )
    }
  }

  if (needsInformationCount > 0) {
    console.log("")
    console.log("Needs information:")
    for (const row of attention?.needsInformation ?? []) {
      console.log(`  - ${row.companyName} (${row.leadId}) decision=${row.decision}`)
    }
  }

  console.log("")
  console.log(`[${AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER}] production validation complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
