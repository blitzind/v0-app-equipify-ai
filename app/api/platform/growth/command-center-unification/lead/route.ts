import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCommandCenterLeadWorkspace } from "@/lib/growth/command-center-unification/command-center-unification-service"

export const runtime = "nodejs"
export const maxDuration = 180

const QuerySchema = z.object({
  lead_id: z.string().min(1).max(120),
  pattern_id: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const workspace = await fetchGrowthCommandCenterLeadWorkspace(access.admin, {
      lead_id: parsed.data.lead_id,
      pattern_id: parsed.data.pattern_id,
      limit: parsed.data.limit,
      persist_audit: false,
    })
    return NextResponse.json({
      ok: true,
      workspace,
      outreach_execution: false,
      enrollment_execution: false,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "command_center_lead_workspace_failed", message }, { status: 500 })
  }
}
