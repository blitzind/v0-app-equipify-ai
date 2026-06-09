import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveApolloPrimaryContactEnrollmentQueueItem,
  handoffApprovedApolloContactToEnrollmentQueue,
  rejectApolloPrimaryContactEnrollmentQueueItem,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge"

export const runtime = "nodejs"

type EnrollmentApprovalQueueActionBody = {
  action?: string
  companyCandidateId?: string
  companyContactId?: string | null
  contactCandidateId?: string | null
  queueItemId?: string | null
  operatorReviewId?: string | null
  note?: string | null
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as EnrollmentApprovalQueueActionBody
  const action = body.action?.trim()
  const approver = {
    approver_user_id: access.userId ?? null,
    approver_email: access.userEmail ?? null,
  }

  const startedMs = Date.now()

  if (action === "handoff") {
    const companyCandidateId = body.companyCandidateId?.trim()
    if (!companyCandidateId) {
      return NextResponse.json(
        { ok: false, error: "company_candidate_id_required", message: "companyCandidateId is required." },
        { status: 400 },
      )
    }

    const result = await handoffApprovedApolloContactToEnrollmentQueue(access.admin, {
      company_candidate_id: companyCandidateId,
      company_contact_id: body.companyContactId ?? null,
      contact_candidate_id: body.contactCandidateId ?? null,
      operator_review_id: body.operatorReviewId ?? null,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_handoff", {
      company_candidate_id: companyCandidateId.slice(0, 8),
      queue_item_id: result.queue_item_id?.slice(0, 8) ?? null,
      handoff_id: result.handoff?.handoff_id?.slice(0, 8) ?? null,
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
    return NextResponse.json(result)
  }

  if (action === "approve_enrollment") {
    const queueItemId = body.queueItemId?.trim()
    if (!queueItemId) {
      return NextResponse.json(
        { ok: false, error: "queue_item_id_required", message: "queueItemId is required." },
        { status: 400 },
      )
    }

    const result = await approveApolloPrimaryContactEnrollmentQueueItem(access.admin, {
      queue_item_id: queueItemId,
      note: body.note,
      ...approver,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_approved", {
      queue_item_id: queueItemId.slice(0, 8),
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
    return NextResponse.json(result)
  }

  if (action === "reject_enrollment") {
    const queueItemId = body.queueItemId?.trim()
    if (!queueItemId) {
      return NextResponse.json(
        { ok: false, error: "queue_item_id_required", message: "queueItemId is required." },
        { status: 400 },
      )
    }

    const result = await rejectApolloPrimaryContactEnrollmentQueueItem(access.admin, {
      queue_item_id: queueItemId,
      note: body.note,
      ...approver,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_rejected", {
      queue_item_id: queueItemId.slice(0, 8),
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
    return NextResponse.json(result)
  }

  return NextResponse.json(
    {
      ok: false,
      error: "invalid_action",
      message: 'action must be "handoff", "approve_enrollment", or "reject_enrollment".',
    },
    { status: 400 },
  )
}
