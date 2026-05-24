import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOutreachApprovalDashboard } from "@/lib/growth/outreach/outreach-approval-dashboard-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const owner = url.searchParams.get("owner") ?? undefined
  const sourceVendor = url.searchParams.get("sourceVendor") ?? undefined
  const priorityTier = url.searchParams.get("priority") ?? undefined
  const channel = url.searchParams.get("channel") ?? undefined

  const dashboard = await fetchGrowthOutreachApprovalDashboard(access.admin)

  const filterItem = <T extends { executiveOwner?: string | null; sourceVendor?: string | null; callPriorityTier?: string | null; channel?: string }>(
    items: T[],
  ) =>
    items.filter((item) => {
      if (owner && item.executiveOwner !== owner) return false
      if (sourceVendor && item.sourceVendor !== sourceVendor) return false
      if (priorityTier && item.callPriorityTier !== priorityTier) return false
      if (channel && item.channel !== channel) return false
      return true
    })

  return NextResponse.json({
    ok: true,
    ...dashboard,
    sections: {
      ...dashboard.sections,
      pendingApproval: filterItem(dashboard.sections.pendingApproval),
      scheduled: filterItem(dashboard.sections.scheduled),
      failed: filterItem(dashboard.sections.failed),
      executedRecently: filterItem(dashboard.sections.executedRecently),
    },
  })
}
