import { NextResponse } from "next/server"
import { archiveSharePageForOperator } from "@/lib/growth/share-pages/share-page-operator-service"
import { requireSharePagePlatformAccess } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const page = await archiveSharePageForOperator(access.admin, {
      sharePageId: id,
      organizationId: access.organizationId,
    })
    return NextResponse.json({
      ok: true,
      page,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === "share_page_not_found") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
  }
}
