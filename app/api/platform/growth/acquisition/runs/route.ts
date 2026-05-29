import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  isGrowthBulkAcquisitionSchemaReady,
  listBulkAcquisitionRuns,
} from "@/lib/growth/acquisition/acquisition-repository"
import {
  bulkAcquisitionMeta,
  startBulkAcquisitionRun,
  tickBulkAcquisitionRun,
} from "@/lib/growth/acquisition/bulk-acquisition-runner"
import {
  buildRealWorldDiscoveryQuery,
  prospectSearchFiltersToRealWorldInputs,
} from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

export const runtime = "nodejs"
export const maxDuration = 120

const filtersSchema = z
  .object({
    industry: z.string().optional().nullable(),
    subindustry: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    service_area: z.string().optional().nullable(),
    keywords: z.array(z.string()).optional(),
    field_service_software: z.string().optional().nullable(),
    crm_detected: z.string().optional().nullable(),
    search_intent_categories: z.array(z.string()).optional(),
    technologies: z.array(z.string()).optional(),
    website_platform: z.string().optional().nullable(),
    decision_maker_role: z.string().optional().nullable(),
    title_contains: z.string().optional().nullable(),
  })
  .optional()

const startBodySchema = z.object({
  raw_query: z.string().trim().optional(),
  filters: filtersSchema,
  limit_per_query: z.number().int().min(10).max(100).optional(),
  auto_tick: z.boolean().optional(),
  tick_count: z.number().int().min(1).max(20).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthBulkAcquisitionSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { ...bulkAcquisitionMeta(), schemaReady: false },
      runs: [],
    })
  }

  const runs = await listBulkAcquisitionRuns(access.admin)
  return NextResponse.json({
    ok: true,
    meta: { ...bulkAcquisitionMeta(), schemaReady: true },
    runs,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthBulkAcquisitionSchemaReady(access.admin))) {
    return NextResponse.json(
      { ok: false, error: "schema_not_ready", message: "Real-world discovery schema is not ready." },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = startBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 })
  }

  const filters = parsed.data.filters ?? {}
  const rawQuery = parsed.data.raw_query?.trim() || buildRealWorldDiscoveryQuery(
    prospectSearchFiltersToRealWorldInputs(filters, parsed.data.raw_query ?? ""),
  )
  const searchInputs = prospectSearchFiltersToRealWorldInputs(filters, rawQuery)

  const run = await startBulkAcquisitionRun(access.admin, {
    search_inputs: searchInputs,
    created_by: access.userId,
    limit_per_query: parsed.data.limit_per_query,
  })

  if (!run) {
    return NextResponse.json({ error: "run_create_failed" }, { status: 500 })
  }

  const ticks: Awaited<ReturnType<typeof tickBulkAcquisitionRun>>[] = []
  if (parsed.data.auto_tick) {
    const tickCount = parsed.data.tick_count ?? 1
    for (let i = 0; i < tickCount; i++) {
      const tick = await tickBulkAcquisitionRun(access.admin, run.id, { created_by: access.userId })
      if (!tick) break
      ticks.push(tick)
      if (tick.done) break
    }
  }

  return NextResponse.json({
    ok: true,
    meta: bulkAcquisitionMeta(),
    run: ticks.length > 0 ? ticks[ticks.length - 1]!.run : run,
    ticks,
  })
}
