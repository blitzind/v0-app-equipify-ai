import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOutreachApprovalDashboard } from "@/lib/growth/outreach/outreach-approval-dashboard-repository"
import { describeGrowthNativeOutboundCutoverStatus } from "@/lib/growth/runtime/outbound-cutover"
import {
  GROWTH_ADAPTER_LEGACY_QUEUE_ARCHIVE_HREF,
  GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF,
  GROWTH_LEMLIST_DECOMMISSION_QA_MARKER,
  GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE,
} from "@/lib/growth/runtime/adapter-outbound-decommission-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const owner = url.searchParams.get("owner") ?? undefined
  const sourceVendor = url.searchParams.get("sourceVendor") ?? undefined
  const priorityTier = url.searchParams.get("priority") ?? undefined
  const channel = url.searchParams.get("channel") ?? undefined

  const [dashboard, cutover] = await Promise.all([
    fetchGrowthOutreachApprovalDashboard(access.admin),
    Promise.resolve(describeGrowthNativeOutboundCutoverStatus()),
  ])

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
    decommission: {
      qa_marker: GROWTH_LEMLIST_DECOMMISSION_QA_MARKER,
      operator_note: GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE,
      adapter_execution_enabled: cutover.adapter_execution_enabled,
      read_only: !cutover.adapter_execution_enabled,
      sequence_execution_href: GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF,
      legacy_queue_archive_href: GROWTH_ADAPTER_LEGACY_QUEUE_ARCHIVE_HREF,
    },
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
