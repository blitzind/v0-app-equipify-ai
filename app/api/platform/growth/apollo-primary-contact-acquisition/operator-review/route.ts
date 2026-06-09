import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim()
  if (!companyCandidateId) {
    return NextResponse.json(
      { ok: false, error: "company_candidate_id_required", message: "companyCandidateId query param is required." },
      { status: 400 },
    )
  }

  const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(access.admin, companyCandidateId)
  if (!snapshot) {
    return NextResponse.json(
      { ok: false, error: "company_not_found", message: "Company candidate not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    auth_method: "platform_admin",
    snapshot,
  })
}
