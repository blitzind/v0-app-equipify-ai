import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildOpportunityDraftFromReply } from "@/lib/growth/reply-intelligence/execute-reply-workflow-actions"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId")
  const replyId = url.searchParams.get("replyId")
  if (!leadId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id" }, { status: 400 })
  }

  try {
    const draft = await buildOpportunityDraftFromReply(access.admin, {
      leadId,
      replyId: replyId && z.string().uuid().safeParse(replyId).success ? replyId : undefined,
    })
    return NextResponse.json({ ok: true, draft })
  } catch (e) {
    const code = e instanceof Error ? e.message : "draft_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
