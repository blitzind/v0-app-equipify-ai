import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enrichReplyDraftViews, listReplyDrafts } from "@/lib/growth/replies/reply-draft-repository"
import { isGrowthAiReplyDraftingSchemaReady } from "@/lib/growth/replies/reply-draft-schema-health"
import { GROWTH_REPLY_DRAFT_STATUSES } from "@/lib/growth/replies/reply-draft-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiReplyDraftingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply reply drafting migration." }, { status: 503 })
  }

  const url = new URL(request.url)
  const threadId = url.searchParams.get("threadId")
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && GROWTH_REPLY_DRAFT_STATUSES.includes(statusParam as (typeof GROWTH_REPLY_DRAFT_STATUSES)[number])
      ? (statusParam as (typeof GROWTH_REPLY_DRAFT_STATUSES)[number])
      : undefined
  const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(url.searchParams.get("limit") ?? "50")

  try {
    const drafts = await listReplyDrafts(access.admin, {
      threadId: threadId && z.string().uuid().safeParse(threadId).success ? threadId : undefined,
      status,
      limit,
    })
    const views = await enrichReplyDraftViews(access.admin, drafts)
    return NextResponse.json({ ok: true, drafts: views })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load reply drafts." }, { status: 500 })
  }
}
