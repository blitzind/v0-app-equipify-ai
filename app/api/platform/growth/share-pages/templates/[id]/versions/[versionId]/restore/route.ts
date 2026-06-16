import { NextResponse } from "next/server"
import { z } from "zod"
import {
  getTemplate,
  restoreVersion,
} from "@/lib/growth/share-pages/share-page-template-repository"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import { GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const RestoreSchema = z.object({
  change_summary: z.string().max(1000).optional(),
})

type RouteContext = { params: Promise<{ id: string; versionId: string }> }

function mapTemplateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "template_not_found" || message === "version_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Version not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch" || message === "template_archived") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = RestoreSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid restore payload." }, { status: 400 })
  }

  const { id, versionId } = await context.params
  try {
    const existing = await getTemplate(access.admin, id)
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template not found." }, { status: 404 })
    }
    const scopeError = assertSharePageTemplateOrgScope(existing, access.organizationId)
    if (scopeError) return scopeError

    const template = await restoreVersion(access.admin, {
      templateId: id,
      versionId,
      actorUserId: access.userId,
      changeSummary: parsed.data.change_summary,
    })
    return NextResponse.json({
      ok: true,
      template,
      restored: true,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      no_live_page_publish: true,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    })
  } catch (error) {
    return mapTemplateError(error)
  }
}
