import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runKnowledgeRetrieval } from "@/lib/growth/knowledge-center/knowledge-repository"
import { KNOWLEDGE_CONSUMERS } from "@/lib/growth/knowledge-center/knowledge-retrieval-types"

export const runtime = "nodejs"
export const maxDuration = 120

const RetrieveSchema = z.object({
  consumer: z.enum(KNOWLEDGE_CONSUMERS),
  organization_id: z.string().uuid().optional(),
  categories: z.array(z.string()).max(12).optional(),
  tags: z.array(z.string()).max(24).optional(),
  industry: z.string().max(120).optional(),
  company_id: z.string().max(120).optional(),
  lead_id: z.string().max(120).optional(),
  query: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  include_private: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = RetrieveSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const organization_id = parsed.data.organization_id ?? getGrowthEngineAiOrgId()
  if (!organization_id) {
    return NextResponse.json({ ok: false, error: "organization_id_required" }, { status: 400 })
  }

  try {
    const retrieval = await runKnowledgeRetrieval(access.admin, {
      organization_id,
      consumer: parsed.data.consumer,
      categories: parsed.data.categories,
      tags: parsed.data.tags,
      industry: parsed.data.industry,
      company_id: parsed.data.company_id,
      lead_id: parsed.data.lead_id,
      query: parsed.data.query,
      limit: parsed.data.limit,
      include_private: parsed.data.include_private,
    })

    return NextResponse.json({
      ok: true,
      ...retrieval,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "retrieve_failed", message }, { status: 500 })
  }
}
