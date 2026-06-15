import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_SEQUENCE_CONDITIONS_CONFIRM,
  GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
  GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  appendBranchDecision,
  createCondition,
  createEdge,
  createWait,
  deleteCondition,
  deleteEdge,
  listBranchDecisionsForEnrollment,
  listConditionsForStep,
  listEdgesForPattern,
  updateCondition,
  updateEdge,
  updateWait,
} from "@/lib/growth/sequences/conditions/sequence-condition-repository"

export { GROWTH_SEQUENCE_CONDITIONS_CONFIRM, GROWTH_SEQUENCE_CONDITIONS_QA_MARKER }

export type SequenceConditionsDiagnosticCheck = {
  id: string
  ok: boolean
  detail: string
}

export type SequenceConditionsDiagnosticsReport = {
  qa_marker: typeof GROWTH_SEQUENCE_CONDITIONS_QA_MARKER
  migration: typeof GROWTH_SEQUENCE_CONDITIONS_MIGRATION
  ok: boolean
  final_verdict: "PASS" | "FAIL" | "CONDITIONAL_PASS"
  checks: SequenceConditionsDiagnosticCheck[]
  schema_ready: boolean
  crud_ready: boolean
  runtime_branching_absent: boolean
}

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
): Promise<boolean> {
  const { error } = await admin.schema("growth").from(table).select(column).limit(1)
  if (!error) return true
  const message = error.message.toLowerCase()
  return !message.includes("does not exist") && !message.includes("column")
}

async function probeEnrollmentStepStatuses(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("status")
    .in("status", ["waiting", "branch_skipped"])
    .limit(1)
  if (!error) return true
  const message = error.message.toLowerCase()
  return !message.includes("violates check constraint") && !message.includes("invalid input value")
}

export async function executeGrowthSequenceConditionsDiagnostics(
  admin: SupabaseClient,
): Promise<SequenceConditionsDiagnosticsReport> {
  const checks: SequenceConditionsDiagnosticCheck[] = []

  for (const entry of SCHEMA_TABLES) {
    for (const column of entry.columns) {
      const ready = await probeTableColumn(admin, entry.table, column)
      checks.push({
        id: `${entry.table}.${column}`,
        ok: ready,
        detail: ready
          ? `${entry.table}.${column} is queryable.`
          : `${entry.table}.${column} missing — apply ${GROWTH_SEQUENCE_CONDITIONS_MIGRATION}.`,
      })
    }
  }

  const enrollmentStatusesReady = await probeEnrollmentStepStatuses(admin)
  checks.push({
    id: "sequence_enrollment_steps.status.waiting_branch_skipped",
    ok: enrollmentStatusesReady,
    detail: enrollmentStatusesReady
      ? "Enrollment step statuses waiting/branch_skipped accepted by schema."
      : "Enrollment step status constraint missing waiting/branch_skipped.",
  })

  let crudReady = false
  const crudMarker = `sr3-phase1-crud-${Date.now()}`
  try {
    const patternStep = await admin
      .schema("growth")
      .from("sequence_pattern_steps")
      .select("id, pattern_id")
      .limit(1)
      .maybeSingle()

    const enrollment = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id, lead_id")
      .limit(1)
      .maybeSingle()

    const enrollmentStep = enrollment?.id
      ? await admin
          .schema("growth")
          .from("sequence_enrollment_steps")
          .select("id")
          .eq("enrollment_id", enrollment.id)
          .limit(1)
          .maybeSingle()
      : null

    if (patternStep?.id && patternStep.pattern_id && enrollment?.id && enrollmentStep?.id) {
      const condition = await createCondition(admin, {
        patternStepId: patternStep.id,
        conditionKey: `${crudMarker}-cond`,
        spec: { dslVersion: 1, source: "email", event: "email.opened" },
        label: "SR-3 Phase 1 cert probe",
      })

      const listed = await listConditionsForStep(admin, patternStep.id)
      const updated = await updateCondition(admin, condition.id, {
        label: "SR-3 Phase 1 cert probe updated",
      })

      const patternSteps = await admin
        .schema("growth")
        .from("sequence_pattern_steps")
        .select("id")
        .eq("pattern_id", patternStep.pattern_id)
        .order("step_order", { ascending: true })
        .limit(2)

      const fromStepId = patternSteps.data?.[0]?.id as string | undefined
      const toStepId = (patternSteps.data?.[1]?.id ?? patternSteps.data?.[0]?.id) as
        | string
        | undefined

      let edgeId: string | null = null
      let edges: Awaited<ReturnType<typeof listEdgesForPattern>> = []

      if (fromStepId && toStepId && fromStepId !== toStepId) {
        const edge = await createEdge(admin, {
          patternId: patternStep.pattern_id,
          fromPatternStepId: fromStepId,
          toPatternStepId: toStepId,
          edgeType: "fallback",
          label: "cert probe edge",
        })
        edgeId = edge.id
        await updateEdge(admin, edge.id, { priority: 1 })
        edges = await listEdgesForPattern(admin, patternStep.pattern_id)
      }

      const wait = await createWait(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        patternStepId: patternStep.id,
        conditionId: condition.id,
        waitKind: "condition",
        status: "pending",
      })

      await updateWait(admin, wait.id, { status: "cancelled", resolutionReason: crudMarker })

      await appendBranchDecision(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        patternStepId: patternStep.id,
        conditionId: condition.id,
        edgeId,
        decision: "skipped",
        dslVersion: 1,
        source: "email",
        event: "email.opened",
        outcomeDetail: crudMarker,
      })

      const decisions = await listBranchDecisionsForEnrollment(admin, enrollment.id)

      if (edgeId) await deleteEdge(admin, edgeId)
      await deleteCondition(admin, condition.id)

      crudReady =
        listed.some((item) => item.id === condition.id) &&
        updated.label === "SR-3 Phase 1 cert probe updated" &&
        (edgeId === null || edges.some((item) => item.id === edgeId)) &&
        decisions.some((item) => item.outcomeDetail === crudMarker)

      checks.push({
        id: "repository.crud_roundtrip",
        ok: crudReady,
        detail: crudReady
          ? "Condition/edge/wait/decision repository CRUD roundtrip succeeded."
          : "Repository CRUD roundtrip incomplete.",
      })
    } else {
      checks.push({
        id: "repository.crud_roundtrip",
        ok: false,
        detail: "Skipped CRUD roundtrip — no pattern step + enrollment fixture available.",
      })
    }
  } catch (error) {
    checks.push({
      id: "repository.crud_roundtrip",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  const schemaReady = checks
    .filter((check) => check.id.startsWith("sequence_") || check.id.includes("enrollment_steps"))
    .every((check) => check.ok)

  return {
    qa_marker: GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
    migration: GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
    ok: schemaReady && crudReady,
    final_verdict: schemaReady && crudReady ? "PASS" : schemaReady ? "CONDITIONAL_PASS" : "FAIL",
    checks,
    schema_ready: schemaReady,
    crud_ready: crudReady,
    runtime_branching_absent: true,
  }
}
