/**
 * AVA-OUTREACH-PIPELINE-RECOVERY-1A — Controlled production orphan repair (dry-run default).
 *
 * Dry-run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/repair-ava-outreach-pipeline-orphans-1a-production.ts
 *
 * Mutate (requires explicit confirmation):
 *   AVA_OUTREACH_PIPELINE_RECOVERY_1A_CONFIRM=true ... (same command)
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository"
import {
  lookupDraftFactoryApprovalArtifactsForLead,
  planOrphanApprovalPackageReconcileForOrganization,
  reconcileOrphanApprovalPackagesForOrganization,
  buildOrphanApprovalPackageRecoveryEvidence,
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-service-1a"
import {
  loadSupervisedAvaGenerationsForHome,
  buildSupervisedAvaHomeOperatorAttention,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { loadCanonicalOperatorApprovalSnapshotForHome } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader"
import { buildGrowthHomeReviewQueuePresentation } from "@/lib/growth/home/growth-home-review-queue-1b"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

const REPAIR_MARKER = "ava-outreach-pipeline-recovery-1a-production-repair-v1" as const

const KNOWN_ORPHAN_LEAD_IDS = [
  "e7466319-9112-40a3-af46-d33c63f35823", // MD Equipment Services
  "4f443634-54bf-4eb9-a114-93a287712a83", // ClaimLinx
  "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5", // Diverse Power Foundation
] as const

const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
const BLOCK_IMAGING_GEN_ID = "2bbacf99-b884-442f-a5b2-ce78132368cf" as const

async function countDraftFactoryByState(admin: SupabaseClient, orgId: string) {
  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("state")
    .eq("organization_id", orgId)
  if (error) throw new Error(error.message)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    const state = String(row.state ?? "unknown")
    counts[state] = (counts[state] ?? 0) + 1
  }
  return counts
}

async function classifyStopInvestment(admin: SupabaseClient, orgId: string, hours = 72) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, paused_reason, last_error_code, updated_at")
    .eq("organization_id", orgId)
    .eq("state", "paused")
    .gte("updated_at", since)
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const stopInvestment = rows.filter((row) => row.paused_reason === "stop_investment")
  const byReason: Record<string, number> = {}
  for (const row of stopInvestment) {
    const reason = String(row.last_error_code ?? row.paused_reason ?? "stop_investment")
    byReason[reason] = (byReason[reason] ?? 0) + 1
  }

  return {
    pausedRecent: rows.length,
    stopInvestmentRecent: stopInvestment.length,
    stopInvestmentByReason: byReason,
  }
}

async function simulateHomeQueue(admin: SupabaseClient, orgId: string) {
  const snapshot = await loadCanonicalOperatorApprovalSnapshotForHome(admin, { organizationId: orgId })
  const leadIds = [
    ...new Set([...snapshot.packages.map((p) => p.leadId), BLOCK_IMAGING_LEAD_ID]),
  ]
  const generations = await loadSupervisedAvaGenerationsForHome(admin, leadIds)
  const attention = buildSupervisedAvaHomeOperatorAttention({ generations, leadsById: new Map() })
  const merged = mergeSupervisedAvaIntoApprovalSnapshot({ base: snapshot, attention })
  const queue = buildGrowthHomeReviewQueuePresentation({ packages: merged.packages, needsInformation: attention.needsInformation })
  return queue
}

async function inspectKnownLeads(admin: SupabaseClient, orgId: string) {
  const results = []
  for (const leadId of [...KNOWN_ORPHAN_LEAD_IDS, BLOCK_IMAGING_LEAD_ID]) {
    const [df, lead, artifacts] = await Promise.all([
      admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("*")
        .eq("organization_id", orgId)
        .eq("lead_id", leadId)
        .maybeSingle(),
      fetchGrowthLeadById(admin, leadId).catch(() => null),
      lookupDraftFactoryApprovalArtifactsForLead(admin, {
        organizationId: orgId,
        leadId,
        packageId: null,
      }).catch(() => null),
    ])
    const dfRow = df.data
    const packageId = dfRow?.package_id ? String(dfRow.package_id) : null
    const artifactLookup = packageId
      ? await lookupDraftFactoryApprovalArtifactsForLead(admin, {
          organizationId: orgId,
          leadId,
          packageId,
        })
      : artifacts

    const { data: gen } = await admin
      .schema("growth")
      .from("ai_copilot_generations")
      .select("id, status, created_at")
      .eq("lead_id", leadId)
      .eq("prompt_variant", "ava_direct_production_cutover_1a")
      .in("status", ["draft", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    results.push({
      leadId,
      companyName: lead?.companyName ?? null,
      draftFactory: dfRow
        ? {
            state: dfRow.state,
            packageId: dfRow.package_id,
            updatedAt: dfRow.updated_at,
          }
        : null,
      supervisedGeneration: gen ?? null,
      artifactLookup,
      protected: leadId === BLOCK_IMAGING_LEAD_ID,
    })
  }
  return results
}

async function main(): Promise<void> {
  const dryRun = process.env.AVA_OUTREACH_PIPELINE_RECOVERY_1A_CONFIRM !== "true"
  console.log(`[${REPAIR_MARKER}] dryRun=${dryRun}`)

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("BLOCKED — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const now = new Date().toISOString()

  const repository = createPostgresDraftFactoryRepository(admin)
  const available = await repository.assertAvailable?.()
  if (available && !available.ok) {
    console.error(`Draft factory postgres unavailable: ${available.reason}`)
    process.exit(1)
  }

  const beforeCounts = await countDraftFactoryByState(admin, orgId)
  const beforeHome = await simulateHomeQueue(admin, orgId)
  const beforeLeads = await inspectKnownLeads(admin, orgId)
  const plan = await planOrphanApprovalPackageReconcileForOrganization(admin, {
    organizationId: orgId,
    repository,
  })

  const stopInvestmentAudit = await classifyStopInvestment(admin, orgId)

  const { data: aslCron } = await admin
    .schema("growth")
    .from("cron_execution_runs")
    .select("started_at, ok, metadata")
    .ilike("cron_route", "%growth-objective-runtime-scheduler%")
    .order("started_at", { ascending: false })
    .limit(5)

  const execution = dryRun
    ? {
        qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
        organizationId: orgId,
        dryRun: true,
        candidatesFound: plan.candidatesFound,
        attempted: 0,
        corrected: 0,
        skipped: plan.skippedAlreadyCorrect,
        failed: 0,
        mutations: plan.candidates.map((candidate) => ({
          leadId: candidate.leadId,
          previousState: candidate.previousState.state,
          previousPackageId: candidate.packageId,
          orphanReason: candidate.orphanReason,
          readiness: candidate.recovery.readiness,
          stageGate: candidate.recovery.stageGate,
          nextState: candidate.recovery.nextState,
          nextPackageId: null,
          nextEarliestIncompleteStage: candidate.recovery.nextEarliestIncompleteStage,
          pausedReason: candidate.recovery.pausedReason,
          reason: candidate.recovery.reason,
        })),
      }
    : await reconcileOrphanApprovalPackagesForOrganization(admin, {
        organizationId: orgId,
        repository,
        now,
        workerId: `repair:${REPAIR_MARKER}`,
        dryRun: false,
        limit: KNOWN_ORPHAN_LEAD_IDS.length,
      })

  const afterCounts = dryRun ? beforeCounts : await countDraftFactoryByState(admin, orgId)
  const afterHome = dryRun ? beforeHome : await simulateHomeQueue(admin, orgId)
  const afterLeads = dryRun ? beforeLeads : await inspectKnownLeads(admin, orgId)

  const orphanDryRunDetails = await Promise.all(
    KNOWN_ORPHAN_LEAD_IDS.map(async (leadId) => {
      const lead = await fetchGrowthLeadById(admin, leadId).catch(() => null)
      const df = await admin
        .schema("growth")
        .from("draft_factory_lead_states")
        .select("state, package_id, paused_reason")
        .eq("organization_id", orgId)
        .eq("lead_id", leadId)
        .maybeSingle()
      const packageId = df.data?.package_id ? String(df.data.package_id) : null
      const lookup = packageId
        ? await lookupDraftFactoryApprovalArtifactsForLead(admin, {
            organizationId: orgId,
            leadId,
            packageId,
          })
        : null
      const recovery = await buildOrphanApprovalPackageRecoveryEvidence(admin, {
        organizationId: orgId,
        leadId,
      }).catch(() => null)
      const planCandidate = plan.candidates.find((row) => row.leadId === leadId)
      return {
        leadId,
        companyName: lead?.companyName ?? null,
        oldState: df.data?.state ?? null,
        oldPackageId: packageId,
        orphanReason: planCandidate?.orphanReason ?? null,
        artifactLookup: lookup,
        readiness: recovery?.readiness ?? planCandidate?.recovery.readiness ?? null,
        proposedRecoveryState: recovery?.nextState ?? planCandidate?.recovery.nextState ?? null,
        stageGate: recovery?.stageGate ?? planCandidate?.recovery.stageGate ?? null,
        pausedReason: recovery?.pausedReason ?? planCandidate?.recovery.pausedReason ?? null,
        reason: recovery?.reason ?? planCandidate?.recovery.reason ?? null,
      }
    }),
  )

  console.log(
    JSON.stringify(
      {
        repairMarker: REPAIR_MARKER,
        qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
        organizationId: orgId,
        dryRun,
        confirmRequiredEnv: "AVA_OUTREACH_PIPELINE_RECOVERY_1A_CONFIRM=true",
        plan: {
          candidatesFound: plan.candidatesFound,
          skippedAlreadyCorrect: plan.skippedAlreadyCorrect,
          candidateLeadIds: plan.candidates.map((row) => row.leadId),
        },
        orphanDryRunDetails,
        execution,
        before: {
          draftFactoryCounts: beforeCounts,
          homeAwaitingReview: beforeHome.awaitingReviewCount,
          homeRowCount: beforeHome.rows.length,
          knownLeads: beforeLeads,
        },
        after: {
          draftFactoryCounts: afterCounts,
          homeAwaitingReview: afterHome.awaitingReviewCount,
          homeRowCount: afterHome.rows.length,
          knownLeads: afterLeads,
        },
        blockImagingProtected: {
          leadId: BLOCK_IMAGING_LEAD_ID,
          generationId: BLOCK_IMAGING_GEN_ID,
          unchanged:
            JSON.stringify(beforeLeads.find((row) => row.leadId === BLOCK_IMAGING_LEAD_ID)) ===
            JSON.stringify(afterLeads.find((row) => row.leadId === BLOCK_IMAGING_LEAD_ID)),
        },
        stopInvestmentAudit,
        recentObjectiveSchedulerTicks: (aslCron ?? []).map((row) => ({
          startedAt: row.started_at,
          ok: row.ok,
          autonomousSalesLoop: (row.metadata as { autonomous_sales_loop?: unknown } | null)
            ?.autonomous_sales_loop ?? null,
        })),
        safeToExecute:
          dryRun &&
          plan.candidatesFound > 0 &&
          plan.candidates.every((row) => KNOWN_ORPHAN_LEAD_IDS.includes(row.leadId as (typeof KNOWN_ORPHAN_LEAD_IDS)[number])),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
