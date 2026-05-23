import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const offsetParam = url.searchParams.get("offset")
  const limit = limitParam ? z.coerce.number().int().min(1).max(100).safeParse(limitParam) : { success: true, data: 50 }
  const offset = offsetParam ? z.coerce.number().int().min(0).safeParse(offsetParam) : { success: true, data: 0 }

  if (!limit.success || !offset.success) {
    return NextResponse.json({ error: "invalid_pagination", message: "Invalid limit or offset." }, { status: 400 })
  }

  try {
    const events = await listGrowthLeadTimelineEvents(access.admin, {
      leadId,
      limit: limit.data,
      offset: offset.data,
    })
    return NextResponse.json({ ok: true, events })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "query_failed", message }, { status: 500 })
  }
}
