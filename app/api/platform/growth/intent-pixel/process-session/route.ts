import { NextResponse } from "next/server"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { processIntentSessionToLeadInbox } from "@/lib/growth/intent-pixel/process-intent-session-handoff"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const site_key =
    typeof body.site_key === "string" && body.site_key.trim()
      ? body.site_key.trim()
      : "equipify-sandbox"
  const session_id = typeof body.session_id === "string" ? body.session_id.trim() : ""

  if (!session_id) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "session_id is required." },
      { status: 400 },
    )
  }

  const result = await processIntentSessionToLeadInbox(access.admin, site_key, session_id)

  logGrowthEngine("intent_pixel_process_session", {
    site_key,
    session_id,
    ok: result.ok,
    growth_lead_id: result.growth_lead_id,
    userId: access.userId,
  })

  return NextResponse.json({ ok: result.ok, result })
}
