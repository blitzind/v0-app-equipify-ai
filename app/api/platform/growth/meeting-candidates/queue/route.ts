import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloMeetingCandidateQueue } from "@/lib/growth/apollo/apollo-meeting-candidates-queue"
import type { ApolloMeetingCandidateStatus } from "@/lib/growth/apollo/apollo-meeting-bridge-types"

export const runtime = "nodejs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = asString(url.searchParams.get("leadId") || url.searchParams.get("lead_id")) || null
  const companyCandidateId =
    asString(url.searchParams.get("companyCandidateId") || url.searchParams.get("company_candidate_id")) ||
    null
  const statusParam = asString(url.searchParams.get("status")) || "all"
  const status = (statusParam === "all" ? "all" : statusParam) as ApolloMeetingCandidateStatus | "all"
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "100", 10)
  const limit = Number.isFinite(limitRaw) ? limitRaw : 100

  const snapshot = await loadApolloMeetingCandidateQueue(access.admin, {
    lead_id: leadId,
    company_candidate_id: companyCandidateId,
    status,
    limit,
  })

  return NextResponse.json(snapshot)
}
