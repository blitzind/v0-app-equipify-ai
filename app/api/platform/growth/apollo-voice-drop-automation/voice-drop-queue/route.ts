import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloVoiceDropCandidateQueue } from "@/lib/growth/apollo/apollo-voice-drop-candidate-queue"
import type { ApolloVoiceDropCandidateStatus } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null
  const enrollmentCandidateId = url.searchParams.get("enrollmentCandidateId")?.trim() || null
  const statusParam = url.searchParams.get("status")?.trim()
  const status =
    statusParam === "pending_voice_drop_approval" ||
    statusParam === "voice_drop_approved" ||
    statusParam === "voice_drop_rejected" ||
    statusParam === "intelligence_rerun_requested"
      ? (statusParam as ApolloVoiceDropCandidateStatus)
      : "all"

  try {
    const snapshot = await loadApolloVoiceDropCandidateQueue(access.admin, {
      company_candidate_id: companyCandidateId,
      enrollment_candidate_id: enrollmentCandidateId,
      status,
    })
    return NextResponse.json({ ok: true, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
