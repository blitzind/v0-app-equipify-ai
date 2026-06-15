import { NextResponse } from "next/server"
import { growthSharePagePreviewSchema } from "@/lib/growth/share-pages/share-page-api-schema"
import { regenerateSharePagePreviewForOperator } from "@/lib/growth/share-pages/share-page-operator-service"
import { requireSharePagePlatformAccess, sharePageOrigin } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthSharePagePreviewSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await regenerateSharePagePreviewForOperator(access.admin, {
      sharePageId: id,
      organizationId: access.organizationId,
      origin: sharePageOrigin(request),
      rebuildContext: parsed.data.rebuild_context ?? true,
    })
    return NextResponse.json({
      ok: true,
      ...result,
      preview_label: "Admin preview — not published",
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === "share_page_not_found") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    if (message === "share_page_archived") {
      return NextResponse.json({ ok: false, error: message }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
  }
}
