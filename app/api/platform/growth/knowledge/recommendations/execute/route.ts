import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  assertKnowledgeRecommendationsAllowed,
  executeKnowledgeRecommendationsCertification,
  KNOWLEDGE_RECOMMENDATION_CONFIRM,
} from "@/lib/growth/knowledge-center/knowledge-recommendation-certification"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const gateCheck = assertKnowledgeRecommendationsAllowed(process.env)
  if (!gateCheck.ok) {
    return NextResponse.json({ ok: false, blockers: gateCheck.blockers }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const confirm = (body as Record<string, unknown> | null)?.confirm
  if (confirm !== KNOWLEDGE_RECOMMENDATION_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirm_token_mismatch" }, { status: 400 })
  }

  const report = await executeKnowledgeRecommendationsCertification(access.admin, {
    dry_run: (body as Record<string, unknown>)?.dry_run === true,
  })

  return NextResponse.json(report, { status: report.ok ? 200 : 422 })
}
