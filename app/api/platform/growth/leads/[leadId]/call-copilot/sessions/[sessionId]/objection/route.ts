import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runGrowthCallCopilotObjection } from "@/lib/growth/run-call-copilot-objection"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  objectionText: z.string().trim().min(1).max(2000),
  frameworkKey: z.string().trim().max(80).nullable().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid objection payload." }, { status: 400 })
  }

  const result = await runGrowthCallCopilotObjection(access.admin, {
    leadId,
    sessionId,
    objectionText: parsed.data.objectionText,
    frameworkKey: parsed.data.frameworkKey,
    actingUserId: access.userId,
    actingUserEmail: access.userEmail,
  })

  if (!result.ok) {
    const status =
      result.code === "not_found" ? 404 : result.code === "invalid_status" ? 409 : 400
    return NextResponse.json({ error: result.code, message: result.message }, { status })
  }

  return NextResponse.json({ ok: true, session: result.session })
}
