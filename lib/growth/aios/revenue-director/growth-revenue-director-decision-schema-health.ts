/** GE-AI-3B — Revenue Director decision ledger schema health probe. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_MIGRATION,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"

export const GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_HEALTH_QA_MARKER =
  "growth-ge-ai-3b-revenue-director-decision-ledger-schema-health-v1" as const

export const GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "revenue_director_decisions",
    columns: [
      "id",
      "organization_id",
      "snapshot_hash",
      "decision_type",
      "status",
      "title",
      "summary",
      "confidence",
      "priority_score",
      "evidence",
      "risks",
    ],
    label: "Revenue Director decisions",
  },
  {
    table: "revenue_director_workflow_requests",
    columns: [
      "id",
      "organization_id",
      "decision_id",
      "request_type",
      "target_workflow_agent",
      "status",
      "idempotency_key",
      "correlation_id",
      "evidence",
      "route",
    ],
    label: "Revenue Director workflow requests",
  },
  {
    table: "revenue_director_decision_events",
    columns: ["id", "organization_id", "decision_id", "workflow_request_id", "event_type", "created_at"],
    label: "Revenue Director decision events",
  },
]

export async function probeGrowthRevenueDirectorDecisionLedgerSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:revenue-director-decision-ledger",
    featureLabel: "GE-AI-3B Revenue Director Decision Ledger",
    objects: [...GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_OBJECTS],
  })
}

export async function isGrowthRevenueDirectorDecisionLedgerSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const health = await probeGrowthRevenueDirectorDecisionLedgerSchema(admin)
  return health.ready
}

export function formatGrowthRevenueDirectorDecisionLedgerSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Revenue Director decision ledger schema is incomplete — apply ${GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_SCHEMA_MIGRATION} (missing: ${missing}, qa: ${GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER}).`
}
