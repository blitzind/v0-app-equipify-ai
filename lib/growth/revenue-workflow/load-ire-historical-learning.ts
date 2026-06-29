/**
 * GE-LAUNCH-1A — Load closed-loop learning for IRE decision inputs.
 * Server-only. Reuses existing closed_loop_learning_* store — no new learning engine.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listRecentClosedLoopLearningOutcomes,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-repository"
import {
  listStoredLearningOutcomes,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-service"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"
import {
  filterEmailLearningObservations,
  mapClosedLoopLearningOutcomesToEmailObservations,
  mergeHistoricalLearningObservations,
} from "@/lib/growth/revenue-workflow/growth-learning-ire-bridge"

function isInMemoryLearningStoreEnabled(): boolean {
  return process.env.GROWTH_LEARNING_IN_MEMORY_STORE === "1"
}

export async function loadIreHistoricalLearning(input: {
  admin?: SupabaseClient
  organizationId: string
  leadId?: string | null
  domain?: string | null
  email?: string | null
  limit?: number
}): Promise<EmailLearningObservation[]> {
  const outcomes = input.admin && !isInMemoryLearningStoreEnabled()
    ? await listRecentClosedLoopLearningOutcomes(input.admin, {
        organizationId: input.organizationId,
        limit: input.limit ?? 500,
      })
    : listStoredLearningOutcomes(input.organizationId)

  const observations = mapClosedLoopLearningOutcomesToEmailObservations(outcomes)
  const scoped = filterEmailLearningObservations({
    observations,
    organizationId: input.organizationId,
    leadId: input.leadId,
    domain: input.domain,
    email: input.email,
  })

  return mergeHistoricalLearningObservations(observations, scoped)
}
