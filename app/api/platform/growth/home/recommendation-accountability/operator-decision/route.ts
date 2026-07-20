import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { growthHomeNoStoreJson } from "@/lib/growth/home/growth-home-no-store-response"
import { persistGrowthHomeAvaOperatorDecisionMemoryEvent } from "@/lib/growth/ava-home/recommendations/growth-home-ava-operator-decision-memory-server-next-3d"
import {
  GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_TYPES,
  GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"
import { GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const OperatorDecisionSchema = z.object({
  decisionType: z.enum(GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_TYPES),
  recommendationTopic: z.string().trim().max(120).optional().nullable(),
  recommendationKind: z.string().trim().max(80).optional().nullable(),
  recommendationId: z.string().trim().max(120).optional().nullable(),
  entityId: z.string().trim().max(120).optional().nullable(),
  summary: z.string().trim().max(500).optional().nullable(),
})

/** GE-AIOS-NEXT-3D — Durable operator decision mirror into organization_memory_events. */
export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = OperatorDecisionSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER,
        error: "invalid_body",
      },
      { status: 400 },
    )
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER,
        error: "organization_required",
      },
      { status: 400 },
    )
  }

  const result = await persistGrowthHomeAvaOperatorDecisionMemoryEvent(access.admin, {
    organizationId,
    decisionType: parsed.data.decisionType,
    recommendationTopic: parsed.data.recommendationTopic,
    recommendationKind: parsed.data.recommendationKind as
      | import("@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types").GrowthHomeAvaRecommendationKind
      | null
      | undefined,
    recommendationId: parsed.data.recommendationId,
    entityId: parsed.data.entityId,
    summary: parsed.data.summary,
  })

  return growthHomeNoStoreJson({
    ok: true,
    qaMarker: GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER,
    recommendationQaMarker: GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER,
    inserted: result.inserted,
    skipped: result.skipped,
    persistedEventIds: result.persistedEventIds,
  })
}
