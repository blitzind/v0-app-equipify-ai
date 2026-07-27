/**
 * AVA-SCHEDULER-ACTOR-PERSISTENCE-HOTFIX-1A — Production probe.
 *
 * Read-only pre-check:
 *   pnpm probe:ava-scheduler-actor-persistence-hotfix-1a:production
 *
 * Controlled scheduler retry (one bounded tick):
 *   AVA_SCHEDULER_ACTOR_PERSISTENCE_HOTFIX_1A_EXECUTE=true pnpm probe:ava-scheduler-actor-persistence-hotfix-1a:production
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"
import { containsProhibitedAvaOutboundStyleMarkers } from "@/lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  buildSupervisedAvaHomeOperatorAttention,
  loadSupervisedAvaGenerationsForHome,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { buildDraftFactorySchedulerGenerationProvenance } from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import { lookupDraftFactoryApprovalArtifactsForLead } from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-service-1a"
import { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { runEquipifySupervisedAvaOutreach } from "@/lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import { GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL } from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import { createServiceRoleClient } from "@/lib/supabase/admin"

const CERT_ID = "ava-scheduler-actor-persistence-hotfix-1a-v1" as const
const EXECUTE = process.env.AVA_SCHEDULER_ACTOR_PERSISTENCE_HOTFIX_1A_EXECUTE === "true"

const DIVERSE_POWER = {
  name: "Diverse Power Foundation",
  leadId: "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5",
} as const

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

function bootstrapProbeEnv(): void {
  bootstrapVerifiedChannelsCertEnv()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  process.env.GROWTH_RESEARCH_WEBSITE_ENABLED = "true"
  if (!process.env.AI_ENABLED_PROVIDERS?.trim()) {
    process.env.AI_ENABLED_PROVIDERS = "openai"
  }
}

async function inspectDiversePower(admin: SupabaseClient, orgId: string) {
  const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
  const dfState =
    resolved.kind === "postgres"
      ? await resolved.repository.getLeadState(orgId, DIVERSE_POWER.leadId)
      : null

  const artifacts = await lookupDraftFactoryApprovalArtifactsForLead(admin, {
    organizationId: orgId,
    leadId: DIVERSE_POWER.leadId,
    packageId: dfState?.packageId ?? null,
  })

  const gens = await listGrowthAiCopilotGenerationsForLead(admin, DIVERSE_POWER.leadId).catch(() => [])
  const supervised = gens.filter((gen) => isAvaSupervisedOutboundGeneration(gen))

  return {
    company: DIVERSE_POWER.name,
    leadId: DIVERSE_POWER.leadId,
    draftFactoryState: dfState?.state ?? null,
    draftFactoryPackageId: dfState?.packageId ?? null,
    supervisedGenerationCount: supervised.length,
    hasApprovalBinding: supervised.some((gen) => hasValidMessageApprovalBindingForGeneration(gen)),
    hasSentGeneration: supervised.some((gen) => Boolean(gen.sentAt)),
    latestSupervised: supervised[0]
      ? {
          id: supervised[0].id,
          status: supervised[0].status,
          createdBy: supervised[0].createdBy,
          createdAt: supervised[0].createdAt,
          hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(supervised[0]),
          presentation: resolveAvaSupervisedOutboundApprovalPresentation(supervised[0]),
        }
      : null,
    artifacts: {
      hasSupervisedGenerationForLead: artifacts.hasSupervisedGenerationForLead,
      hasPreparationRunForPackageId: artifacts.hasPreparationRunForPackageId,
    },
  }
}

async function verifyActorPersistencePath(admin: SupabaseClient, orgId: string, now: string) {
  const probe = await runEquipifySupervisedAvaOutreach({
    admin,
    leadId: "00000000-0000-4000-8000-000000000099",
    organizationId: orgId,
    actingUserEmail: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL,
    autonomousProvenance: buildDraftFactorySchedulerGenerationProvenance({
      organizationId: orgId,
      generatedAt: now,
    }),
    persist: false,
  })
  return {
    passesActorGate: !(probe.ok === false && probe.code === "actor_invalid"),
    code: probe.ok ? "ok" : probe.code,
  }
}

async function clearGenerationBackoff(admin: SupabaseClient, orgId: string, leadId: string) {
  const { error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .update({
      next_eligible_wake_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .eq("state", "waiting_for_generation")
  return !error
}

async function main() {
  bootstrapGrowthOperatorNotificationsCertEnv()
  if (EXECUTE) bootstrapProbeEnv()

  const admin = createServiceRoleClient()
  if (!admin) throw new Error("Service role client unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const proofStartedAt = new Date().toISOString()

  const before = await inspectDiversePower(admin, orgId)
  const actorPath = await verifyActorPersistencePath(admin, orgId, proofStartedAt)

  let backoffCleared = false
  let tickResult = null
  if (EXECUTE) {
    backoffCleared = await clearGenerationBackoff(admin, orgId, DIVERSE_POWER.leadId)
    tickResult = await tickDraftFactoryDueStatesForScheduler(admin, {
      organizationIds: [orgId],
      maxRuntimeMs: 300_000,
    })
  }

  const after = await inspectDiversePower(admin, orgId)

  const lead = await fetchGrowthLeadById(admin, DIVERSE_POWER.leadId).catch(() => null)
  const supervisedGens = lead
    ? await loadSupervisedAvaGenerationsForHome(admin, [lead.id])
    : []
  const homeAttention = buildSupervisedAvaHomeOperatorAttention({
    generations: supervisedGens,
    leadsById: lead ? new Map([[lead.id, lead]]) : new Map(),
  })

  const freshGenerations = []
  const gens = await listGrowthAiCopilotGenerationsForLead(admin, DIVERSE_POWER.leadId).catch(() => [])
  for (const gen of gens) {
    if (!isAvaSupervisedOutboundGeneration(gen)) continue
    if (gen.createdAt && gen.createdAt >= proofStartedAt) {
      freshGenerations.push({
        generationId: gen.id,
        createdAt: gen.createdAt,
        createdBy: gen.createdBy,
        status: gen.status,
        recommendation: gen.classification?.primary ?? null,
        hasEmDash: containsProhibitedAvaOutboundStyleMarkers(gen.generatedContent ?? ""),
        hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(gen),
        presentation: resolveAvaSupervisedOutboundApprovalPresentation(gen),
        inputSnapshotProvenance: gen.inputSnapshot?.autonomousProvenance ?? null,
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        execute: EXECUTE,
        organizationId: orgId,
        actorPersistencePath: actorPath,
        before,
        backoffCleared,
        tickResult,
        after,
        freshGenerations,
        homeAwaitingReview: homeAttention.readyForReview.length,
        homeReadyForReview: homeAttention.readyForReview.map((row) => ({
          company: row.companyName,
          leadId: row.leadId,
          generationId: row.generationId,
        })),
        invariants: { approved: false, sent: false },
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
