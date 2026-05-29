import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadBulkAcquisitionRun } from "@/lib/growth/acquisition/acquisition-repository"
import { bulkAcquisitionMeta, tickBulkAcquisitionRun } from "@/lib/growth/acquisition/bulk-acquisition-runner"

export const runtime = "nodejs"
export const maxDuration = 120

type RouteContext = { params: Promise<{ runId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const run = await loadBulkAcquisitionRun(access.admin, runId)
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, meta: bulkAcquisitionMeta(), run })
}

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const tick = await tickBulkAcquisitionRun(access.admin, runId, { created_by: access.userId })
  if (!tick) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, meta: bulkAcquisitionMeta(), ...tick })
}
