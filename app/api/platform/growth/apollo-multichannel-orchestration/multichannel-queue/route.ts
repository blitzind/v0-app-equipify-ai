import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloMultichannelSequenceQueue } from "@/lib/growth/apollo/apollo-multichannel-orchestration-queue"
import type { ApolloMultichannelSequenceCandidateStatus } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { parseApolloQueueRequestSearchParams } from "@/lib/growth/apollo/apollo-queue-pagination"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null
  const voiceDropCandidateId = url.searchParams.get("voiceDropCandidateId")?.trim() || null
  const statusParam = url.searchParams.get("status")?.trim()
  const status =
    statusParam === "pending_sequence_approval" ||
    statusParam === "sequence_approved" ||
    statusParam === "sequence_rejected" ||
    statusParam === "recommendation_regenerated"
      ? (statusParam as ApolloMultichannelSequenceCandidateStatus)
      : "all"

  try {
    const snapshot = await loadApolloMultichannelSequenceQueue(access.admin, {
      company_candidate_id: companyCandidateId,
      voice_drop_candidate_id: voiceDropCandidateId,
      status,
      pagination: parseApolloQueueRequestSearchParams(url.searchParams),
    })
    return NextResponse.json({ ok: true, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
