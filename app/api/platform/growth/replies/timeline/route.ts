import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchLeadConversationTimeline } from "@/lib/growth/reply-intelligence/conversation-timeline"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = z.string().uuid().parse(new URL(request.url).searchParams.get("leadId"))
  const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(new URL(request.url).searchParams.get("limit") ?? "50")

  try {
    const timeline = await fetchLeadConversationTimeline(access.admin, { leadId, limit })
    return NextResponse.json({ ok: true, timeline })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load conversation timeline." }, { status: 500 })
  }
}
