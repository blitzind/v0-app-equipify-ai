import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadBulkAcquisitionRun,
  listAcquisitionRunArtifacts,
} from "@/lib/growth/acquisition/acquisition-repository"
import { GROWTH_BULK_ACQUISITION_ARTIFACT_VIEWS } from "@/lib/growth/acquisition/acquisition-types"
import { bulkAcquisitionMeta } from "@/lib/growth/acquisition/bulk-acquisition-runner"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ runId: string }> }

const querySchema = z.object({
  view: z.enum(GROWTH_BULK_ACQUISITION_ARTIFACT_VIEWS),
  cursor_created_at: z.string().optional(),
  cursor_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const run = await loadBulkAcquisitionRun(access.admin, runId)
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    view: url.searchParams.get("view"),
    cursor_created_at: url.searchParams.get("cursor_created_at") ?? undefined,
    cursor_id: url.searchParams.get("cursor_id") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query", details: parsed.error.flatten() }, { status: 400 })
  }

  const cursor =
    parsed.data.cursor_created_at && parsed.data.cursor_id
      ? { created_at: parsed.data.cursor_created_at, id: parsed.data.cursor_id }
      : null

  const result = await listAcquisitionRunArtifacts(access.admin, {
    child_run_ids: run.state.child_run_ids,
    view: parsed.data.view,
    cursor,
    limit: parsed.data.limit,
  })

  return NextResponse.json({
    ok: true,
    meta: bulkAcquisitionMeta(),
    run_id: runId,
    ...result,
  })
}
