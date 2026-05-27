import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  discoveryEngineSnapshotMeta,
  listRecentDiscoveryRuns,
  runContinuousDiscoverySegment,
} from "@/lib/growth/discovery-engine/discovery-repository"
import { isGrowthDiscoveryEngineSchemaReady, GROWTH_DISCOVERY_ENGINE_SCHEMA_SETUP_MESSAGE } from "@/lib/growth/discovery-engine/discovery-engine-schema-health"
import { GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS } from "@/lib/growth/discovery-engine/discovery-segments"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthDiscoveryEngineSchemaReady(access.admin)
  const url = new URL(request.url)
  const segmentKey = url.searchParams.get("segment_key")

  if (!schemaReady) {
    return NextResponse.json({
      ok: true,
      meta: { schemaReady: false, setupMessage: GROWTH_DISCOVERY_ENGINE_SCHEMA_SETUP_MESSAGE },
      ...discoveryEngineSnapshotMeta(),
      runs: [],
    })
  }

  if (segmentKey) {
    const segment = GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS.find((entry) => entry.key === segmentKey)
    if (!segment) {
      return NextResponse.json({ error: "invalid_segment" }, { status: 400 })
    }
    const result = await runContinuousDiscoverySegment(access.admin, segment)
    return NextResponse.json({ ok: true, ...discoveryEngineSnapshotMeta(), ...result })
  }

  const runs = await listRecentDiscoveryRuns(access.admin)
  return NextResponse.json({ ok: true, ...discoveryEngineSnapshotMeta(), runs })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response
  if (!(await isGrowthDiscoveryEngineSchemaReady(access.admin))) {
    return NextResponse.json({ ok: false, message: GROWTH_DISCOVERY_ENGINE_SCHEMA_SETUP_MESSAGE })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const segmentKey = typeof body.segment_key === "string" ? body.segment_key : ""
  const segment = GROWTH_CONTINUOUS_DISCOVERY_SEGMENTS.find((entry) => entry.key === segmentKey)
  if (!segment || !z.string().min(1).safeParse(segmentKey).success) {
    return NextResponse.json({ error: "invalid_segment" }, { status: 400 })
  }

  const result = await runContinuousDiscoverySegment(access.admin, segment)
  return NextResponse.json({ ok: true, ...result })
}
