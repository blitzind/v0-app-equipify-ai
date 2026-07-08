import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
  GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { GrowthAvaResearchQueueApiResponse } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-api-contract"
import { runAvaResearchQueueOrchestrator } from "@/lib/growth/ava-home/growth-ava-research-orchestrator-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"

const BodySchema = z
  .object({
    maxLeads: z.number().int().min(1).max(GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS).optional(),
  })
  .optional()

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "Growth AI organization is not configured." },
      { status: 503, headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL } },
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "invalid_request" },
      { status: 400, headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL } },
    )
  }

  try {
    const result = await runAvaResearchQueueOrchestrator(access.admin, {
      organizationId,
      actorUserId: access.userId,
      maxLeads: parsed.data?.maxLeads,
    })

    logGrowthEngine("ava_research_queue_api", {
      organizationId,
      ok: result.ok,
      blocked: result.blocked ?? false,
      companiesReviewed: result.summary?.companiesReviewed ?? 0,
      actorEmail: access.userEmail,
    })

    const body: GrowthAvaResearchQueueApiResponse = {
      ...result,
      message: result.blocked ? result.blockReason ?? "blocked" : null,
    }

    return NextResponse.json(body, {
      status: result.ok ? 200 : result.blocked ? 403 : 500,
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "orchestrator_failed"
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AVA_RESEARCH_ORCHESTRATOR_QA_MARKER,
        summary: null,
        message,
        transportBlocked: true,
        humanApprovalRequired: true,
        outboundOccurred: false,
      } satisfies GrowthAvaResearchQueueApiResponse,
      { status: 500, headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL } },
    )
  }
}
