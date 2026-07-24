import { NextResponse } from "next/server"
import { requireGrowthAccess } from "@/lib/growth/rbac/growth-access-resolution"
import { sendApprovedAvaSupervisedGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-send-service"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ generationId: string }> },
) {
  const access = await requireGrowthAccess(request, { minimumRole: "growth_operator" })
  if (!access.ok) return access.response

  const { generationId } = await context.params
  if (!UUID_RE.test(generationId)) {
    return NextResponse.json({ error: "invalid_generation", message: "Invalid generation id." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    humanApproved?: boolean
    humanApprovalConfirmed?: boolean
  }

  try {
    const result = await sendApprovedAvaSupervisedGeneration(access.admin, {
      generationId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      actorOrganizationId: access.organizationId,
      isPlatformAdmin: access.isPlatformAdmin,
      humanApproved: body.humanApproved ?? true,
      humanApprovalConfirmed: body.humanApprovalConfirmed ?? true,
    })

    if (!result.ok) {
      const status =
        result.code === "not_found" || result.code === "lead_not_found"
          ? 404
          : result.code === "tenant_isolation_violation"
            ? 403
          : result.code === "generation_not_approved" ||
              result.code === "approval_binding_missing" ||
              result.code === "explicit_send_required" ||
              result.code === "send_in_progress" ||
              result.code === "already_sent" ||
              result.code === "delivery_unknown_requires_reconciliation"
            ? 409
            : 422
      return NextResponse.json(
        {
          ok: false,
          error: result.code,
          message: result.message,
          generation: result.generation ?? null,
        },
        { status },
      )
    }

    return NextResponse.json({
      ok: true,
      generation: result.generation,
      receipt: result.receipt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "send_failed", message }, { status: 500 })
  }
}
