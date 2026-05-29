import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadBulkAcquisitionRun,
  setBulkAcquisitionRunPaused,
} from "@/lib/growth/acquisition/acquisition-repository"
import { bulkAcquisitionMeta } from "@/lib/growth/acquisition/bulk-acquisition-runner"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ runId: string }> }

const patchBodySchema = z.object({
  paused: z.boolean(),
})

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

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const run = await setBulkAcquisitionRunPaused(access.admin, runId, parsed.data.paused)
  if (!run) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, meta: bulkAcquisitionMeta(), run })
}
