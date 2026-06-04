import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadSocialProfileDiscoveryOperatorStatus } from "@/lib/growth/social-profile-discovery/social-profile-discovery-operator-status"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const lead_id = leadId?.trim()
  if (!lead_id) {
    return NextResponse.json({ ok: false, message: "leadId is required." }, { status: 400 })
  }

  const company_id = await resolveCanonicalCompanyIdForLead(access.admin, lead_id)

  const { data: dms } = await access.admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, canonical_person_id, full_name, linkedin_url")
    .eq("lead_id", lead_id)
    .neq("status", "rejected")

  const statuses = []
  for (const dm of dms ?? []) {
    const person_id = typeof dm.canonical_person_id === "string" ? dm.canonical_person_id.trim() : ""
    const cid = company_id ?? ""
    if (!person_id || !cid) continue
    const status = await loadSocialProfileDiscoveryOperatorStatus(access.admin, {
      company_id: cid,
      person_id,
      discovery_scope: "person",
    })
    if (status) {
      statuses.push({
        decision_maker_id: dm.id as string,
        ...status,
      })
    }
  }

  const primary = statuses.find((s) => s.has_verified_profile) ?? statuses[0] ?? null

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER,
    lead_id,
    company_id,
    primary_status: primary,
    decision_makers: statuses,
  })
}
