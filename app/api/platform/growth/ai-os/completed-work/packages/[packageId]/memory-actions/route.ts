/**
 * GE-AIOS-MEMORY-RESOLVER-1B — Operator memory review actions for Human Approval Center.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import { applyOperatorMemoryReviewDecision } from "@/lib/growth/lead-memory/operator-memory-review-service"
import { findAutonomousOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const actionSchema = z.enum(["approve", "correct", "delete", "pin", "protect", "merge"])

type RouteContext = { params: Promise<{ packageId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, qaMarker: GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER, result: "forbidden" },
      { status: 400 },
    )
  }

  const { packageId: rawPackageId } = await context.params
  const packageId = decodeURIComponent(rawPackageId ?? "")

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    leadId?: string
    eventId?: string
    correctedConclusion?: string | null
    mergeTargetEventId?: string | null
    idempotencyKey?: string | null
  }

  const action = actionSchema.safeParse(body.action?.trim())
  const leadId = body.leadId?.trim() ?? ""
  const eventId = body.eventId?.trim() ?? ""

  if (!action.success || !packageId || !z.string().uuid().safeParse(leadId).success || !z.string().uuid().safeParse(eventId).success) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER,
        result: "forbidden",
        message: "packageId, leadId, eventId, and a valid action are required.",
      },
      { status: 400 },
    )
  }

  const run = await findAutonomousOutreachPreparationRunByPackageId(access.admin, organizationId, packageId)
  const pkg = run?.approvalPackage
  if (!pkg || pkg.leadId !== leadId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER,
        result: "forbidden",
        message: "Package does not belong to the supplied lead.",
      },
      { status: 403 },
    )
  }

  try {
    const outcome = await applyOperatorMemoryReviewDecision(access.admin, {
      organizationId,
      leadId,
      eventId,
      action: action.data,
      operatorUserId: access.userId ?? null,
      correctedConclusion: body.correctedConclusion ?? null,
      mergeTargetEventId: body.mergeTargetEventId ?? null,
      packageId,
      idempotencyKey: body.idempotencyKey ?? null,
    })

    const status =
      outcome.result === "not_found"
        ? 404
        : outcome.result === "forbidden"
          ? 403
          : outcome.result === "invalid_merge" || outcome.result === "invalid_correction"
            ? 400
            : 200

    return NextResponse.json({
      ok: outcome.ok,
      qaMarker: GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER,
      result: outcome.result,
      eventId: outcome.eventId,
      mergeTargetEventId: outcome.mergeTargetEventId ?? null,
      memoryReview: outcome.memoryReview,
      profileRebuilt: outcome.profileRebuilt,
      transportBlocked: true,
    }, { status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER,
        result: "forbidden",
        message,
      },
      { status: 500 },
    )
  }
}
