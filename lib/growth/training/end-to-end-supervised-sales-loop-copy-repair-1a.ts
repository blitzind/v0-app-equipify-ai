/**
 * GE-AIOS-END-TO-END-1A PHASE E2 — Supervised sales loop approved email copy repair (server-only).
 * Invalidates frozen approval, applies operator edits, re-freezes, and restores package approval
 * without creating duplicate enrollments or execution requests.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  findOutreachPreparationRunByPackageId,
  markOutreachPreparationPackageApprovalDecision,
  updateOutreachPreparationPilotRunApprovalPackage,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  applyOperatorDraftEditsToPackage,
  freezeApprovedOperatorAssetsOnPackage,
  resolveTransportAssetFromPackage,
  GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER,
} from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { freezeOperatorApprovedPackageAssets } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence-service"
import { fetchAvaOutreachExecutionRequestByPackageId } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import { refreshSupervisedTransportSnapshotForJob } from "@/lib/growth/sequences/execution/growth-transport-authority-job-bind-1c"
import {
  GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID,
  GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-1a-types"

export const GE_AIOS_END_TO_END_1A_COPY_REPAIR_CONFIRM_ENV =
  "CONFIRM_GE_AIOS_END_TO_END_1A_COPY_REPAIR" as const

export const GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_REPAIRED_EMAIL = [
  "Subject: Block Imaging service operations",
  "",
  "Hi Josh,",
  "",
  "I noticed Block Imaging supports both depot-based refurbishment and field service for medical imaging equipment. Managing those two workflows together can create a lot of moving parts.",
  "",
  "When workload increases, which tends to create more friction for your team: coordinating dispatch or getting completed work documented and closed out quickly?",
  "",
  "We built Equipify to help equipment-service companies manage customers, assets, field work, service history, and follow-up in one place. I'd be glad to show you how it could fit an operation like Block Imaging.",
  "",
  "Would a brief conversation next week be worthwhile?",
  "",
  "Best,",
  "Ava Sinclair",
  "Equipify",
].join("\n")

export type SupervisedSalesLoopCopyRepairReport = {
  qaMarker: typeof GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER
  repairedAt: string
  organizationId: string
  packageId: string
  leadId: string
  previousApprovalInvalidated: boolean
  operatorReapproved: boolean
  executionRequestId: string | null
  enrollmentId: string | null
  pendingJobId: string | null
  pendingJobAction: "unchanged" | "replaced" | "missing"
  outboundDelivered: boolean
  duplicateEnrollmentCount: number
  duplicatePendingJobCount: number
  renderedEmail: { subject: string | null; body: string | null }
  packageVersionFingerprint: string | null
}

function demoteApprovedAssetsForCopyRepair(
  pkg: GrowthAutonomousOutreachApprovalPackage,
): GrowthAutonomousOutreachApprovalPackage {
  return {
    ...pkg,
    packageApprovalDecision: undefined,
    pendingHumanApproval: true,
    transportBlocked: true,
    generatedAssets: pkg.generatedAssets.map((asset) => {
      if (asset.versionStatus !== "approved") return asset
      const preserved = asset.generatedPreview?.trim() || asset.preview?.trim() || ""
      return {
        ...asset,
        preview: preserved,
        operatorPreview: null,
        approvedPreview: null,
        versionStatus: "generated" as const,
        approvedAt: null,
      }
    }),
  }
}

export async function repairSupervisedSalesLoopApprovedEmailCopy(input: {
  admin: SupabaseClient
  organizationId: string
  packageId: string
  leadId: string
  operatorUserId: string
  emailDraft: string
  now?: string
}): Promise<SupervisedSalesLoopCopyRepairReport> {
  const now = input.now ?? new Date().toISOString()

  const existing = await findOutreachPreparationRunByPackageId(input.admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
  })
  if (!existing?.approvalPackage || existing.approvalPackage.leadId !== input.leadId) {
    throw new Error("outreach_package_not_found")
  }

  const executionRequest = await fetchAvaOutreachExecutionRequestByPackageId(input.admin, {
    leadId: input.leadId,
    packageId: input.packageId,
  })

  const [{ data: outbound }, { data: enrollments }, { data: pendingJobs }] = await Promise.all([
    input.admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, status")
      .eq("lead_id", input.leadId)
      .in("status", ["sent", "delivered"])
      .limit(1),
    input.admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id, status")
      .eq("lead_id", input.leadId)
      .in("status", ["active", "paused"]),
    input.admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, channel")
      .eq("lead_id", input.leadId)
      .eq("status", "pending_approval"),
  ])

  if ((outbound ?? []).length > 0) {
    throw new Error("copy_repair_blocked_prior_delivery")
  }

  const invalidated = demoteApprovedAssetsForCopyRepair(existing.approvalPackage)
  await updateOutreachPreparationPilotRunApprovalPackage(input.admin, {
    organizationId: input.organizationId,
    runId: existing.runId,
    approvalPackage: invalidated,
    confidence: invalidated.confidence,
    now,
  })

  const edited = applyOperatorDraftEditsToPackage({
    pkg: invalidated,
    draftEdits: { email: input.emailDraft },
    operatorUserId: input.operatorUserId,
    editedAt: now,
    companyName: invalidated.companyName ?? "Block Imaging",
  })

  await updateOutreachPreparationPilotRunApprovalPackage(input.admin, {
    organizationId: input.organizationId,
    runId: existing.runId,
    approvalPackage: edited,
    confidence: edited.confidence,
    now,
  })

  const refrozen = await freezeOperatorApprovedPackageAssets(input.admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
    approvedAt: now,
    operatorUserId: input.operatorUserId,
  })

  if (!refrozen) {
    throw new Error("copy_repair_refreeze_failed")
  }

  await markOutreachPreparationPackageApprovalDecision(input.admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
    decision: "approved",
    executionRequestId: executionRequest?.requestId ?? existing.approvalPackage.executionRequestId ?? null,
    now,
  })

  const rendered = resolveTransportAssetFromPackage(
    refrozen,
    "email",
    refrozen.companyName ?? "Block Imaging",
  )

  const pendingJobId =
    executionRequest?.sequenceJobId ?? pendingJobs?.[0]?.id ?? null

  if (pendingJobId) {
    const refresh = await refreshSupervisedTransportSnapshotForJob(input.admin, {
      jobId: pendingJobId,
      organizationId: input.organizationId,
      packageId: input.packageId,
      leadId: input.leadId,
      frozenAt: now,
    })
    if (!refresh.ok) {
      throw new Error(refresh.error)
    }
  }

  const pendingJobAction: SupervisedSalesLoopCopyRepairReport["pendingJobAction"] =
    pendingJobs?.length === 1 && pendingJobId === executionRequest?.sequenceJobId
      ? "unchanged"
      : pendingJobs?.length === 1
        ? "unchanged"
        : pendingJobs?.length === 0
          ? "missing"
          : "replaced"

  logGrowthEngine("ge_aios_end_to_end_1a_copy_repair_completed", {
    qa_marker: GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
    send_plane_qa_marker: GROWTH_AIOS_SEND_PLANE_1B_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    package_id: input.packageId,
    execution_request_id: executionRequest?.requestId ?? null,
    pending_job_id: pendingJobId,
  })

  const emailAsset = refrozen.generatedAssets.find((row) => row.channel === "email")

  return {
    qaMarker: GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
    repairedAt: now,
    organizationId: input.organizationId,
    packageId: input.packageId,
    leadId: input.leadId,
    previousApprovalInvalidated: true,
    operatorReapproved: true,
    executionRequestId: executionRequest?.requestId ?? null,
    enrollmentId: executionRequest?.sequenceEnrollmentId ?? enrollments?.[0]?.id ?? null,
    pendingJobId,
    pendingJobAction,
    outboundDelivered: false,
    duplicateEnrollmentCount: enrollments?.length ?? 0,
    duplicatePendingJobCount: pendingJobs?.length ?? 0,
    renderedEmail: {
      subject: rendered?.subject ?? null,
      body: rendered?.body ?? null,
    },
    packageVersionFingerprint: emailAsset?.approvedAt ?? emailAsset?.approvedPreview?.slice(0, 40) ?? null,
  }
}

export { GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID }
