import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { dismissReplyWorkflowAction } from "@/lib/growth/reply-intelligence/execute-reply-workflow-actions"

export const runtime = "nodejs"

const BodySchema = z.object({
  workflowActionId: z.string().uuid(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 })

  try {
    await dismissReplyWorkflowAction(access.admin, {
      workflowActionId: parsed.data.workflowActionId,
      actor: { userId: access.userId, email: access.userEmail },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = e instanceof Error ? e.message : "dismiss_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
