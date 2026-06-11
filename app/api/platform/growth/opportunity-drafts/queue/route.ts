import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadOpportunityDraftQueue } from "@/lib/growth/meeting-intelligence/opportunity-draft-queue"
import type { OpportunityDraftStatus } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

export const runtime = "nodejs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const meetingId = asString(url.searchParams.get("meetingId") || url.searchParams.get("meeting_id")) || null
  const leadId = asString(url.searchParams.get("leadId") || url.searchParams.get("lead_id")) || null
  const statusParam = asString(url.searchParams.get("status")) || "draft"
  const status = (statusParam === "all" ? "all" : statusParam) as OpportunityDraftStatus | "all"
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "100", 10)
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100

  const snapshot = await loadOpportunityDraftQueue(access.admin, {
    meeting_id: meetingId,
    lead_id: leadId,
    status,
    limit,
  })

  return NextResponse.json(snapshot)
}
