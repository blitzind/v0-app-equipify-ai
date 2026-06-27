/** GE-AI-3D-PROD-1 — Closed-loop learning schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER,
  GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

export const GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_HEALTH_QA_MARKER =
  "growth-ge-ai-3d-prod-1-durable-closed-loop-learning-schema-health-v1" as const

export const GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "closed_loop_learning_outcomes",
    columns: [
      "id",
      "organization_id",
      "source",
      "outcome_type",
      "subject_type",
      "subject_id",
      "related",
      "signal_strength",
      "confidence",
      "dimensions",
      "evidence",
      "occurred_at",
      "idempotency_key",
      "created_at",
    ],
    label: "Closed-loop learning outcomes",
  },
  {
    table: "closed_loop_learning_insights",
    columns: [
      "id",
      "organization_id",
      "insight_type",
      "title",
      "summary",
      "recommended_adjustment",
      "target_system",
      "confidence",
      "impact",
      "sample_size",
      "evidence",
      "status",
      "generated_from_window",
      "idempotency_key",
      "created_at",
      "superseded_at",
    ],
    label: "Closed-loop learning insights",
  },
  {
    table: "closed_loop_learning_events",
    columns: ["id", "organization_id", "outcome_id", "insight_id", "event_type", "payload", "created_at"],
    label: "Closed-loop learning events",
  },
]

export async function probeGrowthClosedLoopLearningSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:closed-loop-learning",
    featureLabel: "GE-AI-3D-PROD-1 Durable Closed-Loop Learning Store",
    objects: [...GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_OBJECTS],
  })
}

export async function isGrowthClosedLoopLearningSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthClosedLoopLearningSchema(admin)
  return health.ready
}

export function formatGrowthClosedLoopLearningSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Closed-loop learning schema is incomplete — apply ${GROWTH_CLOSED_LOOP_LEARNING_SCHEMA_MIGRATION} (missing: ${missing}, qa: ${GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER}).`
}
