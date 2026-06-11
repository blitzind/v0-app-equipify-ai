import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveApolloMultichannelSequenceCandidate,
  rejectApolloMultichannelSequenceCandidate,
  regenerateApolloMultichannelSequenceRecommendation,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-queue"

export const runtime = "nodejs"

type MultichannelQueueAction = "approve_sequence" | "reject_sequence" | "regenerate_recommendation"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as MultichannelQueueAction
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
    case "approve_sequence":
      result = await approveApolloMultichannelSequenceCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "reject_sequence":
      result = await rejectApolloMultichannelSequenceCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "regenerate_recommendation":
      result = await regenerateApolloMultichannelSequenceRecommendation(access.admin, {
        candidate_id: candidateId,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("apollo_multichannel_queue_action", {
    action,
    candidate_id: candidateId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
  })

  return NextResponse.json(
    { ok: result.ok, result },
    { status: result.ok ? 200 : 422 },
  )
}
