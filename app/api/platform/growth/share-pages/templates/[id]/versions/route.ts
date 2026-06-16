import { NextResponse } from "next/server"
import { z } from "zod"
import {
  createVersion,
  getTemplate,
  listTemplateVersionHistory,
} from "@/lib/growth/share-pages/share-page-template-repository"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import { GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const CreateVersionSchema = z.object({
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

    const versions = await listTemplateVersionHistory(access.admin, id)
    return NextResponse.json({
      ok: true,
      versions,
      current_version_id: template.currentVersionId,
      published_version_id: template.publishedVersionId,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateVersionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid version payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const template = await getTemplate(access.admin, id)
    if (!template) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(template, access.organizationId)
    if (scopeError) return scopeError

    const version = await createVersion(access.admin, {
      templateId: id,
      actorUserId: access.userId,
      blocks: parsed.data.blocks as never,
      theme: parsed.data.theme as never,
      defaultBookingPageId: parsed.data.default_booking_page_id,
      changeSummary: parsed.data.change_summary,
    })
    return NextResponse.json({
      ok: true,
      version,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}
