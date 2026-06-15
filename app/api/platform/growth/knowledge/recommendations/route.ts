import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generateKnowledgeRecommendationsForRequest } from "@/lib/growth/knowledge-center/knowledge-recommendation-service"
import { KNOWLEDGE_CONSUMERS } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export const runtime = "nodejs"
export const maxDuration = 120

const QuerySchema = z.object({
  consumer: z.enum(KNOWLEDGE_CONSUMERS),
  organization_id: z.string().uuid().optional(),
  categories: z.string().optional(),
  tags: z.string().optional(),
  industry: z.string().max(120).optional(),
  company_id: z.string().max(120).optional(),
  lead_id: z.string().max(120).optional(),
  query: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  include_private: z.coerce.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  const organization_id = parsed.data.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) {
    return NextResponse.json({ ok: false, error: "organization_id_required" }, { status: 400 })
  }

  try {
    const result = await generateKnowledgeRecommendationsForRequest(access.admin, {
      consumer: parsed.data.consumer,
      organization_id,
      categories: parsed.data.categories?.split(",").filter(Boolean),
      tags: parsed.data.tags?.split(",").filter(Boolean),
      industry: parsed.data.industry,
      company_id: parsed.data.company_id,
      lead_id: parsed.data.lead_id,
      query: parsed.data.query,
      limit: parsed.data.limit,
      include_private: parsed.data.include_private,
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
