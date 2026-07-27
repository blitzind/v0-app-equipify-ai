/**
 * AVA-BLOCK-IMAGING-FRESH-GENERATION-1A — Controlled Block Imaging stale-generation recovery.
 *
 * Dry-run (default):
 *   pnpm recover:ava-block-imaging-fresh-generation-1a:production
 *
 * Mutate (requires explicit confirmation — calls GPT, does NOT approve or send):
 *   AVA_BLOCK_IMAGING_FRESH_GENERATION_1A_CONFIRM=true pnpm recover:ava-block-imaging-fresh-generation-1a:production
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  auditSupervisedLeadGenerationState,
  AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
  BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
  recoverStaleSupervisedGenerationForLead,
} from "../lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"
import type { SupabaseClient } from "@supabase/supabase-js"

const RECOVERY_ACTOR_USER_ID = "00000000-0000-4000-8000-000000000001" as const

async function resolveActingUser(admin: SupabaseClient): Promise<{ userId: string; email: string }> {
  const preferredEmail = (getPlatformAdminEmails()[0] ?? "mike@blitzind.com").trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail)
  if (!match?.id) throw new Error(`acting_user_not_found:${preferredEmail}`)
  return { userId: match.id, email: match.email ?? preferredEmail }
}

function bootstrapOpenAiKeyFromLegacyHideFiles(cwd = process.cwd()): void {
  if (process.env.OPENAI_API_KEY?.trim()) return
  for (const relative of [
    ".env.local.rebuild.equipify-build-hidden",
    ".env.local.active.equipify-vercel-run-hidden",
  ]) {
    const absolute = resolve(cwd, relative)
    if (!existsSync(absolute)) continue
    for (const line of readFileSync(absolute, "utf8").split("\n")) {
      if (!line.startsWith("OPENAI_API_KEY=")) continue
      let value = line.slice("OPENAI_API_KEY=".length).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (value.length < 20) continue
      process.env.OPENAI_API_KEY = value
      if (!process.env.AI_ENABLED_PROVIDERS?.trim()) process.env.AI_ENABLED_PROVIDERS = "openai"
      return
    }
  }
}

function bootstrapRecoveryRuntimeEnv(): void {
  process.env.GROWTH_RESEARCH_WEBSITE_ENABLED = "true"
  bootstrapOpenAiKeyFromLegacyHideFiles()
  if (!process.env.AI_ENABLED_PROVIDERS?.trim()) {
    process.env.AI_ENABLED_PROVIDERS = "openai"
  }
}

async function main(): Promise<void> {
  const confirm = process.env.AVA_BLOCK_IMAGING_FRESH_GENERATION_1A_CONFIRM === "true"
  const dryRun = !confirm

  console.log(
    `[${AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER}] Block Imaging recovery (${dryRun ? "dry-run" : "MUTATE"})`,
  )

  bootstrapRecoveryRuntimeEnv()

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const auditBefore = await auditSupervisedLeadGenerationState(cert.admin, {
    organizationId: orgId,
    leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  })

  console.log(JSON.stringify({ phase: "audit_before", auditBefore }, null, 2))

  const actingUser = await resolveActingUser(cert.admin)

  const result = await recoverStaleSupervisedGenerationForLead(cert.admin, {
    organizationId: orgId,
    leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
    actingUserId: actingUser.userId,
    actingUserEmail: actingUser.email,
    dryRun,
    expectedGenerationId: BLOCK_IMAGING_LEGACY_GENERATION_ID,
  })

  console.log(JSON.stringify({ phase: dryRun ? "dry_run_plan" : "recovery_result", result }, null, 2))

  if (!dryRun && result.auditAfter) {
    const checks = {
      oldGenerationDiscarded: result.discardedGenerationIds.includes(BLOCK_IMAGING_LEGACY_GENERATION_ID),
      newGenerationIdDiffers:
        Boolean(result.newGenerationId) && result.newGenerationId !== BLOCK_IMAGING_LEGACY_GENERATION_ID,
      exactlyOneActionable: result.auditAfter.actionableGenerationCount === 1,
      persistedBodyUnsigned: !result.auditAfter.persistedBodyHasLegacySignatureMarkers,
      noApprovalBinding: !result.auditAfter.hasApprovalBinding,
      noSenderAffinity: !result.auditAfter.hasSenderAffinity,
      notApproved: !result.auditAfter.generationApprovedAt,
      notSent: !result.auditAfter.generationSentAt,
      portfolioStillEligible: result.auditAfter.portfolioEligible,
    }
    console.log(JSON.stringify({ phase: "post_recovery_checks", checks }, null, 2))
  }

  if (!dryRun && !result.regenerationOk) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
