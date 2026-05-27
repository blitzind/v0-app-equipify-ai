import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { rebuildLeadMemoryProfile } from "@/lib/growth/lead-memory/dashboard"
import { isGrowthLeadMemoryEngineSchemaReady } from "@/lib/growth/lead-memory/schema-health"
import { GROWTH_LEAD_MEMORY_PRIVACY_NOTE } from "@/lib/growth/lead-memory/memory-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthLeadMemoryEngineSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { leadId } = await context.params
  if (!leadId?.trim()) {
    return NextResponse.json({ error: "invalid_lead_id" }, { status: 400 })
  }

  try {
    const profile = await rebuildLeadMemoryProfile(access.admin, leadId, access.userId)
    return NextResponse.json({ ok: true, profile, privacy_note: GROWTH_LEAD_MEMORY_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === "lead_not_found") {
      return NextResponse.json({ error: "lead_not_found" }, { status: 404 })
    }
    return NextResponse.json({ error: "rebuild_failed", message }, { status: 500 })
  }
}
