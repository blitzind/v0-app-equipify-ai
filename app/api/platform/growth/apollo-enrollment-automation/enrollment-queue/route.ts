import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloEnrollmentCandidateQueue } from "@/lib/growth/apollo/apollo-enrollment-candidate-queue"
import type { ApolloEnrollmentCandidateStatus } from "@/lib/growth/apollo/apollo-enrollment-automation-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null
  const statusParam = url.searchParams.get("status")?.trim()
  const status =
    statusParam === "pending_enrollment_approval" ||
    statusParam === "enrollment_approved" ||
    statusParam === "enrollment_rejected" ||
    statusParam === "research_rerun_requested"
      ? (statusParam as ApolloEnrollmentCandidateStatus)
      : "all"

  try {
    const snapshot = await loadApolloEnrollmentCandidateQueue(access.admin, {
      company_candidate_id: companyCandidateId,
      status,
    })
    return NextResponse.json({ ok: true, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
