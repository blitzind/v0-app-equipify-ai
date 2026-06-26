/** GE-AIOS-2D — Decision Record schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import { GROWTH_AI_DECISION_RECORD_QA_MARKER } from "@/lib/growth/aios/ai-decision-record-types"

export const GROWTH_AI_DECISION_RECORD_SCHEMA_HEALTH_QA_MARKER =
  "growth-aios-2d-decision-record-schema-health-v1" as const

export const GROWTH_AI_DECISION_RECORD_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "ai_decision_records",
    columns: [
      "id",
      "organization_id",
      "mission_id",
      "decision_key",
      "owner_agent",
      "confidence",
      "risk_score",
      "evidence_bundle",
      "created_at",
    ],
    label: "AI Decision Records",
  },
  {
    table: "ai_decision_record_audit_events",
    columns: ["id", "decision_record_id", "organization_id", "event_type", "created_at"],
    label: "AI Decision Record audit events",
  },
]

export async function probeGrowthAiDecisionRecordSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:ai-decision-records",
    featureLabel: "GE-AIOS-2D Decision Records",
    objects: [...GROWTH_AI_DECISION_RECORD_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAiDecisionRecordSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAiDecisionRecordSchema(admin)
  return health.ready
}

export function formatGrowthAiDecisionRecordSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_AI_DECISION_RECORD_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Decision Record schema is incomplete — apply ${GROWTH_AI_DECISION_RECORD_QA_MARKER} migration (missing: ${missing}).`
}
