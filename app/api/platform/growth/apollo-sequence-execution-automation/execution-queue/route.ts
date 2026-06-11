import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloSequenceExecutionQueue } from "@/lib/growth/apollo/apollo-sequence-execution-queue"
import type { ApolloSequenceExecutionCandidateStatus } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null
  const multichannelSequenceCandidateId =
    url.searchParams.get("multichannelSequenceCandidateId")?.trim() || null
  const statusParam = url.searchParams.get("status")?.trim()
  const status =
    statusParam === "pending_draft_approval" ||
    statusParam === "execution_ready" ||
    statusParam === "draft_rejected" ||
    statusParam === "draft_regenerated"
      ? (statusParam as ApolloSequenceExecutionCandidateStatus)
      : "all"

  try {
    const snapshot = await loadApolloSequenceExecutionQueue(access.admin, {
      company_candidate_id: companyCandidateId,
      multichannel_sequence_candidate_id: multichannelSequenceCandidateId,
      status,
    })
    return NextResponse.json({ ok: true, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
