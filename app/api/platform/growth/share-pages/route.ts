import { NextResponse } from "next/server"
import { growthSharePageListQuerySchema, growthSharePageCreateSchema } from "@/lib/growth/share-pages/share-page-api-schema"
import {
  createSharePageForOperator,
  listSharePagesForOperator,
} from "@/lib/growth/share-pages/share-page-operator-service"
import { requireSharePagePlatformAccess, sharePageOrigin } from "@/lib/growth/share-pages/share-page-platform-access"

export const runtime = "nodejs"

function mapSharePageError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "lead_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Lead not found." }, { status: 404 })
  }
  if (message.startsWith("token_hash_leak")) {
    return NextResponse.json({ ok: false, error: "internal_safety_violation" }, { status: 500 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}

export async function GET(request: Request) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const parsed = growthSharePageListQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query", message: "Invalid list filters." }, { status: 400 })
  }

  try {
    const result = await listSharePagesForOperator(access.admin, {
      organizationId: access.organizationId,
      status: parsed.data.status,
      sourceChannel: parsed.data.source_channel,
      search: parsed.data.search,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    })
    return NextResponse.json({
      ok: true,
      items: result.items,
      total: result.total,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      qa_marker: result.qaMarker,
    })
  } catch (error) {
    return mapSharePageError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireSharePagePlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthSharePageCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid share page payload." }, { status: 400 })
  }

  try {
    const created = await createSharePageForOperator(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      body: parsed.data,
      origin: sharePageOrigin(request),
    })
    return NextResponse.json({
      ok: true,
      ...created,
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    })
  } catch (error) {
    return mapSharePageError(error)
  }
}
