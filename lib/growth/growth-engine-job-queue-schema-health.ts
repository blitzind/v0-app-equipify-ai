/**
 * Phase 7.PS-HE — Growth Engine PS-C job queue schema probes (runtime readiness).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  probeGrowthSchemaObjects,
  type GrowthSchemaObjectProbe,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"
import type { GrowthSchemaHealthSummary } from "@/lib/growth/schema-health/growth-schema-health-types"

export const GROWTH_ENGINE_JOB_QUEUE_SCHEMA_HEALTH_QA_MARKER =
  "growth-engine-job-queue-schema-health-7-ps-he-v1" as const

export const GROWTH_ENGINE_JOB_QUEUE_SCHEMA_OBJECTS: GrowthSchemaObjectProbe[] = [
  {
    table: "email_discovery_jobs",
    columns: ["id", "company_id", "person_id", "status"],
    label: "Email discovery jobs",
  },
  {
    table: "phone_discovery_jobs",
    columns: ["id", "company_id", "person_id", "status"],
    label: "Phone discovery jobs",
  },
  {
    table: "social_profile_discovery_jobs",
    columns: ["id", "company_id", "person_id", "status"],
    label: "Social profile discovery jobs",
  },
  {
    table: "company_intelligence_jobs",
    columns: ["id", "company_id", "status"],
    label: "Company intelligence jobs",
  },
  {
    table: "buying_committee_jobs",
    columns: ["id", "company_id", "status"],
    label: "Buying committee jobs",
  },
]

export async function probeGrowthEngineJobQueueSchema(
  admin: SupabaseClient,
): Promise<GrowthSchemaHealthSummary> {
  return probeGrowthSchemaObjects(admin, {
    cacheKey: "growth:engine-job-queues",
    featureLabel: "Growth Engine PS-C job queues",
    objects: [...GROWTH_ENGINE_JOB_QUEUE_SCHEMA_OBJECTS],
  })
}

export async function isGrowthEngineJobQueueSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const health = await probeGrowthEngineJobQueueSchema(admin)
  return health.ready
}

export function formatGrowthEngineJobQueueSchemaNotReadyMessage(
  health?: GrowthSchemaHealthSummary | null,
): string {
  const missing =
    health?.missing_objects?.map((row) => row.table).filter(Boolean).join(", ") ||
    GROWTH_ENGINE_JOB_QUEUE_SCHEMA_OBJECTS.map((row) => row.table).join(", ")
  return `Growth Engine job queue schema is incomplete — apply PS-C job migrations (missing: ${missing}).`
}
