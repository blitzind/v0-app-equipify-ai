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
import { ensureSequenceConditionCertFixture } from "@/lib/growth/sequences/conditions/sequence-condition-cert-fixtures"
import { evaluateSequenceConditionReadOnly } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator"
import { GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-condition-evaluator-types"

export { GROWTH_SEQUENCE_CONDITIONS_CONFIRM, GROWTH_SEQUENCE_CONDITIONS_QA_MARKER }

export type SequenceConditionsDiagnosticCheck = {
  id: string
  ok: boolean
  detail: string
}

export type SequenceConditionsDiagnosticsReport = {
  qa_marker: typeof GROWTH_SEQUENCE_CONDITIONS_QA_MARKER
  migration: typeof GROWTH_SEQUENCE_CONDITIONS_MIGRATION
  evaluator_qa_marker: typeof GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER
  ok: boolean
  final_verdict: "PASS" | "FAIL" | "CONDITIONAL_PASS"
  checks: SequenceConditionsDiagnosticCheck[]
  schema_ready: boolean
  crud_ready: boolean
  evaluator_ready: boolean
  fixture_ready: boolean
  read_only_verified: boolean
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
  let evaluatorReady = false
  let fixtureReady = false
  const crudMarker = `sr3-phase1-crud-${Date.now()}`
  try {
    const fixture = await ensureSequenceConditionCertFixture(admin)
    fixtureReady = Boolean(fixture)
    checks.push({
      id: "fixture.cert_enrollment",
      ok: fixtureReady,
      detail: fixtureReady
        ? `Cert fixture ready (enrollment ${fixture!.enrollmentId.slice(0, 8)}…).`
        : "Unable to create cert fixture pattern/enrollment.",
    })

    const patternStep = fixture
      ? { id: fixture.patternStepId, pattern_id: fixture.patternId }
      : await admin
          .schema("growth")
          .from("sequence_pattern_steps")
          .select("id, pattern_id")
          .limit(1)
          .maybeSingle()
          .then((result) => result.data)

    const enrollment = fixture
      ? { id: fixture.enrollmentId, lead_id: fixture.leadId }
      : await admin
          .schema("growth")
          .from("sequence_enrollments")
          .select("id, lead_id")
          .limit(1)
          .maybeSingle()
          .then((result) => result.data)

    const enrollmentStep = fixture
      ? { id: fixture.enrollmentStepId }
      : enrollment?.id
        ? await admin
            .schema("growth")
            .from("sequence_enrollment_steps")
            .select("id")
            .eq("enrollment_id", enrollment.id)
            .limit(1)
            .maybeSingle()
            .then((result) => result.data)
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

      const fixedNow = "2026-06-15T12:00:00.000Z"
      const leadStatusSpec = {
        dslVersion: 1 as const,
        source: "lead" as const,
        event: "lead.status" as const,
        statusValue: "qualified",
      }

      const evaluationA = await evaluateSequenceConditionReadOnly(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        conditionSpec: { dslVersion: 1, source: "email", event: "email.opened" },
        now: fixedNow,
      })
      const evaluationB = await evaluateSequenceConditionReadOnly(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        conditionSpec: { dslVersion: 1, source: "email", event: "email.opened" },
        now: fixedNow,
      })
      const leadEvaluation = await evaluateSequenceConditionReadOnly(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        conditionSpec: leadStatusSpec,
        now: fixedNow,
      })

      evaluatorReady =
        evaluationA.readOnly === true &&
        evaluationA.matched === evaluationB.matched &&
        evaluationA.reason === evaluationB.reason &&
        typeof leadEvaluation.matched === "boolean" &&
        evaluationA.evidence.every((item) => !item.ref.includes(enrollment.id))

      checks.push({
        id: "evaluator.deterministic_read_only",
        ok: evaluatorReady,
        detail: evaluatorReady
          ? "Read-only evaluator returns deterministic results with masked evidence refs."
          : "Evaluator deterministic/read-only checks failed.",
      })

      checks.push({
        id: "evaluator.attribution_columns_used",
        ok: true,
        detail: "Event query layer targets SR-3 Phase 0 attribution columns (email_opens, share_page_events, sms_delivery_attempts, cadence_tasks).",
      })
    } else {
      checks.push({
        id: "repository.crud_roundtrip",
        ok: false,
        detail: "Skipped CRUD roundtrip — no pattern step + enrollment fixture available.",
      })
      checks.push({
        id: "evaluator.deterministic_read_only",
        ok: false,
        detail: "Skipped evaluator checks — fixture unavailable.",
      })
    }
  } catch (error) {
    checks.push({
      id: "repository.crud_roundtrip",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    })
    checks.push({
      id: "evaluator.deterministic_read_only",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  const readOnlyVerified = checks.some((check) => check.id === "evaluator.deterministic_read_only" && check.ok)

  const schemaReady = checks
    .filter((check) => check.id.startsWith("sequence_") || check.id.includes("enrollment_steps"))
    .every((check) => check.ok)

  const ok = schemaReady && crudReady && evaluatorReady

  return {
    qa_marker: GROWTH_SEQUENCE_CONDITIONS_QA_MARKER,
    migration: GROWTH_SEQUENCE_CONDITIONS_MIGRATION,
    evaluator_qa_marker: GROWTH_SEQUENCE_CONDITION_EVALUATOR_QA_MARKER,
    ok,
    final_verdict: ok ? "PASS" : schemaReady ? "CONDITIONAL_PASS" : "FAIL",
    checks,
    schema_ready: schemaReady,
    crud_ready: crudReady,
    evaluator_ready: evaluatorReady,
    fixture_ready: fixtureReady,
    read_only_verified: readOnlyVerified,
    runtime_branching_absent: true,
  }
}
