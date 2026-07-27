/**
 * AVA-OUTREACH-PIPELINE-RECOVERY-1A — Orphan waiting_for_approval reconcile execution (server-only).
 * Idempotent, non-destructive beyond clearing stale package pointers. Never sends email.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import type { DraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"
import type { AiOsDraftFactoryDurableLeadState } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  evaluateDraftFactoryApprovalArtifactPresence,
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
  isOrphanWaitingForApprovalRow,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"
import {
  applyOrphanApprovalPackageReconcileMutation,
  buildOrphanApprovalPackageReconcileMutation,
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
  isOrphanApprovalReconcileCorrectedOutcome,
  planOrphanApprovalPackageReconcile,
  resolveOrphanApprovalPackageRecoveryFromEvidence,
  type OrphanApprovalPackageReconcileMutation,
  type OrphanApprovalPackageRecoveryPlan,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-1a"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"

export {
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-1a"

export { GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"

export {
  resolveOrphanApprovalPackageRecoveryFromEvidence,
  type OrphanApprovalPackageRecoveryPlan,
  type OrphanApprovalPackageRecoveryReadiness,
} from "@/lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-1a"

export const GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_LIMIT_PER_ORG = 20
export const GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_POOL_LIMIT = 100

const SUPERVISED_PROMPT_VARIANT = "ava_direct_production_cutover_1a" as const

export type OrphanApprovalPackageArtifactLookup = {
  hasPreparationRunForPackageId: boolean
  preparationRunHasApprovalBody: boolean
  hasSupervisedGenerationForLead: boolean
}

export async function lookupDraftFactoryApprovalArtifactsForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    packageId: string | null
  },
): Promise<OrphanApprovalPackageArtifactLookup> {
  const packageId = input.packageId?.trim() || null

  const [prepRun, supervisedGen] = await Promise.all([
    packageId
      ? admin
          .schema("growth")
          .from("autonomous_outreach_preparation_runs")
          .select("id, approval_package")
          .eq("organization_id", input.organizationId)
          .eq("lead_id", input.leadId)
          .limit(20)
          .then(({ data, error }) => {
            if (error) throw new Error(error.message)
            return (data ?? []).find((row) => {
              const pkg = row.approval_package as { packageId?: string } | null
              return pkg?.packageId === packageId
            })
          })
          .catch(() => null)
      : Promise.resolve(null),
    admin
      .schema("growth")
      .from("ai_copilot_generations")
      .select("id")
      .eq("lead_id", input.leadId)
      .eq("generation_type", "cold_email")
      .eq("prompt_variant", SUPERVISED_PROMPT_VARIANT)
      .in("status", ["draft", "approved"])
      .limit(1)
      .maybeSingle()
      .then(({ data }) => Boolean(data?.id))
      .catch(() => false),
  ])

  const approvalPackage = prepRun?.approval_package as
    | {
        packageId?: string
        pendingHumanApproval?: boolean
        transportBlocked?: boolean
        generatedAssets?: unknown[]
      }
    | null
    | undefined

  return {
    hasPreparationRunForPackageId: Boolean(prepRun),
    preparationRunHasApprovalBody: Boolean(
      approvalPackage?.packageId === packageId &&
        approvalPackage.pendingHumanApproval === true &&
        approvalPackage.transportBlocked === true &&
        Array.isArray(approvalPackage.generatedAssets) &&
        approvalPackage.generatedAssets.length > 0,
    ),
    hasSupervisedGenerationForLead: supervisedGen,
  }
}

export async function listWaitingForApprovalDraftFactoryStates(
  input: {
    organizationId: string
    repository: DraftFactoryDurableRepository
    limit?: number
  },
): Promise<AiOsDraftFactoryDurableLeadState[]> {
  const rows = await input.repository.listAdmissionIntegrityReconcileStates({
    organizationId: input.organizationId,
    limit: input.limit ?? GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_POOL_LIMIT,
  })
  return rows.filter((row) => row.state === "waiting_for_approval" && Boolean(row.packageId))
}

export async function buildOrphanApprovalPackageRecoveryEvidence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
  },
): Promise<OrphanApprovalPackageRecoveryPlan> {
  const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
  const portfolioEligibility = lead
    ? evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: input.organizationId })
    : null

  const evidence = await buildCanonicalEvidenceForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    portfolioSelected: portfolioEligibility?.eligible === true,
  })

  return resolveOrphanApprovalPackageRecoveryFromEvidence(evidence)
}

export async function planOrphanApprovalPackageReconcileForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    repository: DraftFactoryDurableRepository
    limit?: number
  },
) {
  const rows = await listWaitingForApprovalDraftFactoryStates(input)
  const artifactRows = await Promise.all(
    rows.map(async (row) => {
      const lead = await fetchGrowthLeadById(admin, row.leadId).catch(() => null)
      const portfolioEligibility = lead
        ? evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: input.organizationId })
        : null
      const [lookup, recoveryEvidence] = await Promise.all([
        lookupDraftFactoryApprovalArtifactsForLead(admin, {
          organizationId: input.organizationId,
          leadId: row.leadId,
          packageId: row.packageId,
        }),
        buildCanonicalEvidenceForLead(admin, {
          organizationId: input.organizationId,
          leadId: row.leadId,
          portfolioSelected: portfolioEligibility?.eligible === true,
        }),
      ])

      return {
        leadId: row.leadId,
        state: row.state,
        packageId: row.packageId,
        artifactFacts: {
          state: row.state,
          packageId: row.packageId,
          hasPreparationRunForPackageId: lookup.hasPreparationRunForPackageId,
          preparationRunHasApprovalBody: lookup.preparationRunHasApprovalBody,
          hasSupervisedGenerationForLead: lookup.hasSupervisedGenerationForLead,
        },
        recoveryEvidence,
      }
    }),
  )

  return planOrphanApprovalPackageReconcile({ rows: artifactRows })
}

export type OrphanApprovalPackageReconcileExecutionResult = {
  qaMarker: typeof GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER
  organizationId: string
  dryRun: boolean
  candidatesFound: number
  attempted: number
  corrected: number
  skipped: number
  failed: number
  mutations: OrphanApprovalPackageReconcileMutation[]
}

export async function reconcileOrphanApprovalPackagesForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    repository: DraftFactoryDurableRepository
    now: string
    workerId: string
    dryRun?: boolean
    limit?: number
  },
): Promise<OrphanApprovalPackageReconcileExecutionResult> {
  const dryRun = input.dryRun !== false
  const plan = await planOrphanApprovalPackageReconcileForOrganization(admin, {
    organizationId: input.organizationId,
    repository: input.repository,
    limit: input.limit ?? GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_POOL_LIMIT,
  })

  const mutations: OrphanApprovalPackageReconcileMutation[] = []
  let attempted = 0
  let corrected = 0
  let failed = 0

  for (const candidate of plan.candidates.slice(0, input.limit ?? GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_LIMIT_PER_ORG)) {
    attempted += 1
    try {
      const existing = await input.repository.getLeadState(input.organizationId, candidate.leadId)
      if (!existing) {
        failed += 1
        continue
      }

      const lookup = await lookupDraftFactoryApprovalArtifactsForLead(admin, {
        organizationId: input.organizationId,
        leadId: existing.leadId,
        packageId: existing.packageId,
      })
      const artifact = evaluateDraftFactoryApprovalArtifactPresence({
        state: existing.state,
        packageId: existing.packageId,
        hasPreparationRunForPackageId: lookup.hasPreparationRunForPackageId,
        preparationRunHasApprovalBody: lookup.preparationRunHasApprovalBody,
        hasSupervisedGenerationForLead: lookup.hasSupervisedGenerationForLead,
      })
      if (
        !isOrphanWaitingForApprovalRow({
          state: existing.state,
          packageId: existing.packageId,
          artifact,
          hasSupervisedGenerationForLead: lookup.hasSupervisedGenerationForLead,
        })
      ) {
        continue
      }

      const recovery = await buildOrphanApprovalPackageRecoveryEvidence(admin, {
        organizationId: input.organizationId,
        leadId: existing.leadId,
      })

      const next = applyOrphanApprovalPackageReconcileMutation({
        row: existing,
        recovery,
        orphanReason: candidate.orphanReason,
        now: input.now,
        workerId: input.workerId,
      })
      if (!next) continue

      const mutation = buildOrphanApprovalPackageReconcileMutation({
        row: existing,
        recovery,
        orphanReason: candidate.orphanReason,
      })
      if (!mutation) continue

      mutations.push(mutation)

      if (!dryRun) {
        const wrote = await input.repository.upsertLeadState(next, existing.version)
        if (!wrote) {
          failed += 1
          continue
        }
        invalidateCanonicalDecisionCacheForLead(candidate.leadId, "orphan_approval_package_reconciled")
      }

      if (
        isOrphanApprovalReconcileCorrectedOutcome({
          previousState: existing.state,
          nextState: next.state,
          previousPackageId: existing.packageId,
          nextPackageId: next.packageId,
        })
      ) {
        corrected += 1
      }

      logGrowthEngine("draft_factory_orphan_approval_package_reconciled", {
        qa_marker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
        artifact_qa_marker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
        organization_id: input.organizationId,
        lead_id: candidate.leadId,
        dry_run: dryRun,
        previous_state: existing.state,
        next_state: next.state,
        previous_package_id: existing.packageId,
        next_package_id: next.packageId,
        stage_gate: recovery.stageGate,
        paused_reason: recovery.pausedReason,
      })
    } catch (error) {
      failed += 1
      logGrowthEngine("draft_factory_orphan_approval_package_reconcile_failed", {
        qa_marker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
        organization_id: input.organizationId,
        lead_id: candidate.leadId,
        dry_run: dryRun,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  return {
    qaMarker: GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
    organizationId: input.organizationId,
    dryRun,
    candidatesFound: plan.candidatesFound,
    attempted,
    corrected,
    skipped: plan.skippedAlreadyCorrect,
    failed,
    mutations,
  }
}
