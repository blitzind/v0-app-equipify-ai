import { NextResponse } from "next/server"
import { growthSharePagePatchSchema } from "@/lib/growth/share-pages/share-page-api-schema"
import {
  getSharePageDetailForOperator,
  patchSharePageForOperator,
} from "@/lib/growth/share-pages/share-page-operator-service"
import {
  assertSharePageOrgScope,
  requireSharePagePlatformAccess,
  sharePageOrigin,
} from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

function mapSharePageError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "share_page_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Share page not found." }, { status: 404 })
  }
  if (message === "share_page_not_editable") {
    return NextResponse.json({ ok: false, error: message, message: "Share page is not editable in its current status." }, { status: 409 })
  }
  if (message.startsWith("token_hash_leak")) {
    return NextResponse.json({ ok: false, error: "internal_safety_violation" }, { status: 500 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const detail = await getSharePageDetailForOperator(access.admin, {
      sharePageId: id,
      organizationId: access.organizationId,
      origin: sharePageOrigin(_request),
    })
    if (!detail) {
      return NextResponse.json({ ok: false, error: "share_page_not_found" }, { status: 404 })
    }

    const scopeError = assertSharePageOrgScope(detail.page, access.organizationId)
    if (scopeError) return scopeError

    return NextResponse.json({
      ok: true,
      detail,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    })
  } catch (error) {
    return mapSharePageError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthSharePagePatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid patch payload." }, { status: 400 })
  }

  try {
    const page = await patchSharePageForOperator(access.admin, {
      sharePageId: id,
      organizationId: access.organizationId,
      body: parsed.data,
    })
    return NextResponse.json({
      ok: true,
      page,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (error) {
    return mapSharePageError(error)
  }
}
