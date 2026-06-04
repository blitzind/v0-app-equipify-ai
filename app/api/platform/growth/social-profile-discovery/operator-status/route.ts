import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadSocialProfileDiscoveryOperatorStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-operator-status"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const company_id = url.searchParams.get("company_id")?.trim() ?? ""
  const person_id = url.searchParams.get("person_id")?.trim() || null
  const scopeParam = url.searchParams.get("discovery_scope")?.trim()
  const discovery_scope =
    scopeParam === "person" || scopeParam === "company" ? scopeParam : person_id ? "person" : "company"

  if (!company_id) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "company_id is required." },
      { status: 400 },
    )
  }

  if (discovery_scope === "person" && !person_id) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "person_id is required for person scope." },
      { status: 400 },
    )
  }

  const status = await loadSocialProfileDiscoveryOperatorStatus(access.admin, {
    company_id,
    person_id,
    discovery_scope,
  })
  if (!status) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
        message:
          discovery_scope === "person"
            ? "No person_company_roles link for this pair."
            : "Canonical company not found.",
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
    runtime_qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER,
    status,
  })
}
