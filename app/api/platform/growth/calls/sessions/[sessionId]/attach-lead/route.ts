import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { attachCallWorkspaceLead } from "@/lib/growth/native-dialer/call-workspace-coaching-service"
import { GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER } from "@/lib/growth/native-dialer/call-workspace-coaching-types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  leadId: z.string().uuid(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { sessionId } = await context.params
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid session id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Provide leadId." }, { status: 400 })
  }

  try {
    const session = await attachCallWorkspaceLead(access.admin, {
      nativeSessionId: sessionId,
      leadId: parsed.data.leadId,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_GOOGLE_VOICE_BRIDGE_COACHING_QA_MARKER,
      session,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not attach lead."
    return NextResponse.json({ error: "attach_failed", message }, { status: 500 })
  }
}
