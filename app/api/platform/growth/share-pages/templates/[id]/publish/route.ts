import { NextResponse } from "next/server"
import { z } from "zod"
import {
  getTemplate,
  publishVersion,
} from "@/lib/growth/share-pages/share-page-template-repository"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import { GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const PublishSchema = z.object({
  version_id: z.string().uuid().optional(),
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
  if (
    message === "invalid_status" ||
    message === "version_not_found" ||
    message === "version_already_published" ||
    message === "invalid_version_status"
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = PublishSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid publish payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const existing = await getTemplate(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    const template = await publishVersion(access.admin, {
      templateId: id,
      versionId: parsed.data.version_id ?? null,
      actorUserId: access.userId,
    })
    return NextResponse.json({
      ok: true,
      template,
      published: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      no_live_page_publish: true,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}
