import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resolveCanonicalCompanyIdForLead } from "@/lib/growth/canonical-persons/canonical-person-repository"
import { loadEmailDiscoveryOperatorStatus } from "@/lib/growth/email-discovery/email-discovery-operator-status"
import { GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/email-discovery/email-discovery-runtime-types"

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

  const { data: dms } = await adminDecisionMakers(access, lead_id)
  const pairs: Array<{ person_id: string; company_id: string; decision_maker_id: string }> = []

  for (const dm of dms) {
    const person_id = typeof dm.canonical_person_id === "string" ? dm.canonical_person_id.trim() : ""
    const cid = company_id ?? ""
    if (person_id && cid) {
      pairs.push({
        person_id,
        company_id: cid,
        decision_maker_id: dm.id as string,
      })
    }
  }

  const statuses = []
  for (const pair of pairs) {
    const status = await loadEmailDiscoveryOperatorStatus(access.admin, {
      company_id: pair.company_id,
      person_id: pair.person_id,
    })
    if (status) {
      statuses.push({
        decision_maker_id: pair.decision_maker_id,
        ...status,
      })
    }
  }

  const primary = statuses.find((s) => s.has_verified_email) ?? statuses[0] ?? null

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER,
    lead_id,
    company_id,
    primary_status: primary,
    decision_makers: statuses,
  })
}

async function adminDecisionMakers(
  access: Awaited<ReturnType<typeof requireGrowthEnginePlatformAccess>>,
  lead_id: string,
) {
  if (!access.ok) return []
  const { data } = await access.admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, canonical_person_id, full_name, email")
    .eq("lead_id", lead_id)
    .neq("status", "rejected")
  return data ?? []
}
