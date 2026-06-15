import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { classifyKnowledgeDocument } from "@/lib/growth/knowledge-center/knowledge-classification"
import { KNOWLEDGE_SOURCE_TYPES } from "@/lib/growth/knowledge-center/knowledge-document-types"

export const runtime = "nodejs"
export const maxDuration = 60

const ClassifySchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(50000).optional(),
  source_type: z.enum(KNOWLEDGE_SOURCE_TYPES),
  source_url: z.string().max(2000).optional().nullable(),
  source_filename: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(80)).max(24).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ClassifySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  const classification = classifyKnowledgeDocument({
    title: parsed.data.title,
    content: parsed.data.content ?? "",
    source_type: parsed.data.source_type,
    source_url: parsed.data.source_url,
    source_filename: parsed.data.source_filename,
    tags: parsed.data.tags,
  })

  return NextResponse.json({
    ok: true,
    classification,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  })
}
