import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadVerificationEnrichmentSnapshot,
  runVerificationEnrichment,
} from "@/lib/growth/enrichment/enrichment-repository"
import { GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER } from "@/lib/growth/enrichment/enrichment-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const contactCandidateId = url.searchParams.get("contact_candidate_id")?.trim() || null
  const companyCandidateId = url.searchParams.get("company_candidate_id")?.trim() || null

  if (!contactCandidateId && !companyCandidateId) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_error",
        message: "contact_candidate_id or company_candidate_id is required.",
      },
      { status: 400 },
    )
  }

  const run = url.searchParams.get("run") === "1"
  const snapshot = run
    ? await runVerificationEnrichment(access.admin, {
        contact_candidate_id: contactCandidateId,
        company_candidate_id: companyCandidateId,
        created_by: access.userId,
      })
    : await loadVerificationEnrichmentSnapshot(access.admin, {
        contact_candidate_id: contactCandidateId,
        company_candidate_id: companyCandidateId,
      })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
    snapshot,
  })
}
