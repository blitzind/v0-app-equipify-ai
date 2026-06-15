import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_DOCUMENT_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_VISIBILITY_LEVELS,
} from "@/lib/growth/knowledge-center/knowledge-document-types"
import { runKnowledgeSearch } from "@/lib/growth/knowledge-center/knowledge-repository"

export const runtime = "nodejs"
export const maxDuration = 120

const SearchSchema = z.object({
  q: z.string().max(500).optional(),
  tags: z.string().max(500).optional(),
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  status: z.enum(KNOWLEDGE_DOCUMENT_STATUSES).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITY_LEVELS).optional(),
  source_type: z.enum(KNOWLEDGE_SOURCE_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = SearchSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    tags: url.searchParams.get("tags") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    visibility: url.searchParams.get("visibility") ?? undefined,
    source_type: url.searchParams.get("source_type") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  const tags = parsed.data.tags
    ? parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : undefined

  try {
    const search = await runKnowledgeSearch(access.admin, {
      query: parsed.data.q,
      tags,
      category: parsed.data.category,
      status: parsed.data.status,
      visibility: parsed.data.visibility,
      source_type: parsed.data.source_type,
      limit: parsed.data.limit,
    })
    return NextResponse.json({
      ok: true,
      search,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "search_failed", message }, { status: 500 })
  }
}
