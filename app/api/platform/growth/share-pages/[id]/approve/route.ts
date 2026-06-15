import { NextResponse } from "next/server"
import { approveSharePageForOperator } from "@/lib/growth/share-pages/share-page-operator-service"
import { requireSharePagePlatformAccess, sharePageOrigin } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const result = await approveSharePageForOperator(access.admin, {
      sharePageId: id,
      organizationId: access.organizationId,
      approvedBy: access.userId,
      origin: sharePageOrigin(request),
    })
    return NextResponse.json({
      ok: true,
      ...result,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === "share_page_not_found") {
      return NextResponse.json({ ok: false, error: message }, { status: 404 })
    }
    if (message === "share_page_not_approvable") {
      return NextResponse.json({ ok: false, error: message, message: "Only draft or pending review pages can be approved." }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
  }
}
