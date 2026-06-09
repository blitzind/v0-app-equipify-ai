import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  bulkHandoffApprovedApolloContactsToEnrollmentQueue,
  handoffApprovedApolloContactToEnrollmentQueue,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge"
import {
  approveApolloPrimaryContactForOutreach,
  bulkApproveSequenceReadyApolloContacts,
  rejectApolloPrimaryContact,
} from "@/lib/growth/apollo/apollo-primary-contact-operator-review"

export const runtime = "nodejs"

type OperatorReviewActionBody = {
  action?: string
  companyCandidateId?: string
  companyContactId?: string | null
  contactCandidateId?: string | null
  note?: string | null
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as OperatorReviewActionBody
  const action = body.action?.trim()
  const companyCandidateId = body.companyCandidateId?.trim()

  if (!companyCandidateId) {
    return NextResponse.json(
      { ok: false, error: "company_candidate_id_required", message: "companyCandidateId is required." },
      { status: 400 },
    )
  }

  const startedMs = Date.now()
  const reviewer = {
    reviewer_user_id: access.userId ?? null,
    reviewer_email: access.userEmail ?? null,
  }

  if (action === "approve") {
    const result = await approveApolloPrimaryContactForOutreach(access.admin, {
      company_candidate_id: companyCandidateId,
      company_contact_id: body.companyContactId ?? null,
      contact_candidate_id: body.contactCandidateId ?? null,
      note: body.note,
      ...reviewer,
    })

    logGrowthEngine("apollo_primary_contact_operator_review_approve", {
      company_candidate_id: companyCandidateId.slice(0, 8),
      contact_id: result.contact_id?.slice(0, 8) ?? null,
      ok: result.ok,
      review_id: result.review_id,
      sequence_ready: result.evidence?.sequence_ready_at_action ?? false,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: result.error === "contact_not_found" ? 404 : 400 })
    }

    const handoff = await handoffApprovedApolloContactToEnrollmentQueue(access.admin, {
      company_candidate_id: companyCandidateId,
      company_contact_id: body.companyContactId ?? null,
      contact_candidate_id: body.contactCandidateId ?? null,
      operator_review_id: result.review_id,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_handoff", {
      company_candidate_id: companyCandidateId.slice(0, 8),
      contact_id: result.contact_id?.slice(0, 8) ?? null,
      queue_item_id: handoff.queue_item_id?.slice(0, 8) ?? null,
      handoff_id: handoff.handoff?.handoff_id?.slice(0, 8) ?? null,
      ok: handoff.ok,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    return NextResponse.json({ ...result, enrollment_handoff: handoff })
  }

  if (action === "reject") {
    const result = await rejectApolloPrimaryContact(access.admin, {
      company_candidate_id: companyCandidateId,
      company_contact_id: body.companyContactId ?? null,
      contact_candidate_id: body.contactCandidateId ?? null,
      note: body.note,
      ...reviewer,
    })

    logGrowthEngine("apollo_primary_contact_operator_review_reject", {
      company_candidate_id: companyCandidateId.slice(0, 8),
      contact_id: result.contact_id?.slice(0, 8) ?? null,
      ok: result.ok,
      review_id: result.review_id,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: result.error === "contact_not_found" ? 404 : 400 })
    }
    return NextResponse.json(result)
  }

  if (action === "bulk_approve") {
    const result = await bulkApproveSequenceReadyApolloContacts(access.admin, {
      company_candidate_id: companyCandidateId,
      note: body.note,
      ...reviewer,
    })

    logGrowthEngine("apollo_primary_contact_operator_review_bulk_approve", {
      company_candidate_id: companyCandidateId.slice(0, 8),
      approved_count: result.contact_ids.length,
      ok: result.ok,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    const handoff = await bulkHandoffApprovedApolloContactsToEnrollmentQueue(access.admin, {
      company_candidate_id: companyCandidateId,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_bulk_handoff", {
      company_candidate_id: companyCandidateId.slice(0, 8),
      handoff_count: handoff.queue_item_ids.length,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    return NextResponse.json({ ...result, enrollment_handoff: handoff })
  }

  return NextResponse.json(
    {
      ok: false,
      error: "invalid_action",
      message: 'action must be "approve", "reject", or "bulk_approve".',
    },
    { status: 400 },
  )
}
