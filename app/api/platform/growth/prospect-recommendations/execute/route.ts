import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertProspectRecommendationsAllowed,
  executeProspectRecommendationsCertification,
  PROSPECT_RECOMMENDATION_CONFIRM,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-certification"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertProspectRecommendationsAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== PROSPECT_RECOMMENDATION_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const execution_run_id =
    typeof (body as Record<string, unknown> | null)?.execution_run_id === "string"
      ? ((body as Record<string, unknown>).execution_run_id as string)
      : null

  const report = await executeProspectRecommendationsCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
    execution_run_id,
  })

  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
