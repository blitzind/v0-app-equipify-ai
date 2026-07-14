/**
 * GE-AIOS-OPERATOR-UX-1A — Stop autonomous progression for a lead (server-only).
 *
 * Reuses Draft Factory durable state + Growth 5F package reject path.
 * Does not send, enroll, or create a parallel lifecycle store.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER } from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import {
  findAutonomousOutreachPreparationRunByPackageId,
  listOutreachPreparationRunsForLead,
  markAutonomousOutreachPackageApprovalDecision,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-core"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import type { AiOsDraftFactoryDurableLeadState } from "@/lib/growth/draft-factory/draft-factory-durable-types"

export type StopAutonomousWorkReason =
  | "operator_canceled"
  | "lead_archived"
  | "lead_disqualified"
  | "operator_permanent_delete"

export type StopAutonomousWorkForLeadResult = {
  qaMarker: typeof GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER
  organizationId: string
  leadId: string
  reason: StopAutonomousWorkReason
  draftFactoryPaused: boolean
  packagesRejected: number
  packageIds: string[]
}

async function listPendingPackagesForLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<string[]> {
  // Prefer lead-scoped list when available; fall back to package_id on DF state.
  try {
    const runs = await listOutreachPreparationRunsForLead(admin, organizationId, leadId)
    return runs
      .map((run) => run.approvalPackage)
      .filter(
        (pkg) =>
          pkg &&
          pkg.pendingHumanApproval === true &&
          pkg.packageApprovalDecision !== "approved" &&
          pkg.packageApprovalDecision !== "rejected",
      )
      .map((pkg) => pkg!.packageId)
  } catch {
    return []
  }
}

export async function pauseDraftFactoryWorkForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    reason: StopAutonomousWorkReason
    now?: string
  },
): Promise<boolean> {
  const now = input.now ?? new Date().toISOString()
  const repo = createPostgresDraftFactoryRepository(admin)
  const available = await repo.assertAvailable?.()
  if (available && !available.ok) {
    logGrowthEngine("completed_work_df_pause_skipped", {
      qa_marker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
      reason: available.reason,
      lead_id: input.leadId,
    })
    return false
  }

  const existing = await repo.getLeadState(input.organizationId, input.leadId)
  if (!existing) return false

  if (existing.state === "paused" && existing.pausedReason === input.reason) {
    return true
  }

  const next: AiOsDraftFactoryDurableLeadState = {
    ...existing,
    state: "paused",
    pausedReason: input.reason,
    nextEligibleWakeAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    updatedAt: now,
  }

  const wrote = await repo.upsertLeadState(next, existing.version)
  return wrote
}

export async function stopAutonomousWorkForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    reason: StopAutonomousWorkReason
    now?: string
    /** When provided, reject this package first (cancel work from package card). */
    packageId?: string | null
  },
): Promise<StopAutonomousWorkForLeadResult> {
  const now = input.now ?? new Date().toISOString()
  const packageIds = new Set<string>()

  if (input.packageId) {
    packageIds.add(input.packageId)
  }

  for (const id of await listPendingPackagesForLead(admin, input.organizationId, input.leadId)) {
    packageIds.add(id)
  }

  // Also pull package_id from DF state if present.
  try {
    const repo = createPostgresDraftFactoryRepository(admin)
    const df = await repo.getLeadState(input.organizationId, input.leadId)
    if (df?.packageId) packageIds.add(df.packageId)
  } catch {
    // ignore
  }

  let packagesRejected = 0
  for (const packageId of packageIds) {
    const existing = await findAutonomousOutreachPreparationRunByPackageId(
      admin,
      input.organizationId,
      packageId,
    ).catch(() => null)
    if (!existing?.approvalPackage) continue
    if (
      existing.approvalPackage.packageApprovalDecision === "approved" ||
      existing.approvalPackage.packageApprovalDecision === "rejected"
    ) {
      continue
    }
    await markAutonomousOutreachPackageApprovalDecision({
      admin,
      organizationId: input.organizationId,
      packageId,
      decision: "rejected",
      now,
    })
    packagesRejected += 1
  }

  const draftFactoryPaused = await pauseDraftFactoryWorkForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    reason: input.reason,
    now,
  })

  logGrowthEngine("completed_work_autonomous_work_stopped", {
    qa_marker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    reason: input.reason,
    draft_factory_paused: draftFactoryPaused,
    packages_rejected: packagesRejected,
    package_ids: [...packageIds],
  })

  invalidateCanonicalDecisionCacheForLead(input.leadId, `autonomy_stopped:${input.reason}`)

  return {
    qaMarker: GROWTH_AIOS_OPERATOR_UX_1A_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    reason: input.reason,
    draftFactoryPaused,
    packagesRejected,
    packageIds: [...packageIds],
  }
}
