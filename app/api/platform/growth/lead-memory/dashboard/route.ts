import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadMemoryDashboard } from "@/lib/growth/lead-memory/dashboard"
import { isGrowthLeadMemoryEngineSchemaReady } from "@/lib/growth/lead-memory/schema-health"
import { GROWTH_LEAD_MEMORY_PRIVACY_NOTE } from "@/lib/growth/lead-memory/memory-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthLeadMemoryEngineSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const dashboard = await fetchGrowthLeadMemoryDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_LEAD_MEMORY_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
