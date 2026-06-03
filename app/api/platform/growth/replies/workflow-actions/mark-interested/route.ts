import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { markLeadInterestedFromReply } from "@/lib/growth/reply-intelligence/execute-reply-workflow-actions"

export const runtime = "nodejs"

const BodySchema = z.object({
  leadId: z.string().uuid(),
  replyId: z.string().uuid().optional(),
  workflowActionId: z.string().uuid().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  try {
    const result = await markLeadInterestedFromReply(access.admin, {
      ...parsed.data,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const code = e instanceof Error ? e.message : "mark_interested_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
