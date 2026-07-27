/**
 * AVA-SUPERVISED-GPT-SCHEDULER-WIRING-1A — Production probe.
 *
 * Read-only:
 *   pnpm probe:ava-supervised-gpt-scheduler-wiring-1a:production
 *
 * Reconcile legacy proof packages + bounded scheduler execution:
 *   AVA_SUPERVISED_GPT_SCHEDULER_WIRING_1A_EXECUTE=true pnpm probe:ava-supervised-gpt-scheduler-wiring-1a:production
 */

import type { SupabaseClient } from "@supabase/supabase-js"
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
import { isSupervisedCutoverLegacyApprovalBlocker } from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"
import {
  lookupDraftFactoryApprovalArtifactsForLead,
  reconcileOrphanApprovalPackagesForOrganization,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-service-1a"
import { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const CERT_ID = "ava-supervised-gpt-scheduler-wiring-1a-v1" as const
const EXECUTE = process.env.AVA_SUPERVISED_GPT_SCHEDULER_WIRING_1A_EXECUTE === "true"

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

function bootstrapSupervisedSchedulerProofEnv(): void {
  bootstrapVerifiedChannelsCertEnv()
  bootstrapOpenAiKeyFromLegacyHideFiles()
  process.env.GROWTH_RESEARCH_WEBSITE_ENABLED = "true"
  if (!process.env.AI_ENABLED_PROVIDERS?.trim()) {
    process.env.AI_ENABLED_PROVIDERS = "openai"
  }
}

const PROOF_CANDIDATES = [
  { name: "MD Equipment Services", leadId: "e7466319-9112-40a3-af46-d33c63f35823" },
  { name: "ClaimLinx", leadId: "4f443634-54bf-4eb9-a114-93a287712a83" },
  { name: "Diverse Power Foundation", leadId: "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5" },
] as const

async function clearProofLeadGenerationBackoff(
  admin: SupabaseClient,
  orgId: string,
  leadIds: readonly string[],
): Promise<number> {
  let cleared = 0
  for (const leadId of leadIds) {
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
    if (!error) cleared += 1
  }
  return cleared
}

async function inspectLead(admin: SupabaseClient, orgId: string, candidate: { name: string; leadId: string }) {
  const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
  const dfState =
    resolved.kind === "postgres"
      ? await resolved.repository.getLeadState(orgId, candidate.leadId)
      : null

  const artifacts = await lookupDraftFactoryApprovalArtifactsForLead(admin, {
    organizationId: orgId,
    leadId: candidate.leadId,
    packageId: dfState?.packageId ?? null,
  })

  const legacyBlocker = isSupervisedCutoverLegacyApprovalBlocker({
    state: dfState?.state ?? "",
    packageId: dfState?.packageId ?? null,
    hasSupervisedGenerationForLead: artifacts.hasSupervisedGenerationForLead,
  })

  const gens = await listGrowthAiCopilotGenerationsForLead(admin, candidate.leadId).catch(() => [])
  const supervised = gens.filter((gen) => isAvaSupervisedOutboundGeneration(gen.metadata ?? {}))

  return {
    company: candidate.name,
    leadId: candidate.leadId,
    draftFactoryState: dfState?.state ?? null,
    draftFactoryPackageId: dfState?.packageId ?? null,
    legacyApprovalBlocker: legacyBlocker,
    hasSupervisedGeneration: artifacts.hasSupervisedGenerationForLead,
    supervisedGenerationCount: supervised.length,
    latestSupervised: supervised[0]
      ? {
          id: supervised[0].id,
          status: supervised[0].status,
          createdAt: supervised[0].created_at,
          decision: (supervised[0].metadata as Record<string, unknown>)?.recommendation ?? null,
          hasEmDash: containsProhibitedAvaOutboundStyleMarkers(supervised[0].body ?? ""),
          hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(supervised[0]),
          presentation: resolveAvaSupervisedOutboundApprovalPresentation(supervised[0].metadata ?? {}),
        }
      : null,
  }
}

async function main() {
  bootstrapGrowthOperatorNotificationsCertEnv()
  if (EXECUTE) {
    bootstrapSupervisedSchedulerProofEnv()
  }
  const admin = createServiceRoleClient()
  if (!admin) throw new Error("Service role client unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const proofStartedAt = new Date().toISOString()
  const now = proofStartedAt

  const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
  if (resolved.kind !== "postgres") {
    throw new Error(`Expected postgres draft factory repository, got ${resolved.kind}`)
  }

  const before = await Promise.all(PROOF_CANDIDATES.map((row) => inspectLead(admin, orgId, row)))

  let orphanReconcile = null
  if (EXECUTE) {
    orphanReconcile = await reconcileOrphanApprovalPackagesForOrganization(admin, {
      organizationId: orgId,
      repository: resolved.repository,
      now,
      workerId: `ava-supervised-gpt-scheduler-wiring-1a:${orgId}`,
      dryRun: false,
    })
  } else {
    orphanReconcile = await reconcileOrphanApprovalPackagesForOrganization(admin, {
      organizationId: orgId,
      repository: resolved.repository,
      now,
      workerId: `ava-supervised-gpt-scheduler-wiring-1a:${orgId}`,
      dryRun: true,
    })
  }

  const afterReconcile = await Promise.all(PROOF_CANDIDATES.map((row) => inspectLead(admin, orgId, row)))

  let proofWakeCleared = 0
  if (EXECUTE) {
    proofWakeCleared = await clearProofLeadGenerationBackoff(
      admin,
      orgId,
      PROOF_CANDIDATES.map((row) => row.leadId),
    )
  }

  let tickResult = null
  if (EXECUTE) {
    tickResult = await tickDraftFactoryDueStatesForScheduler(admin, {
      organizationIds: [orgId],
      maxRuntimeMs: 300_000,
    })
  }

  const after = await Promise.all(PROOF_CANDIDATES.map((row) => inspectLead(admin, orgId, row)))

  const freshGenerations = []
  for (const candidate of PROOF_CANDIDATES) {
    const gens = await listGrowthAiCopilotGenerationsForLead(admin, candidate.leadId).catch(() => [])
    for (const gen of gens) {
      if (!isAvaSupervisedOutboundGeneration(gen.metadata ?? {})) continue
      if (gen.created_at && gen.created_at >= proofStartedAt) {
        freshGenerations.push({
          company: candidate.name,
          leadId: candidate.leadId,
          generationId: gen.id,
          createdAt: gen.created_at,
          recommendation: (gen.metadata as Record<string, unknown>)?.recommendation ?? null,
          hasEmDash: containsProhibitedAvaOutboundStyleMarkers(gen.body ?? ""),
          hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(gen),
          presentation: resolveAvaSupervisedOutboundApprovalPresentation(gen.metadata ?? {}),
          status: gen.status,
        })
      }
    }
  }

  const portfolioLeads = []
  for (const candidate of PROOF_CANDIDATES) {
    const lead = await fetchGrowthLeadById(admin, candidate.leadId).catch(() => null)
    if (lead) portfolioLeads.push(lead)
  }
  const supervisedGens = await loadSupervisedAvaGenerationsForHome(
    admin,
    portfolioLeads.map((lead) => lead.id),
  )
  const homeAttention = buildSupervisedAvaHomeOperatorAttention({
    generations: supervisedGens,
    leadsById: new Map(portfolioLeads.map((lead) => [lead.id, lead])),
  })

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        execute: EXECUTE,
        organizationId: orgId,
        before,
        orphanReconcile,
        proofWakeCleared,
        afterReconcile,
        tickResult,
        after,
        freshGenerations,
        homeAwaitingReview: homeAttention.readyForReview.length,
        homeReadyForReview: homeAttention.readyForReview.map((row) => ({
          company: row.companyName,
          leadId: row.leadId,
          generationId: row.generationId,
          itemId: row.itemId,
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
