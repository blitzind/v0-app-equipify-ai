import { NextResponse } from "next/server"
import { z } from "zod"
import {
  archiveTemplate,
  getTemplate,
  updateTemplate,
} from "@/lib/growth/share-pages/share-page-template-repository"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import { GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  category: z.string().min(1).max(120).optional(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  preview_image_url: z.string().url().max(2000).nullable().optional(),
  blocks: z.array(z.record(z.unknown())).max(100).optional(),
  theme: z.record(z.unknown()).optional(),
  default_booking_page_id: z.string().uuid().nullable().optional(),
  change_summary: z.string().max(1000).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

function mapTemplateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "template_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Template not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch" || message === "template_archived") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (message === "invalid_status" || message === "version_not_found") {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const template = await getTemplate(access.admin, id)
    if (!template) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(template, access.organizationId)
    if (scopeError) return scopeError

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

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid template update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const existing = await getTemplate(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    const template = await updateTemplate(access.admin, id, {
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      tags: parsed.data.tags,
      previewImageUrl: parsed.data.preview_image_url,
      blocks: parsed.data.blocks as never,
      theme: parsed.data.theme as never,
      defaultBookingPageId: parsed.data.default_booking_page_id,
      changeSummary: parsed.data.change_summary,
      actorUserId: access.userId,
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

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params

  try {
    const existing = await getTemplate(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    const template = await archiveTemplate(access.admin, id)
    return NextResponse.json({
      ok: true,
      template,
      archived: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}
