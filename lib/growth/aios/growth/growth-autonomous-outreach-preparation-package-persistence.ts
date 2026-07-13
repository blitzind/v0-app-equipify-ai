/**
 * GE-AIOS-AUTONOMY-1H — Durable Growth 5F approval package persistence (server-only).
 *
 * Loss point repaired: Draft Factory capacity/live generateViaGrowth5F previously called
 * buildAutonomousOutreachApprovalPackage and returned only packageId — the full body
 * was never written to growth.autonomous_outreach_preparation_runs.approval_package.
 *
 * Canonical ownership (preserved):
 *   Growth 5F pilot runs table → package payload owner
 *   Draft Factory → lifecycle/state + package_id pointer
 *   Completed Work / HAC → read projection from pilot runs
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import {
  GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
  buildOutreachPrepPackageId,
  parseOutreachPrepPackageId,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id"
import { buildAutonomousOutreachPreparationRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import {
  appendAutonomousOutreachPreparationRun,
  findAutonomousOutreachPreparationRunByPackageId,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { updateOutreachPreparationPilotRunApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import type {
  GrowthAutonomousOutreachApprovalPackage,
  GrowthAutonomousOutreachPreparationWakeCondition,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

export {
  GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
  buildOutreachPrepPackageId,
  parseOutreachPrepPackageId,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id"

export type DraftFactoryGrowth5FPackageResult = {
  packageId: string
  pendingHumanApproval: true
  transportBlocked: true
  approvalPackage: GrowthAutonomousOutreachApprovalPackage
  reusedExisting: boolean
  previousPackage?: GrowthAutonomousOutreachApprovalPackage | null
}

/**
 * Idempotent: if the package body already exists for packageId, reuse it.
 * Otherwise build via Growth 5F and persist to autonomous_outreach_preparation_runs.
 */
export async function generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt: string
    companyName?: string | null
    wakeCondition?: GrowthAutonomousOutreachPreparationWakeCondition
  },
): Promise<DraftFactoryGrowth5FPackageResult | null> {
  const packageId = buildOutreachPrepPackageId(input.leadId, input.generatedAt)
  const wakeCondition = input.wakeCondition ?? "execution_completed"

  const existing = await findAutonomousOutreachPreparationRunByPackageId(
    admin,
    input.organizationId,
    packageId,
  ).catch(() => null)

  if (
    existing?.approvalPackage &&
    existing.approvalPackage.packageId === packageId &&
    existing.approvalPackage.pendingHumanApproval === true &&
    existing.approvalPackage.transportBlocked === true
  ) {
    logGrowthEngine("growth_5f_approval_package_reused", {
      qa_marker: GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      package_id: packageId,
    })
    return {
      packageId,
      pendingHumanApproval: true,
      transportBlocked: true,
      approvalPackage: existing.approvalPackage,
      reusedExisting: true,
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null

  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  if (!snapshot) return null

  const approvalPackage = await buildAutonomousOutreachApprovalPackage(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    companyName: input.companyName ?? lead.companyName,
    snapshot,
    generatedAt: input.generatedAt,
  })

  if (approvalPackage.pendingHumanApproval !== true || approvalPackage.transportBlocked !== true) {
    return null
  }

  // Guard: package id must match the Draft Factory pointer contract.
  if (approvalPackage.packageId !== packageId) {
    logGrowthEngine("growth_5f_approval_package_id_mismatch", {
      qa_marker: GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      expected: packageId,
      actual: approvalPackage.packageId,
    })
    return null
  }

  await appendAutonomousOutreachPreparationRun({
    admin,
    organizationId: input.organizationId,
    now: input.generatedAt,
    run: buildAutonomousOutreachPreparationRunRecord({
      leadId: input.leadId,
      companyName: approvalPackage.companyName,
      wakeCondition,
      generatedAt: input.generatedAt,
      outcome: "completed",
      packageId: approvalPackage.packageId,
      confidence: approvalPackage.confidence,
      revenueOperatorHandoff: "human_review_required",
      approvalPackage,
    }),
  })

  logGrowthEngine("growth_5f_approval_package_persisted", {
    qa_marker: GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    package_id: packageId,
    asset_count: approvalPackage.generatedAssets.length,
    pending_human_approval: true,
    transport_blocked: true,
  })

  return {
    packageId,
    pendingHumanApproval: true,
    transportBlocked: true,
    approvalPackage,
    reusedExisting: false,
  }
}

/**
 * Historical recovery: rebuild+persist using the original packageId's generatedAt
 * so Draft Factory's existing package_id continues to resolve. Does not mutate DF.
 */
export async function recoverAutonomousOutreachApprovalPackagePayload(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    wakeCondition?: GrowthAutonomousOutreachPreparationWakeCondition
  },
): Promise<DraftFactoryGrowth5FPackageResult | null> {
  const parsed = parseOutreachPrepPackageId(input.packageId)
  if (!parsed) return null

  return generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory(admin, {
    organizationId: input.organizationId,
    leadId: parsed.leadId,
    generatedAt: parsed.generatedAt,
    wakeCondition: input.wakeCondition ?? "execution_completed",
  })
}

