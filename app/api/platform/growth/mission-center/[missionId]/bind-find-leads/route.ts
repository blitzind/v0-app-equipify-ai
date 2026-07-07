import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
import { bindFindLeadsSearchToMission } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const filterSchema = z.object({
  field: z.string().trim().min(1),
  operator: z.string().trim().min(1),
  value: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  value_to: z.string().nullable().optional(),
})

const bindBodySchema = z.object({
  datamoonRequest: z.object({
    run_name: z.string().trim().min(1),
    audience_type: z.enum(["advanced_search", "b2b", "b2c"]),
    filters: z.array(filterSchema).default([]),
    topic_ids: z.array(z.string().trim().min(1)).optional(),
    limit: z.number().int().min(1).max(1_000_000).optional(),
    name: z.string().trim().optional(),
    website_id: z.string().trim().optional(),
    provider_mode: z.enum(["ext", "module"]).optional(),
  }),
  searchSummary: z.string().trim().min(1),
  source: z.literal("find_leads"),
  approvedByUser: z.boolean(),
  keepMonitoring: z.boolean().optional(),
  lastRunId: z.string().trim().min(1).nullable().optional(),
  refreshCadence: z.enum(["daily", "weekly"]).optional(),
})

type RouteContext = { params: Promise<{ missionId: string }> }

/** GE-AVA-MISSION-RUNTIME-1B — Persist approved Find Leads search on mission (no Datamoon/import/outbound). */
export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER, error: "organization_not_configured" },
      { status: 503 },
    )
  }

  const { missionId } = await context.params
  if (!missionId?.trim()) {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER, error: "mission_id_required" },
      { status: 400 },
    )
  }

  let body: z.infer<typeof bindBodySchema>
  try {
    body = bindBodySchema.parse(await request.json())
  } catch {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER, error: "invalid_request" },
      { status: 400 },
    )
  }

  const result = await bindFindLeadsSearchToMission(access.admin, {
    organizationId,
    missionId: missionId.trim(),
    datamoonRequest: body.datamoonRequest,
    searchSummary: body.searchSummary,
    source: body.source,
    approvedByUser: body.approvedByUser,
    keepMonitoring: body.keepMonitoring,
    lastRunId: body.lastRunId,
    refreshCadence: body.refreshCadence,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER, error: result.error },
      { status: result.status },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER,
    binding: result.binding,
  })
}
