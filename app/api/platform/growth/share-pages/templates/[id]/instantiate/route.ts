import { NextResponse } from "next/server"
import { z } from "zod"
import {
  assertSharePageTemplateOrgScope,
  requireSharePageTemplatePlatformAccess,
} from "@/lib/growth/share-pages/share-page-template-platform-access"
import { instantiateSharePageFromTemplate } from "@/lib/growth/share-pages/share-page-template-instantiation"
import {
  GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_QA_MARKER,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"

export const runtime = "nodejs"

const InstantiateSchema = z.object({
  lead_id: z.string().uuid(),
  company_id: z.string().uuid().nullable().optional(),
  booking_page_id: z.string().uuid().nullable().optional(),
  draft_title: z.string().max(200).nullable().optional(),
  build_context: z.boolean().optional(),
  personalization_override: z.record(z.unknown()).nullable().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

function mapInstantiateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "template_not_found" || message === "lead_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Resource not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch" || message === "template_archived") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (message === "template_not_published") {
    return NextResponse.json(
      { ok: false, error: message, message: "Only published templates can be instantiated." },
      { status: 400 },
    )
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePageTemplatePlatformAccess()
  if (!access.ok) return access.response

  const parsed = InstantiateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid instantiate payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const result = await instantiateSharePageFromTemplate(access.admin, {
      templateId: id,
      organizationId: access.organizationId,
      leadId: parsed.data.lead_id,
      actorUserId: access.userId,
      companyId: parsed.data.company_id ?? null,
      bookingPageIdOverride: parsed.data.booking_page_id,
      draftTitleOverride: parsed.data.draft_title ?? null,
      personalizationOverride: parsed.data.personalization_override ?? null,
      buildContext: parsed.data.build_context,
    })

    return NextResponse.json({
      ok: true,
      share_page_id: result.sharePage.id,
      share_page: {
        id: result.sharePage.id,
        lead_id: result.sharePage.leadId,
        status: result.sharePage.status,
        share_page_template_id: result.sharePage.sharePageTemplateId,
        share_page_template_version_id: result.sharePage.sharePageTemplateVersionId,
      },
      template_id: result.templateId,
      template_version_id: result.templateVersionId,
      template_version_number: result.templateVersionNumber,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      no_live_page_publish: true,
      qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
      instantiation_qa_marker: GROWTH_SHARE_PAGE_TEMPLATE_INSTANTIATION_QA_MARKER,
    })
  } catch (error) {
    return mapInstantiateError(error)
  }
}
