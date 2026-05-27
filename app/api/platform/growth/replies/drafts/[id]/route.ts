import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  enrichReplyDraftViews,
  getReplyDraft,
  listReplyDraftEvents,
  updateReplyDraft,
} from "@/lib/growth/replies/reply-draft-repository"
import { isGrowthAiReplyDraftingSchemaReady } from "@/lib/growth/replies/reply-draft-schema-health"

export const runtime = "nodejs"

const PatchSchema = z.object({
  draftSubject: z.string().trim().max(500).optional(),
  draftBody: z.string().trim().max(20000).optional(),
  tone: z.string().trim().max(80).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const draft = await getReplyDraft(access.admin, id)
    if (!draft) {
      return NextResponse.json({ error: "draft_not_found", message: "Reply draft not found." }, { status: 404 })
    }
    const [views, events] = await Promise.all([
      enrichReplyDraftViews(access.admin, [draft]),
      listReplyDraftEvents(access.admin, id),
    ])
    return NextResponse.json({ ok: true, draft: views[0] ?? draft, events })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load reply draft." }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid draft update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const draft = await updateReplyDraft(access.admin, id, parsed.data)
    const views = await enrichReplyDraftViews(access.admin, [draft])
    return NextResponse.json({ ok: true, draft: views[0] ?? draft })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update reply draft."
    const status = message === "draft_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "update_failed", message }, { status })
  }
}
