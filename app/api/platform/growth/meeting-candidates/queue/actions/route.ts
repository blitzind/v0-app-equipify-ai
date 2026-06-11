import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveApolloMeetingCandidate,
  rejectApolloMeetingCandidate,
} from "@/lib/growth/apollo/apollo-meeting-candidates-queue"

export const runtime = "nodejs"

type MeetingCandidateQueueAction = "approve_meeting_candidate" | "reject_meeting_candidate"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as MeetingCandidateQueueAction
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
    case "approve_meeting_candidate":
      result = await approveApolloMeetingCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "reject_meeting_candidate":
      result = await rejectApolloMeetingCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("apollo_meeting_candidate_queue_action", {
    action,
    candidate_id: candidateId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  })

  return NextResponse.json({ ok: result.ok, result }, { status: result.ok ? 200 : 422 })
}
