/**
 * GE-AIOS-APPROVALS-2A — Read-only operator review packet for a Growth 5F package.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_AIOS_APPROVALS_2A_QA_MARKER } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { loadApprovals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-service"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { findAutonomousOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { buildCustomerPackageReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import { fetchAvaOutreachExecutionRequestByPackageId } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import { evaluateAvaOutreachExecutionReadinessForPackage } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-service-1f"
import { GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-1f"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ packageId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER, error: "organization_required" },
      { status: 400 },
    )
  }

  const { packageId: rawPackageId } = await context.params
  const packageId = decodeURIComponent(rawPackageId ?? "")
  const leadId = new URL(request.url).searchParams.get("leadId")?.trim() ?? ""
  if (!packageId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
        error: "package_id_and_lead_id_required",
      },
      { status: 400 },
    )
  }

  try {
    const supervisedGeneration = await fetchGrowthAiCopilotGenerationById(access.admin, packageId)
    if (supervisedGeneration && isAvaSupervisedOutboundGeneration(supervisedGeneration)) {
      if (supervisedGeneration.leadId !== leadId) {
        return NextResponse.json(
          {
            ok: false,
            qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
            error: "approval_package_source_mismatch",
            message: "This supervised recommendation must open from the account review drawer.",
            reviewHref: buildCustomerPackageReviewHref(supervisedGeneration.leadId),
            generationId: supervisedGeneration.id,
            leadId: supervisedGeneration.leadId,
          },
          { status: 409 },
        )
      }
      return NextResponse.json(
        {
          ok: false,
          qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
          error: "approval_package_source_mismatch",
          message: "This supervised recommendation opens in the AI Copilot review drawer.",
          reviewHref: buildCustomerPackageReviewHref(supervisedGeneration.leadId),
          generationId: supervisedGeneration.id,
          leadId: supervisedGeneration.leadId,
        },
        { status: 409 },
      )
    }

    const run = await findAutonomousOutreachPreparationRunByPackageId(
      access.admin,
      organizationId,
      packageId,
    )
    const approvalPackage = run?.approvalPackage
    if (!approvalPackage || approvalPackage.leadId !== leadId) {
      return NextResponse.json(
        {
          ok: false,
          qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
          error: "approval_generation_not_found",
          message: "This review package could not be loaded.",
        },
        { status: 404 },
      )
    }

    const packet = await loadApprovals2AOperatorReviewPacket(access.admin, {
      organizationId,
      packageId,
      leadId,
    })
    if (!packet) {
      return NextResponse.json(
        { ok: false, qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER, error: "package_not_found" },
        { status: 404 },
      )
    }

    const executionReadiness = await evaluateAvaOutreachExecutionReadinessForPackage(access.admin, {
      leadId,
      recommendedSequence: approvalPackage.recommendedSequence,
      recommendedChannel: approvalPackage.recommendedChannel,
    })
    const executionRequest = await fetchAvaOutreachExecutionRequestByPackageId(access.admin, {
      leadId,
      packageId,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER,
      handoffQaMarker: GE_AIOS_SUPERVISED_SEQUENCE_HANDOFF_1F_QA_MARKER,
      packet,
      executionReadiness,
      executionRequest,
      transportBlocked: true,
      pendingHumanApproval: approvalPackage.pendingHumanApproval ?? true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_APPROVALS_2A_QA_MARKER, error: message },
      { status: 500 },
    )
  }
}
