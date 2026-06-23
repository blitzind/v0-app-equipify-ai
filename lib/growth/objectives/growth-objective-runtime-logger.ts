/** GE-AUTO-2A — Objective runtime audit logging (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
  type GrowthObjectiveExecutionHistoryEntry,
} from "@/lib/growth/objectives/growth-objective-types"

export async function logGrowthObjectiveRuntimeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objectiveId: string
    entry: GrowthObjectiveExecutionHistoryEntry
  },
): Promise<void> {
  console.log(
    JSON.stringify({
      source: "growth-engine",
      event: "objective_runtime_event",
      qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
      organizationId: input.organizationId,
      objectiveId: input.objectiveId,
      ...input.entry,
    }),
  )

  try {
    await admin.schema("growth").from("runtime_guardrail_audit_log").insert({
      organization_id: input.organizationId,
      event_type: "objective_runtime_event",
      resource_type: "growth_objective",
      resource_id: input.objectiveId,
      metadata: {
        qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
        entry: input.entry,
      },
    })
  } catch {
    // Audit table may be unavailable in dev — runtime history is persisted on objective row.
  }
}
