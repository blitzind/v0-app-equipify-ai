/** GE-AIOS-2A — AI Work Order schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_WORK_ORDER_QA_MARKER } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AI_WORK_ORDER_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2a-ai-work-order-schema-health-v1" as const

export const GROWTH_AI_WORK_ORDER_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_work_orders",
    columns: [
      "id",
      "organization_id",
      "mission_id",
      "owner_agent",
      "assigned_agent",
      "work_order_type",
      "priority",
      "status",
      "decision_record_ids",
      "memory_refs",
      "depends_on",
      "retry_count",
      "max_retries",
      "issued_at",
    ],
    label: "AI Work Orders",
  },
  {
    table: "ai_work_order_events",
    columns: ["id", "work_order_id", "organization_id", "event_type", "created_at"],
    label: "AI Work Order events",
  },
]

export async function probeGrowthAiWorkOrderSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-work-orders",
    featureLabel: "GE-AIOS-2A AI Work Orders",
    objects: [...GROWTH_AI_WORK_ORDER_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiWorkOrderSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiWorkOrderSchema(admin)
  return health.ready
}

export function formatGrowthAiWorkOrderSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_WORK_ORDER_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `AI Work Order schema is incomplete — apply ${GROWTH_AI_WORK_ORDER_QA_MARKER} migration (missing: ${missing}).`
}
