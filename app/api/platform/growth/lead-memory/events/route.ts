import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listLeadMemoryEvents } from "@/lib/growth/lead-memory/dashboard"
import { isGrowthLeadMemoryEngineSchemaReady } from "@/lib/growth/lead-memory/schema-health"
import { GROWTH_LEAD_MEMORY_PRIVACY_NOTE } from "@/lib/growth/lead-memory/memory-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthLeadMemoryEngineSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId") ?? undefined
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam ? Math.min(200, Math.max(1, Number(limitParam) || 50)) : 50

  try {
    const events = await listLeadMemoryEvents(access.admin, leadId, limit)
    return NextResponse.json({ ok: true, events, privacy_note: GROWTH_LEAD_MEMORY_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
