/** GE-AIOS-2H — Decision Engine schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_DECISION_ENGINE_QA_MARKER } from "@/lib/growth/aios/ai-decision-engine-types"

export const GROWTH_AI_DECISION_ENGINE_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2h-decision-engine-schema-health-v1" as const

export const GROWTH_AI_DECISION_ENGINE_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_decision_engine_runtime",
    columns: ["id", "organization_id", "degraded", "evaluation_count", "last_evaluation_at"],
    label: "Decision Engine runtime",
  },
  {
    table: "ai_decision_engine_requests",
    columns: ["id", "organization_id", "work_order_id", "decision_key", "request_status", "decision_record_id"],
    label: "Decision Engine requests",
  },
]

export async function probeGrowthAiDecisionEngineSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-decision-engine",
    featureLabel: "GE-AIOS-2H Decision Engine",
    objects: [...GROWTH_AI_DECISION_ENGINE_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiDecisionEngineSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiDecisionEngineSchema(admin)
  return health.ready
}

export function formatGrowthAiDecisionEngineSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_DECISION_ENGINE_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Decision Engine schema is incomplete — apply ${GROWTH_AI_DECISION_ENGINE_QA_MARKER} migration (missing: ${missing}).`
}
