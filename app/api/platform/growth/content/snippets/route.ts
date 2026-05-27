import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_CONTENT_SNIPPET_CATEGORIES } from "@/lib/growth/content/content-types"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { createContentSnippet, listContentSnippets } from "@/lib/growth/content/snippet-repository"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"
import type { GrowthContentStatus } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(GROWTH_CONTENT_SNIPPET_CATEGORIES),
  description: z.string().max(2000).optional(),
  content: z.string().max(20000).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const status = new URL(request.url).searchParams.get("status") as GrowthContentStatus | null
  try {
    const snippets = await listContentSnippets(access.admin, { status: status ?? undefined, limit: 100 })
    return NextResponse.json({ ok: true, snippets, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid snippet payload." }, { status: 400 })
  }

  try {
    const snippet = await createContentSnippet(access.admin, {
      ...parsed.data,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, snippet, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
