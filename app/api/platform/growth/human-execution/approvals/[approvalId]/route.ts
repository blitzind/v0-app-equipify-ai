import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getGrowthHumanExecutionApproval,
  transitionGrowthHumanExecutionApproval,
} from "@/lib/growth/human-execution/human-execution-service"
import {
  GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER,
  HUMAN_EXECUTION_APPROVAL_STATUSES,
} from "@/lib/growth/human-execution/human-execution-types"
import {
  GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE,
  isGrowthHumanExecutionSchemaReady,
} from "@/lib/growth/human-execution/human-execution-schema-health"

export const runtime = "nodejs"

const patchSchema = z.object({
  toStatus: z.enum(HUMAN_EXECUTION_APPROVAL_STATUSES),
})

export async function GET(_request: Request, context: { params: Promise<{ approvalId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { approvalId } = await context.params
  if (!z.string().uuid().safeParse(approvalId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid approval id." }, { status: 400 })
  }

  if (!(await isGrowthHumanExecutionSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  try {
    const approval = await getGrowthHumanExecutionApproval(access.admin, approvalId)
    if (!approval) return NextResponse.json({ error: "not_found", message: "Approval not found." }, { status: 404 })
    return NextResponse.json({ ok: true, qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, approval })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load approval."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ approvalId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { approvalId } = await context.params
  if (!z.string().uuid().safeParse(approvalId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid approval id." }, { status: 400 })
  }

  if (!(await isGrowthHumanExecutionSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_HUMAN_EXECUTION_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid approval transition." }, { status: 400 })
  }

  try {
    const approval = await transitionGrowthHumanExecutionApproval(access.admin, {
      approvalId,
      toStatus: parsed.data.toStatus,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, qaMarker: GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER, approval })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update approval."
    if (message === "not_found") {
      return NextResponse.json({ error: "not_found", message: "Approval not found." }, { status: 404 })
    }
    if (message.startsWith("Invalid approval transition")) {
      return NextResponse.json({ error: "invalid_status", message }, { status: 409 })
    }
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
