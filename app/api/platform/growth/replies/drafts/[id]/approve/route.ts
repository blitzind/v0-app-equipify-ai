import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { approveReplyDraft, enrichReplyDraftViews } from "@/lib/growth/replies/reply-draft-repository"
import { isGrowthAiReplyDraftingSchemaReady } from "@/lib/growth/replies/reply-draft-schema-health"
import { GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE } from "@/lib/growth/replies/reply-draft-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const draft = await approveReplyDraft(access.admin, { draftId: id, approvedBy: access.userId })
    const views = await enrichReplyDraftViews(access.admin, [draft])
    return NextResponse.json({
      ok: true,
      draft: views[0] ?? draft,
      privacy_note: GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve reply draft."
    const status =
      message === "draft_not_found" ? 404 : message === "draft_blocked" || message === "already_sent" ? 400 : 500
    return NextResponse.json({ error: "approve_failed", message }, { status })
  }
}
