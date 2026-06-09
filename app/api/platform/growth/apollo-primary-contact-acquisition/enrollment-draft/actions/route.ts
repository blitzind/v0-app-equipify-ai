import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { createApolloPrimaryContactEnrollmentDraft } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-bridge"

export const runtime = "nodejs"

type EnrollmentDraftActionBody = {
  action?: string
  queueItemId?: string | null
  patternId?: string | null
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as EnrollmentDraftActionBody
  const action = body.action?.trim()
  const startedMs = Date.now()

  if (action === "create_enrollment_draft") {
    const queueItemId = body.queueItemId?.trim()
    if (!queueItemId) {
      return NextResponse.json(
        { ok: false, error: "queue_item_id_required", message: "queueItemId is required." },
        { status: 400 },
      )
    }

    const result = await createApolloPrimaryContactEnrollmentDraft(access.admin, {
      queue_item_id: queueItemId,
      acting_user_id: access.userId ?? null,
      acting_user_email: access.userEmail ?? null,
      pattern_id: body.patternId ?? null,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_draft_action", {
      queue_item_id: queueItemId.slice(0, 8),
      lead_id: result.growth_lead_id?.slice(0, 8) ?? null,
      enrollment_id: result.enrollment_draft_id?.slice(0, 8) ?? null,
      lookup_key: result.staging_evidence?.lookup_key?.slice(0, 8) ?? null,
      staging_table_detected: result.staging_evidence?.staging_table_detected ?? null,
      staging_row_id: result.staging_evidence?.staging_row_id?.slice(0, 8) ?? null,
      candidate_domain_normalized: result.staging_evidence?.candidate_domain_normalized ?? null,
      canonical_company_id: result.staging_evidence?.canonical_company_id?.slice(0, 8) ?? null,
      lead_resolution_step: result.lead_resolution_evidence?.lead_resolution_step ?? null,
      confidence_score: result.lead_resolution_evidence?.confidence_score ?? null,
      confidence_reason: result.lead_resolution_evidence?.confidence_reason ?? null,
      identity_source: result.lead_resolution_evidence?.identity_source ?? null,
      company_contact_id: result.lead_resolution_evidence?.company_contact_id?.slice(0, 8) ?? null,
      canonical_person_id: result.lead_resolution_evidence?.canonical_person_id?.slice(0, 8) ?? null,
      contact_candidate_id: result.lead_resolution_evidence?.contact_candidate_id?.slice(0, 8) ?? null,
      email_present: result.lead_resolution_evidence?.email_present ?? null,
      linkedin_present: result.lead_resolution_evidence?.linkedin_present ?? null,
      explicit_pattern_id: result.lead_resolution_evidence?.explicit_pattern_id?.slice(0, 8) ?? null,
      ok: result.ok,
      error: result.error ?? null,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  }

  return NextResponse.json(
    {
      ok: false,
      error: "invalid_action",
      message: 'action must be "create_enrollment_draft".',
    },
    { status: 400 },
  )
}
