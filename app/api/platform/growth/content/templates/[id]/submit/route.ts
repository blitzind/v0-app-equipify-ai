import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { submitContentTemplateForReview } from "@/lib/growth/content/template-repository"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const template = await submitContentTemplateForReview(access.admin, {
      templateId: id,
      actorUserId: access.userId,
    })
    return NextResponse.json({
      ok: true,
      template,
      privacy_note: GROWTH_CONTENT_PRIVACY_NOTE,
      message: "Template submitted for review — not available for live send until approved.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "template_not_found" ? 404 : message === "invalid_status" ? 400 : message.includes("merge") ? 400 : 500
    return NextResponse.json({ error: "submit_failed", message }, { status })
  }
}
