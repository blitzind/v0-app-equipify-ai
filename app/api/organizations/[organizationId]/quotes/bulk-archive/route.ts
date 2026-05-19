import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { bulkArchiveQuotes } from "@/lib/quotes/bulk-archive-quotes"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BULK_ARCHIVE = 100

type Body = {
  quoteIds?: string[]
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await context.params
    if (!UUID_RE.test(organizationId)) {
      return NextResponse.json({ message: "Invalid organization." }, { status: 400 })
    }

    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 })
    }

    const quoteIdsRaw = Array.isArray(body.quoteIds) ? body.quoteIds : []
    const quoteIds = [
      ...new Set(quoteIdsRaw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
    ]

    if (quoteIds.length === 0) {
      return NextResponse.json({ message: "Select at least one quote to archive." }, { status: 400 })
    }
    if (quoteIds.length > MAX_BULK_ARCHIVE) {
      return NextResponse.json(
        { message: `You can archive up to ${MAX_BULK_ARCHIVE} quotes at a time.` },
        { status: 400 },
      )
    }
    if (!quoteIds.every((id) => UUID_RE.test(id))) {
      return NextResponse.json({ message: "One or more selected quotes are invalid." }, { status: 400 })
    }

    const gate = await requireOrgPermission(organizationId, "canArchiveRecords")
    if ("error" in gate) return gate.error

    const { results } = await bulkArchiveQuotes(
      gate.supabase,
      organizationId,
      quoteIds,
      gate.userId,
    )

    const succeededIds = results.filter((r) => r.ok).map((r) => r.id)
    const failedIds = results.filter((r) => !r.ok).map((r) => r.id)

    return NextResponse.json({
      ok: true,
      succeededCount: succeededIds.length,
      failedCount: failedIds.length,
      failedIds,
    })
  } catch (e) {
    console.error("[PATCH quotes/bulk-archive]", e)
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 })
  }
}
