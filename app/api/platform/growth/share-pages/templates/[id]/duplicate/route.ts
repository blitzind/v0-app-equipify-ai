import { NextResponse } from "next/server"
import { z } from "zod"
import {
  duplicateTemplate,
  getTemplate,
} from "@/lib/growth/share-pages/share-page-template-repository"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import { GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const DuplicateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

function mapTemplateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "template_not_found" || message === "version_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Template not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = DuplicateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid duplicate payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const existing = await getTemplate(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    const template = await duplicateTemplate(access.admin, {
      templateId: id,
      organizationId: access.organizationId,
      actorUserId: access.userId,
      name: parsed.data.name,
    })
    return NextResponse.json({
      ok: true,
      template,
      duplicated: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      no_live_page_publish: true,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}
