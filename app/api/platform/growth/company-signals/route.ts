import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadCompanySignalSnapshot,
  runCompanySignalIntelligence,
} from "@/lib/growth/company-signals/company-signal-repository"
import { GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER } from "@/lib/growth/company-signals/company-signal-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("company_candidate_id")?.trim()
  if (!companyCandidateId) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_error",
        message: "company_candidate_id is required.",
      },
      { status: 400 },
    )
  }

  const run = url.searchParams.get("run") === "1"
  const snapshot = run
    ? await runCompanySignalIntelligence(access.admin, {
        company_candidate_id: companyCandidateId,
        created_by: access.userId,
      })
    : await loadCompanySignalSnapshot(access.admin, companyCandidateId)

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
    snapshot,
  })
}
