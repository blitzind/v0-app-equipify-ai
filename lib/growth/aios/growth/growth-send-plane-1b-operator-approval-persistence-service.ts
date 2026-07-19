/** GE-AIOS-SEND-PLANE-1B — Persist operator draft edits into Growth 5F package (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { findOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import { updateOutreachPreparationPilotRunApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  applyOperatorDraftEditsToPackage,
  freezeApprovedOperatorAssetsOnPackage,
  GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER,
  type SendPlane1BEditablePackageChannel,
} from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { resolveSupervisedApprovedSenderAccountId } from "@/lib/growth/sequences/execution/growth-supervised-sender-resolution-1c"

export async function persistOperatorPackageDraftEdits(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    leadId: string
    operatorUserId: string
    draftEdits: Partial<Record<SendPlane1BEditablePackageChannel, string>>
    now?: string
  },
): Promise<GrowthAutonomousOutreachApprovalPackage | null> {
  const existing = await findOutreachPreparationRunByPackageId(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
  })

  const pkg = existing?.approvalPackage
  if (!pkg || pkg.leadId !== input.leadId) return null
  if (pkg.packageApprovalDecision === "approved" || pkg.packageApprovalDecision === "rejected") {
    throw new Error("outreach_package_already_decided")
  }

  const now = input.now ?? new Date().toISOString()
  const approvalPackage = applyOperatorDraftEditsToPackage({
    pkg,
    draftEdits: input.draftEdits,
    operatorUserId: input.operatorUserId,
    editedAt: now,
    companyName: pkg.companyName ?? pkg.salesStrategyBrief?.companyName ?? "",
  })

  await updateOutreachPreparationPilotRunApprovalPackage(admin, {
    organizationId: input.organizationId,
    runId: existing.runId,
    approvalPackage,
    confidence: approvalPackage.confidence,
    now,
  })

  logGrowthEngine("growth_5f_operator_draft_edits_persisted", {
    qa_marker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    package_id: input.packageId,
    channels: Object.keys(input.draftEdits),
  })

  return approvalPackage
}

export async function freezeOperatorApprovedPackageAssets(
  admin: SupabaseClient,
  input: {
    organizationId: string
    packageId: string
    approvedAt: string
    draftEdits?: Partial<Record<SendPlane1BEditablePackageChannel, string>>
    operatorUserId?: string | null
  },
): Promise<GrowthAutonomousOutreachApprovalPackage | null> {
  const existing = await findOutreachPreparationRunByPackageId(admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
  })

  let pkg = existing?.approvalPackage ?? null
  if (!pkg) return null

  if (input.draftEdits && Object.keys(input.draftEdits).length > 0 && input.operatorUserId) {
    pkg = applyOperatorDraftEditsToPackage({
      pkg,
      draftEdits: input.draftEdits,
      operatorUserId: input.operatorUserId,
      editedAt: input.approvedAt,
      companyName: pkg.companyName ?? pkg.salesStrategyBrief?.companyName ?? "",
    })
  }

  const approvalPackage = freezeApprovedOperatorAssetsOnPackage({
    pkg,
    approvedAt: input.approvedAt,
  })

  const approvedSenderAccountId = await resolveSupervisedApprovedSenderAccountId(admin, {
    organizationId: input.organizationId,
    package: approvalPackage,
    explicitSenderAccountId: approvalPackage.approvedSenderAccountId ?? null,
  })

  const frozenPackage: GrowthAutonomousOutreachApprovalPackage = {
    ...approvalPackage,
    approvedSenderAccountId: approvedSenderAccountId ?? approvalPackage.approvedSenderAccountId ?? null,
  }

  if (existing) {
    await updateOutreachPreparationPilotRunApprovalPackage(admin, {
      organizationId: input.organizationId,
      runId: existing.runId,
      approvalPackage: frozenPackage,
      confidence: frozenPackage.confidence,
      now: input.approvedAt,
    })
  }

  return frozenPackage
}
