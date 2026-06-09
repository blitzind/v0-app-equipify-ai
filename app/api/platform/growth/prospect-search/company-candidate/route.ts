import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadProspectSearchCompanyCandidateForOperatorReview } from "@/lib/growth/prospect-search/prospect-search-company-candidate-deep-link"
import { GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-company-candidate-deep-link-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim()
  const canonicalCompanyId = url.searchParams.get("canonicalCompanyId")?.trim() || null

  if (!companyCandidateId) {
    return NextResponse.json(
      {
        ok: false,
        error: "company_candidate_id_required",
        message: "companyCandidateId query param is required.",
      },
      { status: 400 },
    )
  }

  const loaded = await loadProspectSearchCompanyCandidateForOperatorReview(access.admin, {
    company_candidate_id: companyCandidateId,
    canonical_company_id: canonicalCompanyId,
  })

  if (!loaded.ok || !loaded.company || !loaded.result) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_PROSPECT_SEARCH_COMPANY_CANDIDATE_DEEP_LINK_QA_MARKER,
        message: loaded.message,
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    auth_method: "platform_admin",
    qa_marker: loaded.qa_marker,
    company: loaded.company,
    result: loaded.result,
    source_table: loaded.source_table,
    message: loaded.message,
    auto_enrollment: false,
    outreach_sent: false,
  })
}
