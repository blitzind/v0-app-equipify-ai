/** GE-AIOS-2G — Executive Brain schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER } from "@/lib/growth/aios/ai-executive-brain-types"

export const GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2g-executive-brain-schema-health-v1" as const

export const GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_executive_brain_runtime",
    columns: ["id", "organization_id", "instance_id", "runtime_status", "last_heartbeat_at", "created_at"],
    label: "Executive Brain runtime",
  },
  {
    table: "ai_executive_mission_state",
    columns: ["id", "organization_id", "mission_id", "executive_runtime_id", "mission_status", "created_at"],
    label: "Executive mission state",
  },
  {
    table: "ai_executive_delegations",
    columns: ["id", "organization_id", "mission_id", "work_order_id", "assigned_agent", "delegation_status"],
    label: "Executive delegations",
  },
  {
    table: "ai_executive_heartbeat_events",
    columns: ["id", "executive_runtime_id", "organization_id", "runtime_status", "created_at"],
    label: "Executive heartbeat events",
  },
  {
    table: "ai_executive_event_observations",
    columns: ["id", "executive_runtime_id", "organization_id", "event_type", "observed_at"],
    label: "Executive event observations",
  },
]

export async function probeGrowthAiExecutiveBrainSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-executive-brain",
    featureLabel: "GE-AIOS-2G Executive Brain",
    objects: [...GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiExecutiveBrainSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiExecutiveBrainSchema(admin)
  return health.ready
}

export function formatGrowthAiExecutiveBrainSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Executive Brain schema is incomplete — apply ${GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER} migration (missing: ${missing}).`
}
