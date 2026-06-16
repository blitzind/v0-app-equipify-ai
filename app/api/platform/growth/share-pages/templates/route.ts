import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createTemplate,
  listTemplates,
} from "@/lib/growth/share-pages/share-page-template-repository"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES,
  GROWTH_SHARE_PAGE_TEMPLATE_STATUSES,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  category: z.enum(GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  preview_image_url: z.string().url().max(2000).nullable().optional(),
  blocks: z.array(z.record(z.unknown())).max(100).optional(),
  theme: z.record(z.unknown()).optional(),
  default_booking_page_id: z.string().uuid().nullable().optional(),
  change_summary: z.string().max(1000).optional(),
})

function mapTemplateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "template_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Template not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch" || message === "template_archived") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (message === "invalid_status" || message === "version_not_found" || message === "version_already_published") {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function GET(request: Request) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const status =
    statusParam && (GROWTH_SHARE_PAGE_TEMPLATE_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof GROWTH_SHARE_PAGE_TEMPLATE_STATUSES)[number])
      : undefined

  try {
    const result = await listTemplates(access.admin, {
      organizationId: access.organizationId,
      status,
      category: url.searchParams.get("category") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    })
    return NextResponse.json({
      ok: true,
      items: result.items,
      total: result.total,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid template payload." }, { status: 400 })
  }

  try {
    const template = await createTemplate(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      tags: parsed.data.tags,
      previewImageUrl: parsed.data.preview_image_url,
      blocks: parsed.data.blocks as never,
      theme: parsed.data.theme as never,
      defaultBookingPageId: parsed.data.default_booking_page_id,
      changeSummary: parsed.data.change_summary,
    })
    return NextResponse.json({
      ok: true,
      template,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}
