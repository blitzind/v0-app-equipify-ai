import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveApolloEnrollmentCandidate,
  rejectApolloEnrollmentCandidate,
  requestApolloEnrollmentResearchRerun,
} from "@/lib/growth/apollo/apollo-enrollment-candidate-queue"

export const runtime = "nodejs"

type EnrollmentQueueAction =
  | "approve_enrollment"
  | "reject_enrollment"
  | "rerun_research"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as EnrollmentQueueAction
  const candidateId = asString(body?.candidateId) || asString(body?.candidate_id)
  const note = asString(body?.note) || null

  if (!candidateId) {
    return NextResponse.json({ ok: false, message: "candidateId is required." }, { status: 400 })
  }

  const actor = {
    approver_user_id: access.userId,
    approver_email: access.userEmail,
    note,
  }

  let result
  switch (action) {
    case "approve_enrollment":
      result = await approveApolloEnrollmentCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "reject_enrollment":
      result = await rejectApolloEnrollmentCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "rerun_research":
      result = await requestApolloEnrollmentResearchRerun(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("apollo_enrollment_queue_action", {
    action,
    candidate_id: candidateId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  })

  return NextResponse.json(
    { ok: result.ok, result },
    { status: result.ok ? 200 : 422 },
  )
}
