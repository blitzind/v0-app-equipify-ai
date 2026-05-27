import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { approveContentSnippet } from "@/lib/growth/content/snippet-repository"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

const BodySchema = z.object({ humanApprovalConfirmed: z.boolean().optional() })

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || parsed.data.humanApprovalConfirmed !== true) {
    return NextResponse.json(
      { error: "human_approval_required", message: "Human confirmation required to approve snippet." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const snippet = await approveContentSnippet(access.admin, {
      snippetId: id,
      actorUserId: access.userId,
    })
    return NextResponse.json({ ok: true, snippet, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "snippet_not_found" ? 404 : message.includes("merge") ? 400 : 500
    return NextResponse.json({ error: "approve_failed", message }, { status })
  }
}
