import { NextResponse } from "next/server"
import {
  assertCanRestoreArchivedRecord,
  gateArchivedCenterAccess,
  isValidUuid,
} from "@/lib/archived-center/access"
import { bulkArchiveWorkOrders } from "@/lib/archived-center/archive-record"
import { isArchivedRecordType } from "@/lib/archived-center/fetch-archived"
import { insertOrganizationAuditEvent } from "@/lib/organization-audit"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const MAX_BULK_ARCHIVE = 100

type Body = {
  organizationId?: string
  recordType?: string
  recordIds?: string[]
}

export async function PATCH(request: Request) {
  try {
    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 })
    }

    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
    const recordTypeRaw = typeof body.recordType === "string" ? body.recordType.trim() : ""
    const recordIdsRaw = Array.isArray(body.recordIds) ? body.recordIds : []

    if (!isValidUuid(organizationId) || !isArchivedRecordType(recordTypeRaw)) {
      return NextResponse.json({ message: "Invalid organizationId or recordType." }, { status: 400 })
    }

    if (recordTypeRaw !== "work_order") {
      return NextResponse.json({ message: "Bulk archive is not supported for this record type." }, { status: 400 })
    }

    const recordIds = [...new Set(recordIdsRaw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean))]
    if (recordIds.length === 0) {
      return NextResponse.json({ message: "Select at least one work order to archive." }, { status: 400 })
    }
    if (recordIds.length > MAX_BULK_ARCHIVE) {
      return NextResponse.json(
        { message: `You can archive up to ${MAX_BULK_ARCHIVE} work orders at a time.` },
        { status: 400 },
      )
    }
    if (!recordIds.every(isValidUuid)) {
      return NextResponse.json({ message: "One or more selected work orders are invalid." }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const gate = await gateArchivedCenterAccess(supabase, user, organizationId)
    if (!gate.ok) {
      return NextResponse.json({ message: gate.message }, { status: gate.status })
    }

    const archiveGate = await assertCanRestoreArchivedRecord(
      supabase,
      gate.userId,
      gate.organizationId,
      gate.platformAdmin,
    )
    if (!archiveGate.ok) {
      return NextResponse.json({ message: archiveGate.message }, { status: archiveGate.status })
    }

    let admin: ReturnType<typeof createServiceRoleSupabaseClient>
    try {
      admin = createServiceRoleSupabaseClient()
    } catch {
      return NextResponse.json({ message: "Server is not configured." }, { status: 503 })
    }

    const { results } = await bulkArchiveWorkOrders(admin, gate.organizationId, recordIds, gate.userId)

    const succeededIds = results.filter((r) => r.ok).map((r) => r.id)
    const failedIds = results.filter((r) => !r.ok).map((r) => r.id)

    for (const recordId of succeededIds) {
      await insertOrganizationAuditEvent({
        organizationId: gate.organizationId,
        action: "record_archived",
        actorUserId: gate.userId,
        recordType: recordTypeRaw,
        recordId,
      })
    }

    return NextResponse.json({
      ok: true,
      succeededCount: succeededIds.length,
      failedCount: failedIds.length,
      failedIds,
    })
  } catch (e) {
    console.error("[PATCH /api/archived/archive/bulk]", e)
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 })
  }
}
