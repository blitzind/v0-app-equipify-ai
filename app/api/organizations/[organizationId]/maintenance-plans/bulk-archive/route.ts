import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { bulkArchiveMaintenancePlans } from "@/lib/maintenance-plans/bulk-archive-maintenance-plans"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BULK_ARCHIVE = 100

type Body = {
  planIds?: string[]
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

    const planIdsRaw = Array.isArray(body.planIds) ? body.planIds : []
    const planIds = [
      ...new Set(planIdsRaw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
    ]

    if (planIds.length === 0) {
      return NextResponse.json(
        { message: "Select at least one maintenance plan to archive." },
        { status: 400 },
      )
    }
    if (planIds.length > MAX_BULK_ARCHIVE) {
      return NextResponse.json(
        { message: `You can archive up to ${MAX_BULK_ARCHIVE} maintenance plans at a time.` },
        { status: 400 },
      )
    }
    if (!planIds.every((id) => UUID_RE.test(id))) {
      return NextResponse.json(
        { message: "One or more selected maintenance plans are invalid." },
        { status: 400 },
      )
    }

    const gate = await requireOrgPermission(organizationId, "canArchiveRecords")
    if ("error" in gate) return gate.error

    const { results } = await bulkArchiveMaintenancePlans(
      gate.supabase,
      organizationId,
      planIds,
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
    console.error("[PATCH maintenance-plans/bulk-archive]", e)
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 })
  }
}
