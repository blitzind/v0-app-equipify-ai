import { NextResponse } from "next/server"
import {
  assertCanRestoreArchivedRecord,
  gateArchivedCenterAccess,
  isValidUuid,
} from "@/lib/archived-center/access"
import { isArchivedRecordType } from "@/lib/archived-center/fetch-archived"
import { restoreArchivedRecord } from "@/lib/archived-center/restore-record"
import { insertOrganizationAuditEvent } from "@/lib/organization-audit"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type Body = {
  organizationId?: string
  recordType?: string
  recordId?: string
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
    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : ""

    if (!isValidUuid(organizationId) || !isValidUuid(recordId) || !isArchivedRecordType(recordTypeRaw)) {
      return NextResponse.json({ message: "Invalid organizationId, recordType, or recordId." }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const gate = await gateArchivedCenterAccess(supabase, user, organizationId)
    if (!gate.ok) {
      return NextResponse.json({ message: gate.message }, { status: gate.status })
    }

    const restoreGate = await assertCanRestoreArchivedRecord(
      supabase,
      gate.userId,
      gate.organizationId,
      gate.platformAdmin,
    )
    if (!restoreGate.ok) {
      return NextResponse.json({ message: restoreGate.message }, { status: restoreGate.status })
    }

    let admin: ReturnType<typeof createServiceRoleSupabaseClient>
    try {
      admin = createServiceRoleSupabaseClient()
    } catch {
      return NextResponse.json({ message: "Server is not configured." }, { status: 503 })
    }

    const result = await restoreArchivedRecord(admin, gate.organizationId, recordTypeRaw, recordId)
    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: 400 })
    }

    await insertOrganizationAuditEvent({
      organizationId: gate.organizationId,
      action: "record_restored",
      actorUserId: gate.userId,
      recordType: recordTypeRaw,
      recordId,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[PATCH /api/archived/restore]", e)
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 })
  }
}
