import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadPhoneDiscoveryRunDetail } from "@/lib/growth/phone-discovery/phone-discovery-repository"
import { GROWTH_PHONE_DISCOVERY_QA_MARKER } from "@/lib/growth/phone-discovery/phone-discovery-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ runId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const run_id = runId?.trim()
  if (!run_id) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "runId is required." },
      { status: 400 },
    )
  }

  const detail = await loadPhoneDiscoveryRunDetail(access.admin, run_id)
  if (!detail) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Phone discovery run not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, qa_marker: GROWTH_PHONE_DISCOVERY_QA_MARKER, detail })
}
