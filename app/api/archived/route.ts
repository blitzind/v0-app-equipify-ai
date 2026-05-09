import { NextResponse } from "next/server"
import { filterArchivedRows, fetchArchivedCenterRows } from "@/lib/archived-center/fetch-archived"
import { assertCanRestoreArchivedRecord, gateArchivedCenterAccess } from "@/lib/archived-center/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? ""
    const q = url.searchParams.get("q")?.trim() ?? ""
    const type = url.searchParams.get("type")?.trim() ?? "all"

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

    const rows = await fetchArchivedCenterRows(admin, gate.organizationId)
    const records = filterArchivedRows(rows, q, type)

    return NextResponse.json({ records })
  } catch (e) {
    console.error("[GET /api/archived]", e)
    return NextResponse.json({ message: "Unexpected error." }, { status: 500 })
  }
}
