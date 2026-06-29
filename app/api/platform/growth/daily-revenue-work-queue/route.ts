import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchDailyRevenueWorkQueue,
  fetchDailyRevenueWorkQueueLeadStatus,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")?.trim()
  if (leadId) {
    const leadStatus = await fetchDailyRevenueWorkQueueLeadStatus(access.admin, leadId)
    return NextResponse.json({
      ok: true,
      enabled: leadStatus.enabled,
      lead_status: leadStatus.lead_status,
    })
  }

  const result = await fetchDailyRevenueWorkQueue(access.admin, { limit: 100 })

  return NextResponse.json({
    ok: true,
    enabled: result.enabled,
    queue: result.queue,
    display: result.display,
  })
}
