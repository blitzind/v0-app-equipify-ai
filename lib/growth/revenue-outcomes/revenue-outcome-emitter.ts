/**
 * GE-AIOS-SDR-2C — Canonical revenue outcome publisher (server-only).
 * Reuses Event Bus + Learning Engine — no duplicate event system.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import { isRevenueOutcomeIntegrationEnabled } from "@/lib/growth/revenue-outcomes/revenue-outcome-feature"
import {
  buildRevenueOutcomePayload,
  GROWTH_REVENUE_OUTCOME_EVENT,
  GROWTH_REVENUE_OUTCOME_QA_MARKER,
  type RevenueOutcomeEmitInput,
} from "@/lib/growth/revenue-outcomes/revenue-outcome-types"

export { buildRevenueOutcomePayload }

export async function emitRevenueOutcomeEvent(
  admin: SupabaseClient,
  input: RevenueOutcomeEmitInput,
): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isRevenueOutcomeIntegrationEnabled()) return { ok: false, skipped: true }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) return { ok: false, skipped: true }

  const payload = buildRevenueOutcomePayload(input)
  const occurredAt = payload.timestamp

  await publishGrowthAiEvent(admin, {
    organizationId,
    eventType: GROWTH_REVENUE_OUTCOME_EVENT,
    category: "system",
    aiOsCategory: "learning",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.executionId,
    producer: "revenue_outcome_integration",
    payload: {
      ...payload,
      channel: payload.channel,
    },
    occurredAt,
  })

  return { ok: true }
}
