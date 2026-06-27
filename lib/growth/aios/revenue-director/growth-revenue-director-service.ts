/** GE-AI-3A — Revenue Director read service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import {
  extractGrowthRevenueDirectorSnapshot,
  synthesizeGrowthRevenueDirectorReadModel,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-engine"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_REVENUE_DIRECTOR_EVENT_TYPES } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import { getGrowthAiEventBusSubscriberObservation } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-engine"

export function buildGrowthRevenueDirectorReadModel(input: {
  organizationId: string
  commandCenter: Omit<AiOsCommandCenterReadModel, "revenueDirector" | "revenueDirectorDecisionLedger">
}): GrowthRevenueDirectorReadModel {
  const snapshot = extractGrowthRevenueDirectorSnapshot(input.commandCenter)
  const observation = getGrowthAiEventBusSubscriberObservation("revenue_director_observer")

  return synthesizeGrowthRevenueDirectorReadModel({
    organizationId: input.organizationId,
    snapshot,
    eventObservation: observation
      ? {
          eventsReceived: observation.eventsReceived,
          lastEventType: observation.lastEventType,
        }
      : undefined,
  })
}

export async function publishRevenueDirectorSnapshotGeneratedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    revenueDirector: GrowthRevenueDirectorReadModel
    generatedAt: string
  },
): Promise<void> {
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_REVENUE_DIRECTOR_EVENT_TYPES.snapshotGenerated,
      category: "executive",
      source: "growth_revenue_director",
      producer: "growth_revenue_director_service",
      subjectType: "system",
      subjectId: input.organizationId,
      payload: {
        revenueHealth: input.revenueDirector.executiveSummary.revenueHealth,
        workflowRequestCount: input.revenueDirector.workflowRequests.length,
        topWorkflowRequest: input.revenueDirector.workflowRequests[0]?.requestType ?? null,
        readOnly: true,
        advisoryOnly: true,
      },
      metadata: {
        qaMarker: "growth-ge-ai-3a-revenue-director-v1",
        nonMutating: true,
      },
      occurredAt: input.generatedAt,
    })
  } catch {
    // Snapshot event publish must not block read model.
  }
}
