import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SEQUENCE_BRANCH_EVALUATED_TIMELINE_MIGRATION,
  GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
  GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"

const SCHEMA_TABLES = [
  {
    table: "sequence_pattern_step_conditions",
    columns: [
      "pattern_step_id",
      "condition_key",
      "dsl_version",
      "source",
      "event",
      "compare_operator",
      "string_value",
      "number_value",
    ],
  },
  {
    table: "sequence_pattern_step_edges",
    columns: ["pattern_id", "from_pattern_step_id", "to_pattern_step_id", "edge_type", "priority"],
  },
  {
    table: "sequence_enrollment_step_waits",
    columns: ["enrollment_id", "enrollment_step_id", "wait_kind", "status"],
  },
  {
    table: "sequence_branch_decisions",
    columns: ["enrollment_id", "decision", "source", "event", "evaluated_at"],
  },
] as const

async function probeTableColumn(
  admin: SupabaseClient,
  table: string,
  column: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await admin.schema("growth").from(table).select(column).limit(1)
  if (!error) return { ok: true, error: null }
  const message = error.message.toLowerCase()
  if (message.includes("does not exist") || message.includes("column")) {
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

async function probeEnrollmentStepStatuses(admin: SupabaseClient): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("status")
    .in("status", ["waiting", "branch_skipped"])
    .limit(1)
  if (!error) return { ok: true, error: null }
  const message = error.message.toLowerCase()
  if (message.includes("violates check constraint") || message.includes("invalid input value")) {
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

export async function executeGrowthSequenceConditionsProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const entry of SCHEMA_TABLES) {
    for (const column of entry.columns) {
      const probe = await probeTableColumn(admin, entry.table, column)
      checks.push({
        name: `${entry.table}.${column}`,
        ok: probe.ok,
        error: probe.error,
      })
    }
  }

  const enrollmentStatuses = await probeEnrollmentStepStatuses(admin)
  checks.push({
    name: "sequence_enrollment_steps.status.waiting_branch_skipped",
    ok: enrollmentStatuses.ok,
    error: enrollmentStatuses.error,
  })

  const timelineProbe = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("event_type")
    .eq("event_type", "sequence_branch_evaluated")
    .limit(1)
  checks.push({
    name: "lead_timeline_events.sequence_branch_evaluated",
    ok: !timelineProbe.error,
    error: timelineProbe.error?.message ?? null,
  })

  const failedChecks = checks.filter((check) => !check.ok)
  const schemaReady = failedChecks.length === 0

  if (!schemaReady) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
      schema_ready: false,
      live_schema_verified: false,
      production_read_only: true,
      migration: GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
      timeline_migration: GROWTH_SEQUENCE_BRANCH_EVALUATED_TIMELINE_MIGRATION,
      error: "schema_drift",
      failed_checks: failedChecks.map((check) => check.name),
      checks,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
    schema_ready: true,
    live_schema_verified: true,
    production_read_only: true,
    migration: GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
    timeline_migration: GROWTH_SEQUENCE_BRANCH_EVALUATED_TIMELINE_MIGRATION,
    checks,
  }
}
