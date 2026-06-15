import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateKnowledgeRecommendationsForRequest } from "@/lib/growth/knowledge-center/knowledge-recommendation-service"
import { KNOWLEDGE_CONSUMERS } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export const runtime = "nodejs"
export const maxDuration = 120

const GenerateSchema = z.object({
  consumer: z.enum(KNOWLEDGE_CONSUMERS),
  organization_id: z.string().uuid().optional(),
  categories: z.array(z.string()).max(12).optional(),
  tags: z.array(z.string()).max(24).optional(),
  industry: z.string().max(120).optional(),
  company_id: z.string().max(120).optional(),
  lead_id: z.string().max(120).optional(),
  query: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  include_private: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = GenerateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const organization_id = parsed.data.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) {
    return NextResponse.json({ ok: false, error: "organization_id_required" }, { status: 400 })
  }

  try {
    const result = await generateKnowledgeRecommendationsForRequest(access.admin, {
      ...parsed.data,
      organization_id,
    })

    if (!result.ok || !result.result) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "recommendations_failed" },
        { status: 422 },
      )
    }

    return NextResponse.json({
      ok: true,
      recommendations: result.result.recommendations,
      citations: result.result.citations,
      consumer: result.result.consumer,
      qa_marker: result.result.qa_marker,
      generated_at: result.result.generated_at,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "recommendations_failed", message }, { status: 500 })
  }
}
