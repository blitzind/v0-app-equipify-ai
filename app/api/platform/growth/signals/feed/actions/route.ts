import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applySignalFeedAction } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import { validateSignalFeedActionBody } from "@/lib/growth/signal-intelligence/signal-feed-route-gates"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const parsed = validateSignalFeedActionBody(body)
  if (!parsed.ok || !parsed.audit_event_id || !parsed.action) {
    return NextResponse.json(
      { ok: false, error: "invalid_action", message: parsed.error },
      { status: 400 },
    )
  }

  const result = await applySignalFeedAction(access.admin, {
    audit_event_id: parsed.audit_event_id,
    action: parsed.action,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "update_failed" },
      { status: result.error === "not_found" ? 404 : 422 },
    )
  }

  return NextResponse.json({
    ok: true,
    audit_event_id: parsed.audit_event_id,
    status: result.status,
    outreach_execution: false,
    requires_human_approval: true,
  })
}
