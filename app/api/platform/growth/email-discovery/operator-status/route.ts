import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadEmailDiscoveryOperatorStatus } from "@/lib/growth/email-discovery/email-discovery-operator-status"
import { GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/email-discovery/email-discovery-runtime-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const company_id = url.searchParams.get("company_id")?.trim() ?? ""
  const person_id = url.searchParams.get("person_id")?.trim() ?? ""

  if (!company_id || !person_id) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "company_id and person_id are required." },
      { status: 400 },
    )
  }

  const status = await loadEmailDiscoveryOperatorStatus(access.admin, { company_id, person_id })
  if (!status) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "No person_company_roles link for this pair." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER,
    status,
  })
}