/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1C — Force rebuild of an existing package body using
 * the canonical Growth 5F strategy-first path. Preserves packageId / runId; does not mutate Draft Factory.
 */
export async function rebuildAutonomousOutreachApprovalPackagePayload(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    wakeCondition?: GrowthAutonomousOutreachPreparationWakeCondition
    rebuildReason?: string
  },
): Promise<DraftFactoryGrowth5FPackageResult | null> {
  const parsed = parseOutreachPrepPackageId(input.packageId)
  if (!parsed) return null

  const existing = await findAutonomousOutreachPreparationRunByPackageId(
    admin,
    input.organizationId,
    input.packageId,
  ).catch(() => null)

  const previousPackage = existing?.approvalPackage ?? null

  const lead = await fetchGrowthLeadById(admin, parsed.leadId)
  if (!lead) return null

  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: parsed.leadId,
  })
  if (!snapshot) return null

  const approvalPackage = await buildAutonomousOutreachApprovalPackage(admin, {
    organizationId: input.organizationId,
    leadId: parsed.leadId,
    companyName: lead.companyName,
    snapshot,
    generatedAt: parsed.generatedAt,
  })

  if (approvalPackage.pendingHumanApproval !== true || approvalPackage.transportBlocked !== true) {
    return null
  }
  if (approvalPackage.packageId !== input.packageId) {
    return null
  }

  const run =
    existing ??
    buildAutonomousOutreachPreparationRunRecord({
      leadId: parsed.leadId,
      companyName: approvalPackage.companyName,
      wakeCondition: input.wakeCondition ?? "execution_completed",
      generatedAt: parsed.generatedAt,
      outcome: "completed",
      packageId: approvalPackage.packageId,
      confidence: approvalPackage.confidence,
      revenueOperatorHandoff: "human_review_required",
      approvalPackage,
    })

  const updatedRun = {
    ...run,
    approvalPackage,
    packageId: approvalPackage.packageId,
    confidence: approvalPackage.confidence,
    completedAt: parsed.generatedAt,
  }

  if (existing) {
    await updateOutreachPreparationPilotRunApprovalPackage(admin, {
      organizationId: input.organizationId,
      runId: existing.runId,
      approvalPackage,
      confidence: approvalPackage.confidence,
      now: parsed.generatedAt,
    })
  } else {
    await appendAutonomousOutreachPreparationRun({
      admin,
      organizationId: input.organizationId,
      now: parsed.generatedAt,
      run: updatedRun,
    })
  }

  logGrowthEngine("growth_5f_approval_package_rebuilt", {
    qa_marker: GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: parsed.leadId,
    package_id: input.packageId,
    rebuild_reason: input.rebuildReason ?? "master_knowledge_refresh",
    had_previous_body: Boolean(previousPackage),
  })

  return {
    packageId: input.packageId,
    pendingHumanApproval: true,
    transportBlocked: true,
    approvalPackage,
    reusedExisting: false,
    previousPackage,
  }
}
