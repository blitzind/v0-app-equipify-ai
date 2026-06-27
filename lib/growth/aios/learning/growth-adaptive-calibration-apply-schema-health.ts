/** GE-AI-3D-PROD-3 — Calibration apply schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  GROWTH_CALIBRATION_APPLY_QA_MARKER,
  GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

export const GROWTH_CALIBRATION_APPLY_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "calibration_config_versions",
    columns: [
      "id",
      "organization_id",
      "proposal_id",
      "target_system",
      "version_number",
      "rollback_token",
      "config_snapshot_before",
      "config_snapshot_after",
      "idempotency_key",
      "created_at",
    ],
    label: "Calibration config versions",
  },
  {
    table: "calibration_active_config",
    columns: ["id", "organization_id", "target_system", "config", "active_version_id", "updated_at"],
    label: "Calibration active config",
  },
  {
    table: "calibration_config_events",
    columns: ["id", "organization_id", "version_id", "event_type", "payload", "created_at"],
    label: "Calibration config events",
  },
]

export async function probeGrowthCalibrationApplySchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:calibration-apply",
    featureLabel: "GE-AI-3D-PROD-3 Calibration Apply",
    objects: [...GROWTH_CALIBRATION_APPLY_SCHEMA_OBJECTS],
  })
}

export async function isGrowthCalibrationApplySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthCalibrationApplySchema(admin)
  return health.ready
}

export function formatGrowthCalibrationApplySchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_CALIBRATION_APPLY_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Calibration apply schema is incomplete — apply ${GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION} (missing: ${missing}, qa: ${GROWTH_CALIBRATION_APPLY_QA_MARKER}).`
}
