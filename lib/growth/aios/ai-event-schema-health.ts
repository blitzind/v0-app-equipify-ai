/** GE-AIOS-2B — AI OS Event schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_EVENT_QA_MARKER } from "@/lib/growth/aios/ai-event-types"

export const GROWTH_AI_EVENT_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2b-ai-event-schema-health-v1" as const

export const GROWTH_AI_EVENT_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_os_events",
    columns: [
      "id",
      "event_type",
      "category",
      "organization_id",
      "correlation_id",
      "producer",
      "source",
      "occurred_at",
    ],
    label: "AI OS events",
  },
  {
    table: "ai_os_event_subscriptions",
    columns: ["id", "organization_id", "subscriber_id", "enabled"],
    label: "AI OS event subscriptions",
  },
  {
    table: "ai_os_event_deliveries",
    columns: ["id", "event_id", "subscriber_id", "status"],
    label: "AI OS event deliveries",
  },
  {
    table: "ai_os_event_archive_records",
    columns: ["id", "event_id", "archived_at"],
    label: "AI OS event archive records",
  },
]

export async function probeGrowthAiEventSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-os-events",
    featureLabel: "GE-AIOS-2B AI OS Events",
    objects: [...GROWTH_AI_EVENT_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiEventSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiEventSchema(admin)
  return health.ready
}

export function formatGrowthAiEventSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_EVENT_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `AI OS Event schema is incomplete — apply ${GROWTH_AI_EVENT_QA_MARKER} migration (missing: ${missing}).`
}
