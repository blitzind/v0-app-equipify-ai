/** GE-AI-2I-PROD-1 — Autonomous outbound scope schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

export const GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_HEALTH_QA_MARKER =
  "growth-ge-ai-2i-prod-1-autonomous-outbound-scope-schema-health-v1" as const

export const GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "autonomous_outbound_scopes",
    columns: [
      "id",
      "organization_id",
      "source",
      "source_id",
      "status",
      "approved_by_user_id",
      "expires_at",
      "allowed_channels",
      "audience",
      "limits",
    ],
    label: "Autonomous outbound scopes",
  },
  {
    table: "autonomous_outbound_scope_actions",
    columns: [
      "id",
      "organization_id",
      "scope_id",
      "lead_id",
      "channel",
      "action_type",
      "status",
      "idempotency_key",
    ],
    label: "Autonomous outbound scope actions",
  },
  {
    table: "autonomous_outbound_scope_events",
    columns: ["id", "organization_id", "scope_id", "event_type", "created_at"],
    label: "Autonomous outbound scope events",
  },
]

export async function probeGrowthAutonomousOutboundScopeSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:autonomous-outbound-scopes",
    featureLabel: "GE-AI-2I-PROD-1 Autonomous Outbound Scopes",
    objects: [...GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAutonomousOutboundScopeSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const health = await probeGrowthAutonomousOutboundScopeSchema(admin)
  return health.ready
}

export function formatGrowthAutonomousOutboundScopeSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Autonomous outbound scope schema is incomplete — apply ${GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION} (missing: ${missing}, qa: ${GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER}).`
}
