import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCommandCenterUnification } from "@/lib/growth/command-center-unification/command-center-unification-service"
import { COMMAND_CENTER_UNIFICATION_FILTERS } from "@/lib/growth/command-center-unification/command-center-unification-types"

export const runtime = "nodejs"
export const maxDuration = 180

const QuerySchema = z.object({
  lead_id: z.string().max(120).optional(),
  pattern_id: z.string().max(120).optional(),
  filter: z.enum(COMMAND_CENTER_UNIFICATION_FILTERS).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
  include_campaign_readiness: z.coerce.boolean().optional(),
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
    const workspace = await fetchGrowthCommandCenterUnification(access.admin, {
      ...parsed.data,
      persist_audit: false,
    })
    return NextResponse.json({
      ok: true,
      ...workspace,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "command_center_unification_failed", message }, { status: 500 })
  }
}
