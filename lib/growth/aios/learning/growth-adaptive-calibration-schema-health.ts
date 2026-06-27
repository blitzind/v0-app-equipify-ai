/** GE-AI-3D-PROD-2 — Adaptive calibration schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"

export const GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_HEALTH_QA_MARKER =
  "growth-ge-ai-3d-prod-2-adaptive-calibration-schema-health-v1" as const

export const GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "adaptive_calibration_proposals",
    columns: [
      "id",
      "organization_id",
      "source_insight_id",
      "target_system",
      "proposal_type",
      "status",
      "title",
      "proposed_change",
      "confidence",
      "sample_size",
      "risk_level",
      "idempotency_key",
      "created_at",
    ],
    label: "Adaptive calibration proposals",
  },
  {
    table: "adaptive_calibration_events",
    columns: ["id", "organization_id", "proposal_id", "event_type", "payload", "created_at"],
    label: "Adaptive calibration events",
  },
]

export async function probeGrowthAdaptiveCalibrationSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:adaptive-calibration",
    featureLabel: "GE-AI-3D-PROD-2 Adaptive Calibration",
    objects: [...GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_OBJECTS],
  })
}

export async function isGrowthAdaptiveCalibrationSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthAdaptiveCalibrationSchema(admin)
  return health.ready
}

export function formatGrowthAdaptiveCalibrationSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Adaptive calibration schema is incomplete — apply ${GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION} (missing: ${missing}, qa: ${GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER}).`
}
