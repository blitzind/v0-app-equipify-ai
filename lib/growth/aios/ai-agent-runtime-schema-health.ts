/** GE-AIOS-2C — AI Agent Runtime schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_AGENT_RUNTIME_QA_MARKER } from "@/lib/growth/aios/ai-agent-runtime-types"

export const GROWTH_AI_AGENT_RUNTIME_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2c-ai-agent-runtime-schema-health-v1" as const

export const GROWTH_AI_AGENT_RUNTIME_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_os_agent_registrations",
    columns: ["id", "organization_id", "agent_key", "instance_id", "runtime_status", "last_heartbeat_at"],
    label: "AI OS agent registrations",
  },
  {
    table: "ai_os_agent_capabilities",
    columns: ["id", "organization_id", "agent_key", "work_order_type", "enabled"],
    label: "AI OS agent capabilities",
  },
  {
    table: "ai_os_agent_leases",
    columns: ["id", "organization_id", "work_order_id", "agent_registration_id", "status", "expires_at"],
    label: "AI OS agent leases",
  },
  {
    table: "ai_os_agent_heartbeat_events",
    columns: ["id", "agent_registration_id", "organization_id", "created_at"],
    label: "AI OS agent heartbeat events",
  },
]

export async function probeGrowthAiAgentRuntimeSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-agent-runtime",
    featureLabel: "GE-AIOS-2C AI Agent Runtime",
    objects: [...GROWTH_AI_AGENT_RUNTIME_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiAgentRuntimeSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiAgentRuntimeSchema(admin)
  return health.ready
}

export function formatGrowthAiAgentRuntimeSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_AGENT_RUNTIME_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `AI Agent Runtime schema is incomplete — apply ${GROWTH_AI_AGENT_RUNTIME_QA_MARKER} migration (missing: ${missing}).`
}
