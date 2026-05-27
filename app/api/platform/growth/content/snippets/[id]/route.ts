import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { getContentSnippet, updateContentSnippet } from "@/lib/growth/content/snippet-repository"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  content: z.string().max(20000).optional(),
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
    const snippet = await getContentSnippet(access.admin, id)
    if (!snippet) {
      return NextResponse.json({ error: "not_found", message: "Snippet not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, snippet, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid snippet update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const snippet = await updateContentSnippet(access.admin, id, {
      ...parsed.data,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, snippet, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "snippet_not_found" ? 404 : 500
    return NextResponse.json({ error: "update_failed", message }, { status })
  }
}
