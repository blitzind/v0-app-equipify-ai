import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enrichReplyDraftViews, sendApprovedReplyDraft } from "@/lib/growth/replies/reply-draft-repository"
import { isGrowthAiReplyDraftingSchemaReady } from "@/lib/growth/replies/reply-draft-schema-health"
import { GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE } from "@/lib/growth/replies/reply-draft-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  humanApproved: z.boolean().optional(),
  humanApprovalConfirmed: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid send payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const result = await sendApprovedReplyDraft(access.admin, {
      draftId: id,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      humanApproved: parsed.data.humanApproved ?? true,
      humanApprovalConfirmed: parsed.data.humanApprovalConfirmed ?? true,
    })
    const views = await enrichReplyDraftViews(access.admin, [result.draft])
    return NextResponse.json({
      ok: true,
      draft: views[0] ?? result.draft,
      deliveryAttemptId: result.deliveryAttemptId,
      privacy_note: GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send reply draft."
    const status =
      message === "draft_not_found"
        ? 404
        : message === "draft_not_approved" ||
            message === "human_approval_confirmed_required" ||
            message.startsWith("suppression_") ||
            message.includes("suppression")
          ? 400
          : 500
    return NextResponse.json({ error: "send_failed", message }, { status })
  }
}
