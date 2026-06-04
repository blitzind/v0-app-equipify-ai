import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { describeGrowthNativeOutboundCutoverStatus } from "@/lib/growth/runtime/outbound-cutover"
import { GROWTH_LEMLIST_DECOMMISSION_QA_MARKER } from "@/lib/growth/runtime/adapter-outbound-decommission-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const cutover = describeGrowthNativeOutboundCutoverStatus()
  return NextResponse.json({
    ok: true,
    decommission_qa_marker: GROWTH_LEMLIST_DECOMMISSION_QA_MARKER,
    cutover,
    lemlist_operator_surface: cutover.adapter_execution_enabled ? "rollback_active" : "archived_read_only",
    sequence_execution_href: "/admin/growth/sequences/execution",
    legacy_queue_archive_href: "/admin/growth/outreach/legacy-queue",
  })
}
