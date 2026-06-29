import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchDailyRevenueWorkQueue,
  fetchDailyRevenueWorkQueueLeadStatus,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")?.trim()
  if (leadId) {
    const leadStatus = await fetchDailyRevenueWorkQueueLeadStatus(access.admin, leadId)
    return growthHomeNoStoreJson({
      ok: true,
      enabled: leadStatus.enabled,
      lead_status: leadStatus.lead_status,
    })
  }

  const result = await fetchDailyRevenueWorkQueue(access.admin, { limit: 100 })

  return growthHomeNoStoreJson({
    ok: true,
    enabled: result.enabled,
    queue: result.queue,
    display: result.display,
  })
}
