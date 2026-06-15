import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_DOCUMENT_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  KNOWLEDGE_VISIBILITY_LEVELS,
} from "@/lib/growth/knowledge-center/knowledge-document-types"
import {
  createKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
} from "@/lib/growth/knowledge-center/knowledge-repository"

export const runtime = "nodejs"
export const maxDuration = 120

const CreateSchema = z.object({
  source_type: z.enum(KNOWLEDGE_SOURCE_TYPES),
  title: z.string().min(1).max(300),
  content: z.string().max(50000).optional(),
  source_url: z.string().url().max(2000).optional().nullable(),
  source_filename: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(80)).max(24).optional(),
  categories: z.array(z.enum(KNOWLEDGE_CATEGORIES)).max(8).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITY_LEVELS).optional(),
  status: z.enum(KNOWLEDGE_DOCUMENT_STATUSES).optional(),
  metadata: z.record(z.unknown()).optional(),
  faq_question: z.string().max(1000).optional().nullable(),
  faq_answer: z.string().max(20000).optional().nullable(),
})

const UpdateSchema = z.object({
  knowledge_document_id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(50000).optional(),
  tags: z.array(z.string().max(80)).max(24).optional(),
  status: z.enum(KNOWLEDGE_DOCUMENT_STATUSES).optional(),
  visibility: z.enum(KNOWLEDGE_VISIBILITY_LEVELS).optional(),
  source_url: z.string().url().max(2000).optional().nullable(),
  source_filename: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const visibilityParam = url.searchParams.get("visibility")
  const status =
    statusParam && KNOWLEDGE_DOCUMENT_STATUSES.includes(statusParam as (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number])
      ? (statusParam as (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number])
      : null
  const visibility =
    visibilityParam &&
    KNOWLEDGE_VISIBILITY_LEVELS.includes(visibilityParam as (typeof KNOWLEDGE_VISIBILITY_LEVELS)[number])
      ? (visibilityParam as (typeof KNOWLEDGE_VISIBILITY_LEVELS)[number])
      : null

  try {
    const documents = await listKnowledgeDocuments(access.admin, { status, visibility, limit: 200 })
    return NextResponse.json({
      ok: true,
      documents,
      total: documents.length,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid knowledge document payload." }, { status: 400 })
  }

  try {
    const created = await createKnowledgeDocument(access.admin, {
      ...parsed.data,
      created_by_user_id: access.userId,
    })
    if (!created.ok || !created.result) {
      return NextResponse.json({ ok: false, error: created.error ?? "create_failed" }, { status: 422 })
    }
    return NextResponse.json({
      ok: true,
      ingestion: created.result,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "create_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid update payload." }, { status: 400 })
  }

  try {
    const updated = await updateKnowledgeDocument(access.admin, parsed.data)
    if (!updated.ok || !updated.document) {
      return NextResponse.json({ ok: false, error: updated.error ?? "update_failed" }, { status: updated.error === "not_found" ? 404 : 422 })
    }
    return NextResponse.json({
      ok: true,
      document: updated.document,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "update_failed", message }, { status: 500 })
  }
}
