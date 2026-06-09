import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloPrimaryContactEnrollmentDraftPanelSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-bridge"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null

  try {
    const snapshot = await loadApolloPrimaryContactEnrollmentDraftPanelSnapshot(access.admin, {
      company_candidate_id: companyCandidateId,
    })
    return NextResponse.json({ ok: true, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
