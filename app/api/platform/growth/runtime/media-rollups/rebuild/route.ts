import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { rebuildMediaAssetRollupsBatch } from "@/lib/growth/runtime-guardrails/growth-media-rollup-service"
import { GROWTH_RUNTIME_GUARDRAILS_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

export const runtime = "nodejs"

/** Admin-only batched rollup rebuild — 500 rows per request. */
export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as {
    organizationId?: string
    offset?: number
  }

  const result = await rebuildMediaAssetRollupsBatch(access.admin, {
    organizationId: body.organizationId,
    offset: body.offset,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_RUNTIME_GUARDRAILS_QA_MARKER,
    ...result,
  })
}
