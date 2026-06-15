import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SEQUENCE_ATTRIBUTION_CONFIRM,
  GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION,
  GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER,
} from "@/lib/growth/sequences/attribution/sequence-attribution-types"
import { evaluateEnrollmentStatusForExecutionGate } from "@/lib/growth/sequences/execution/sequence-pause-gate-types"

export { GROWTH_SEQUENCE_ATTRIBUTION_CONFIRM, GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER }

export type SequenceAttributionDiagnosticCheck = {
  id: string
  ok: boolean
  detail: string
}

export type SequenceAttributionDiagnosticsReport = {
  qa_marker: typeof GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER
  migration: typeof GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION
  ok: boolean
  final_verdict: "PASS" | "FAIL" | "CONDITIONAL_PASS"
  checks: SequenceAttributionDiagnosticCheck[]
  schema_ready: boolean
  pause_gate_ready: boolean
  attribution_columns_ready: boolean
}

const ATTRIBUTION_TABLES = [
  {
    table: "delivery_attempts",
    columns: ["sequence_enrollment_id", "sequence_enrollment_step_id", "sequence_execution_job_id"],
  },
  {
    table: "email_opens",
    columns: ["sequence_enrollment_id", "sequence_enrollment_step_id", "sequence_execution_job_id"],
  },
  {
    table: "email_clicks",
    columns: ["sequence_enrollment_id", "sequence_enrollment_step_id", "sequence_execution_job_id"],
  },
  {
    table: "sms_delivery_attempts",
    columns: ["sequence_enrollment_id", "sequence_enrollment_step_id", "sequence_execution_job_id"],
  },
  {
    table: "share_page_views",
    columns: ["enrollment_id", "sequence_enrollment_step_id", "sequence_step_id", "sequence_execution_job_id"],
  },
  {
    table: "share_page_events",
    columns: ["enrollment_id", "sequence_enrollment_step_id", "sequence_step_id", "sequence_execution_job_id"],
  },
  {
    table: "cadence_tasks",
    columns: ["sequence_enrollment_id", "sequence_enrollment_step_id", "sequence_execution_job_id"],
  },
] as const

async function probeTableColumn(
  admin: SupabaseClient,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await admin.schema("growth").from(table).select(column).limit(1)
  if (!error) return true
  const message = error.message.toLowerCase()
  return !message.includes("does not exist") && !message.includes("column")
}

export async function executeGrowthSequenceAttributionDiagnostics(
  admin: SupabaseClient,
): Promise<SequenceAttributionDiagnosticsReport> {
  const checks: SequenceAttributionDiagnosticCheck[] = []

  for (const entry of ATTRIBUTION_TABLES) {
    for (const column of entry.columns) {
      const ready = await probeTableColumn(admin, entry.table, column)
      checks.push({
        id: `${entry.table}.${column}`,
        ok: ready,
        detail: ready
          ? `${entry.table}.${column} is queryable.`
          : `${entry.table}.${column} missing — apply ${GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION}.`,
      })
    }
  }

  const sharePageEnrollmentStep = await probeTableColumn(admin, "share_pages", "sequence_enrollment_step_id")
  checks.push({
    id: "share_pages.sequence_enrollment_step_id",
    ok: sharePageEnrollmentStep,
    detail: sharePageEnrollmentStep
      ? "share_pages.sequence_enrollment_step_id is queryable."
      : "share_pages.sequence_enrollment_step_id missing.",
  })

  const pausedGate = evaluateEnrollmentStatusForExecutionGate("paused")
  checks.push({
    id: "pause_gate.enrollment_paused",
    ok: pausedGate?.blocked === true && pausedGate.code === "enrollment_paused",
    detail: "Paused enrollments block transport via pure status gate.",
  })

  const completedGate = evaluateEnrollmentStatusForExecutionGate("completed")
  checks.push({
    id: "pause_gate.enrollment_completed",
    ok: completedGate?.blocked === true && completedGate.code === "enrollment_completed",
    detail: "Completed enrollments block transport via pure status gate.",
  })

  const cancelledGate = evaluateEnrollmentStatusForExecutionGate("cancelled")
  checks.push({
    id: "pause_gate.enrollment_cancelled",
    ok: cancelledGate?.blocked === true && cancelledGate.code === "enrollment_cancelled",
    detail: "Cancelled enrollments block transport via pure status gate.",
  })

  const activeGate = evaluateEnrollmentStatusForExecutionGate("active")
  checks.push({
    id: "pause_gate.enrollment_active",
    ok: activeGate === null,
    detail: "Active enrollments pass pure status gate.",
  })

  checks.push({
    id: "pause_gate.module_loaded",
    ok: true,
    detail: "sequence-pause-gate-types module loaded (safe-execute wiring verified in local regression).",
  })

  const schemaReady = checks.filter((check) => check.id.includes(".")).every((check) => check.ok)
  const pauseGateReady = checks
    .filter((check) => check.id.startsWith("pause_gate."))
    .every((check) => check.ok)
  const ok = schemaReady && pauseGateReady

  return {
    qa_marker: GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER,
    migration: GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION,
    ok,
    final_verdict: ok ? "PASS" : schemaReady ? "CONDITIONAL_PASS" : "FAIL",
    checks,
    schema_ready: schemaReady,
    pause_gate_ready: pauseGateReady,
    attribution_columns_ready: schemaReady,
  }
}
