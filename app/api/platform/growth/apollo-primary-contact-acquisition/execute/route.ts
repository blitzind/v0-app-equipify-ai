import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { executeApolloPrimaryContactAcquisitionInProduction } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-production-route"
import { validateApolloPrimaryContactAcquisitionConfirmation } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = await request.json().catch(() => null)
  const confirmation = validateApolloPrimaryContactAcquisitionConfirmation(body)
  if (!confirmation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "confirmation_required",
        message: confirmation.error,
      },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const result = await executeApolloPrimaryContactAcquisitionInProduction(access.admin, {
    company_candidate_id: confirmation.company_candidate_id,
    contact_limit: confirmation.contact_limit,
    created_by: access.userId,
  })

  logGrowthEngine("apollo_primary_contact_acquisition_execute", {
    execution_id: result.execution_id,
    company_candidate_id: result.company_candidate_id?.slice(0, 8) ?? null,
    ok: result.ok,
    error: result.ok ? null : result.error ?? null,
    message: result.ok ? null : result.message ?? null,
    duration_ms: Date.now() - startedMs,
    companies_searched: result.evidence?.companies_searched ?? 0,
    apollo_people_found: result.evidence?.apollo_people_found ?? 0,
    existing_contacts_reused: result.evidence?.existing_contacts_reused ?? 0,
    credits_consumed: result.evidence?.credits_consumed ?? 0,
    promoted_contacts: result.evidence?.promoted_contacts ?? 0,
    contactable_contacts: result.evidence?.contactable_contacts ?? 0,
    sequence_ready_contacts: result.evidence?.sequence_ready_contacts ?? 0,
    auto_enrollment: false,
    outreach_sent: false,
  })

  if (!result.ok && result.error === "gates_failed") {
    return NextResponse.json(result, { status: 403 })
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
