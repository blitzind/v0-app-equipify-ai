import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloAccountPlaybookQueue } from "@/lib/growth/apollo/apollo-account-playbooks-queue"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("company_candidate_id")
  const enrollmentCandidateId = url.searchParams.get("enrollment_candidate_id")
  const status = url.searchParams.get("status")

  const snapshot = await loadApolloAccountPlaybookQueue(access.admin, {
    company_candidate_id: companyCandidateId,
    enrollment_candidate_id: enrollmentCandidateId,
    status:
      status === "pending_playbook_approval" ||
      status === "playbook_approved" ||
      status === "playbook_rejected" ||
      status === "playbook_rerun_requested" ||
      status === "all"
        ? status
        : "all",
  })

  return NextResponse.json(snapshot)
}
