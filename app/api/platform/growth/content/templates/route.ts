import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_CONTENT_TEMPLATE_TYPES } from "@/lib/growth/content/content-types"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { createContentTemplate, listContentTemplates } from "@/lib/growth/content/template-repository"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"
import type { GrowthContentStatus } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  templateType: z.enum(GROWTH_CONTENT_TEMPLATE_TYPES),
  description: z.string().max(2000).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(50000).optional(),
  complianceFooterRequired: z.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status") as GrowthContentStatus | null
  try {
    const templates = await listContentTemplates(access.admin, { status: status ?? undefined, limit: 100 })
    return NextResponse.json({ ok: true, templates, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid template payload." }, { status: 400 })
  }

  try {
    const template = await createContentTemplate(access.admin, {
      ...parsed.data,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, template, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
