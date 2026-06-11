import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  approveApolloVoiceDropCandidate,
  rejectApolloVoiceDropCandidate,
  regenerateApolloVoiceDropCandidateIntelligence,
} from "@/lib/growth/apollo/apollo-voice-drop-candidate-queue"

export const runtime = "nodejs"

type VoiceDropQueueAction = "approve_voice_drop" | "reject_voice_drop" | "rerun_intelligence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = asString(body?.action) as VoiceDropQueueAction
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
    case "approve_voice_drop":
      result = await approveApolloVoiceDropCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "reject_voice_drop":
      result = await rejectApolloVoiceDropCandidate(access.admin, {
        candidate_id: candidateId,
        ...actor,
      })
      break
    case "rerun_intelligence":
      result = await regenerateApolloVoiceDropCandidateIntelligence(access.admin, {
        candidate_id: candidateId,
        env: process.env,
      })
      break
    default:
      return NextResponse.json({ ok: false, message: "Invalid action." }, { status: 400 })
  }

  logGrowthEngine("apollo_voice_drop_queue_action", {
    action,
    candidate_id: candidateId,
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
  })

  return NextResponse.json(
    { ok: result.ok, result },
    { status: result.ok ? 200 : 422 },
  )
}
