/** GE-AIOS-NEXT-3D — Persist operator decisions to organizational memory (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AvaMemoryEvent } from "@/lib/growth/memory/types"
import { upsertOrganizationMemoryEvents } from "@/lib/growth/memory/storage/organization-memory-repository"
import type { OrganizationMemoryPersistResult } from "@/lib/growth/memory/storage/organization-memory-types"
import {
  buildGrowthHomeAvaOperatorDecisionMemoryEvent,
  summarizeGrowthHomeAvaOperatorDecision,
} from "./growth-home-ava-operator-decision-memory-next-3d"
import type { GrowthHomeAvaOperatorDecisionType } from "./growth-home-ava-recommendation-accountability-next-3d-types"
import type { GrowthHomeAvaRecommendationKind } from "./growth-home-ava-recommendation-next-1a-types"

export const GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_PERSIST_QA_MARKER =
  "ge-aios-next-3d-operator-decision-memory-persist-v1" as const

export async function persistGrowthHomeAvaOperatorDecisionMemoryEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    decisionType: GrowthHomeAvaOperatorDecisionType
    recommendationTopic?: string | null
    recommendationKind?: GrowthHomeAvaRecommendationKind | null
    recommendationId?: string | null
    entityId?: string | null
    summary?: string | null
    occurredAt?: string
  },
): Promise<OrganizationMemoryPersistResult & { qaMarker: typeof GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_PERSIST_QA_MARKER; event: AvaMemoryEvent }> {
  const event = buildGrowthHomeAvaOperatorDecisionMemoryEvent({
    organizationId: input.organizationId,
    decisionType: input.decisionType,
    recommendationTopic: input.recommendationTopic,
    recommendationKind: input.recommendationKind,
    recommendationId: input.recommendationId,
    entityId: input.entityId,
    occurredAt: input.occurredAt,
    summary:
      input.summary?.trim() ||
      summarizeGrowthHomeAvaOperatorDecision({
        decisionType: input.decisionType,
        recommendationTopic: input.recommendationTopic,
        recommendationKind: input.recommendationKind,
      }),
  })

  const result = await upsertOrganizationMemoryEvents(admin, {
    organizationId: input.organizationId,
    events: [event],
  })

  return {
    ...result,
    qaMarker: GROWTH_AIOS_NEXT_3D_OPERATOR_DECISION_PERSIST_QA_MARKER,
    event,
  }
}
