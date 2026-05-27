import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { renderContentTemplatePreview } from "@/lib/growth/content/dashboard"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

const BodySchema = z.object({ values: z.record(z.string(), z.string()).optional() })

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid preview payload." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const preview = await renderContentTemplatePreview(access.admin, {
      templateId: id,
      values: parsed.data.values,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, preview, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "template_not_found" ? 404 : 500
    return NextResponse.json({ error: "preview_failed", message }, { status })
  }
}
