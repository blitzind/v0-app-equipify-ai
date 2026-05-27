import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import {
  getContentTemplate,
  listContentTemplateVersions,
  updateContentTemplate,
} from "@/lib/growth/content/template-repository"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(50000).optional(),
  snippetIds: z.array(z.string().uuid()).optional(),
  complianceFooterRequired: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const [template, versions] = await Promise.all([
      getContentTemplate(access.admin, id),
      listContentTemplateVersions(access.admin, id),
    ])
    if (!template) {
      return NextResponse.json({ error: "not_found", message: "Template not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, template, versions, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid template update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const template = await updateContentTemplate(access.admin, id, {
      ...parsed.data,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, template, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "template_not_found" ? 404 : message.startsWith("blocked_merge") ? 400 : 500
    return NextResponse.json({ error: "update_failed", message }, { status })
  }
}
