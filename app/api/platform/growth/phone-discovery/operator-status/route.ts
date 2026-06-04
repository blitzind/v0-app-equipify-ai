import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadPhoneDiscoveryOperatorStatus } from "@/lib/growth/phone-discovery/phone-discovery-operator-status"
import { GROWTH_PHONE_DISCOVERY_QA_MARKER } from "@/lib/growth/phone-discovery/phone-discovery-types"

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

  const status = await loadPhoneDiscoveryOperatorStatus(access.admin, { company_id, person_id })
  if (!status) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "No person_company_roles link for this pair." },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, qa_marker: GROWTH_PHONE_DISCOVERY_QA_MARKER, status })
}
