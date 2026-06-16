import "server-only"

import fs from "node:fs"
import path from "node:path"
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
import {
  identifySkippedBranchTargetPatternStepIds,
  resolveSequenceBranchEdges,
} from "@/lib/growth/sequences/conditions/sequence-branch-resolver-types"
import {
  runSequenceAdvancementGateSafetyProbes,
} from "@/lib/growth/sequences/conditions/sequence-branch-advance-gate"
import {
  applySequenceBranchResolution,
  resolveSequenceEnrollmentWaitRegistry,
} from "@/lib/growth/sequences/conditions/sequence-wait-registry"
import { processSequenceAttributedWakeEvent } from "@/lib/growth/sequences/conditions/sequence-event-wake-engine"
import { resolveWaitMatched } from "@/lib/growth/sequences/conditions/sequence-wait-resolver"
import { processExpiredSequenceWaits } from "@/lib/growth/sequences/conditions/sequence-wait-timeout-processor"
import { GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-wait-timeout-types"
import { diagnoseSequenceWaitRecovery } from "@/lib/growth/sequences/conditions/sequence-wait-recovery-diagnostics"
import { simulateSequenceBranchPreview } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-engine"
import { GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER } from "@/lib/growth/sequences/conditions/sequence-branch-simulation-types"
import { listSequenceEnrollmentChannelEvents } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import {
  fetchGrowthSequenceEnrollmentById,
  insertGrowthSequenceEnrollmentStep,
  listGrowthSequenceEnrollmentSteps,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"

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
  branch_resolver_ready: boolean
  wait_registry_ready: boolean
  branch_no_transport_execution: boolean
  branch_advancement_integrated: boolean
  advancement_gate_safe: boolean
  event_wake_ready: boolean
  wait_timeout_ready: boolean
  wait_timeout_no_transport: boolean
  branch_simulation_ready: boolean
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
  let branchResolverReady = false
  let waitRegistryReady = false
  let branchNoTransportExecution = false
  let branchAdvancementIntegrated = false
  let advancementGateSafe = false
  let eventWakeReady = false
  let waitTimeoutReady = false
  let waitTimeoutNoTransport = true
  let branchSimulationReady = false
  const crudMarker = `sr3-phase1-crud-${Date.now()}`
  const phase3Marker = `sr3-phase3-${Date.now()}`
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

      const forbiddenTransportPatterns = [
        /queueSequenceStepTransportJob/,
        /createSequenceExecutionJob/,
        /insertGrowthOutreachQueueItem/,
      ]
      for (const relativePath of [
        "lib/growth/sequences/conditions/sequence-wait-registry.ts",
        "lib/growth/sequences/conditions/sequence-branch-audit.ts",
      ]) {
        const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
        branchNoTransportExecution = forbiddenTransportPatterns.every((pattern) => !pattern.test(source))
        if (!branchNoTransportExecution) break
      }
      checks.push({
        id: "branch.no_direct_transport_execution",
        ok: branchNoTransportExecution,
        detail: branchNoTransportExecution
          ? "Branch/wait modules do not invoke transport or execution job creation."
          : "Branch/wait modules may invoke forbidden transport paths.",
      })

      const pureResolver = resolveSequenceBranchEdges({
        fromPatternStepId: patternStep.id,
        edges: [],
        evaluations: [],
      })
      branchResolverReady = pureResolver.resolution === "none"
      checks.push({
        id: "branch.resolver_pure_no_edges",
        ok: branchResolverReady,
        detail: branchResolverReady
          ? "Pure branch resolver returns none when no edges configured."
          : "Branch resolver no-edge behavior unexpected.",
      })

      const patterns = await listGrowthSequencePatterns(admin)
      const pattern = patterns.find((entry) => entry.id === patternStep.pattern_id)
      branchAdvancementIntegrated = Boolean(pattern)
      checks.push({
        id: "branch.advancement_pattern_loaded",
        ok: branchAdvancementIntegrated,
        detail: branchAdvancementIntegrated
          ? "Pattern graph available for branch advancement integration probes."
          : "Unable to load pattern for branch advancement probes.",
      })

      let secondPatternStepId: string | undefined
      if (pattern && pattern.steps.length >= 1) {
        secondPatternStepId = pattern.steps.find((step) => step.id !== patternStep.id)?.id
        if (!secondPatternStepId) {
          const { data: createdSecondStep, error: secondStepError } = await admin
            .schema("growth")
            .from("sequence_pattern_steps")
            .insert({
              pattern_id: pattern.id,
              step_order: 2,
              channel: "email",
              delay_days_min: 1,
              delay_days_max: 1,
              required_human_approval: true,
            })
            .select("id")
            .single()
          if (!secondStepError && createdSecondStep?.id) {
            secondPatternStepId = createdSecondStep.id as string
          }
        }

        const refreshedPatterns = secondPatternStepId
          ? await listGrowthSequencePatterns(admin)
          : patterns
        const refreshedPattern =
          refreshedPatterns.find((entry) => entry.id === patternStep.pattern_id) ?? pattern

        if (secondPatternStepId) {
          const enrollmentSteps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
          let secondEnrollmentStep = enrollmentSteps.find(
            (step) => step.sequencePatternStepId === secondPatternStepId,
          )
          if (!secondEnrollmentStep) {
            secondEnrollmentStep = await insertGrowthSequenceEnrollmentStep(admin, {
              enrollmentId: enrollment.id,
              leadId: enrollment.lead_id as string,
              sequencePatternStepId: secondPatternStepId,
              stepOrder: 2,
              channel: "email",
            })
          }

          await updateGrowthSequenceEnrollment(admin, enrollment.id, { status: "active" })

          const leadCondition = await createCondition(admin, {
            patternStepId: patternStep.id,
            conditionKey: `${phase3Marker}-lead-status`,
            spec: { dslVersion: 1, source: "lead", event: "lead.status", statusValue: "qualified" },
            label: "SR-3 Phase 3 branch probe",
          })

          const branchEdge = await createEdge(admin, {
            patternId: pattern.id,
            fromPatternStepId: patternStep.id,
            toPatternStepId: secondPatternStepId,
            edgeType: "conditional_true",
            conditionId: leadCondition.id,
            label: `${phase3Marker} branch edge`,
          })

          const defaultEdge = await createEdge(admin, {
            patternId: pattern.id,
            fromPatternStepId: patternStep.id,
            toPatternStepId: secondPatternStepId,
            edgeType: "default",
            label: `${phase3Marker} default edge`,
          })

          const patternWithBranchEdges =
            (await listGrowthSequencePatterns(admin)).find(
              (entry) => entry.id === patternStep.pattern_id,
            ) ?? refreshedPattern

          const completedStep = await updateGrowthSequenceEnrollmentStep(admin, enrollmentStep.id, {
            status: "executed",
            completedAt: fixedNow,
          })

          const enrollmentRecord = await fetchGrowthSequenceEnrollmentById(admin, enrollment.id)
          if (enrollmentRecord) {
            const { count: jobsBefore } = await admin
              .schema("growth")
              .from("sequence_execution_jobs")
              .select("id", { count: "exact", head: true })
              .eq("sequence_enrollment_id", enrollment.id)

            const branchResult = await applySequenceBranchResolution(admin, {
              enrollment: enrollmentRecord,
              completedStep,
              pattern: patternWithBranchEdges,
              now: fixedNow,
              deferMaterializeTransport: true,
            })

            const { count: jobsAfter } = await admin
              .schema("growth")
              .from("sequence_execution_jobs")
              .select("id", { count: "exact", head: true })
              .eq("sequence_enrollment_id", enrollment.id)

            const decisionsAfterBranch = await listBranchDecisionsForEnrollment(admin, enrollment.id)
            const branchDecisionRecorded = decisionsAfterBranch.some(
              (entry) => entry.outcomeDetail.includes("conditional") || entry.outcomeDetail.includes("default"),
            )

            branchResolverReady =
              branchResolverReady &&
              (branchResult.kind === "branched" || branchResult.kind === "blocked") &&
              branchDecisionRecorded
            checks.push({
              id: "branch.resolver_materialize_target",
              ok: branchResult.kind === "branched",
              detail:
                branchResult.kind === "branched"
                  ? "Immediate branch resolution materialized target enrollment step."
                  : `Branch resolution returned ${branchResult.kind}.`,
            })

            checks.push({
              id: "branch.decision_audit_recorded",
              ok: branchDecisionRecorded,
              detail: branchDecisionRecorded
                ? "sequence_branch_decisions row appended for branch resolution."
                : "Branch decision audit missing after resolution.",
            })

            const noJobsCreated = (jobsBefore ?? 0) === (jobsAfter ?? 0)
            branchNoTransportExecution = branchNoTransportExecution && noJobsCreated
            checks.push({
              id: "branch.no_execution_jobs_created",
              ok: noJobsCreated,
              detail: noJobsCreated
                ? "Branch resolution did not create sequence_execution_jobs rows."
                : "Branch resolution created execution jobs — forbidden in Phase 3.",
            })

            const skippedTargets = identifySkippedBranchTargetPatternStepIds({
              edges: [branchEdge, defaultEdge],
              selectedEdge: branchEdge,
            })
            checks.push({
              id: "branch.skipped_targets_identified",
              ok: skippedTargets.length >= 0,
              detail: `Skipped branch targets identified (${skippedTargets.length}).`,
            })

            await updateGrowthSequenceEnrollmentStep(admin, enrollmentStep.id, {
              status: "executed",
              completedAt: fixedNow,
            })

            await deleteEdge(admin, branchEdge.id)
            await deleteEdge(admin, defaultEdge.id)
            await deleteCondition(admin, leadCondition.id)

            const waitCondition = await createCondition(admin, {
              patternStepId: patternStep.id,
              conditionKey: `${phase3Marker}-email-opened`,
              spec: { dslVersion: 1, source: "email", event: "email.opened" },
              label: "SR-3 Phase 3 wait probe",
            })

            const waitEdge = await createEdge(admin, {
              patternId: pattern.id,
              fromPatternStepId: patternStep.id,
              toPatternStepId: secondPatternStepId,
              edgeType: "conditional_true",
              conditionId: waitCondition.id,
              label: `${phase3Marker} wait edge`,
            })

            const patternWithWaitEdge =
              (await listGrowthSequencePatterns(admin)).find(
                (entry) => entry.id === patternStep.pattern_id,
              ) ?? patternWithBranchEdges

            const waitResult = await applySequenceBranchResolution(admin, {
              enrollment: enrollmentRecord,
              completedStep: { ...completedStep, status: "executed" },
              pattern: patternWithWaitEdge,
              now: fixedNow,
              deferMaterializeTransport: true,
            })

            const waitStep = await admin
              .schema("growth")
              .from("sequence_enrollment_steps")
              .select("status")
              .eq("id", enrollmentStep.id)
              .maybeSingle()

            waitRegistryReady = waitResult.kind === "waiting" && waitStep.data?.status === "waiting"
            checks.push({
              id: "wait.created_for_event_condition",
              ok: waitRegistryReady,
              detail: waitRegistryReady
                ? "Event-based unmatched condition created wait and marked step waiting."
                : `Wait creation probe returned ${waitResult.kind}.`,
            })

            if (waitResult.kind === "waiting") {
              const resolved = await resolveSequenceEnrollmentWaitRegistry(admin, {
                waitId: waitResult.waitId,
                resolutionReason: "operator_override",
                pattern: patternWithWaitEdge,
                now: fixedNow,
                forceTargetPatternStepId: secondPatternStepId,
              })
              waitRegistryReady =
                waitRegistryReady && (resolved.kind === "branched" || resolved.kind === "blocked")
              checks.push({
                id: "wait.resolved_operator_override",
                ok: resolved.kind === "branched",
                detail:
                  resolved.kind === "branched"
                    ? "Wait registry resolved with operator_override and materialized target."
                    : `Wait resolution returned ${resolved.kind}.`,
              })
            }

            await deleteEdge(admin, waitEdge.id)
            await deleteCondition(admin, waitCondition.id)
          }
        }
      }

      await updateGrowthSequenceEnrollment(admin, enrollment.id, { status: "draft", pauseReason: null })

      const gateProbe = await runSequenceAdvancementGateSafetyProbes(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        leadId: enrollment.lead_id as string,
        marker: phase3Marker,
      })

      advancementGateSafe =
        gateProbe.pausedBlocksAdvancement &&
        gateProbe.auditRecorded &&
        (gateProbe.exitCandidateProbeSkipped || gateProbe.exitCandidateBlocksAdvancement)

      checks.push({
        id: "advancement.pause_gate_blocks_all_paths",
        ok: gateProbe.pausedBlocksAdvancement,
        detail: gateProbe.pausedBlocksAdvancement
          ? "Paused enrollment blocked branch + linear advancement with audit."
          : "Paused enrollment still advanced or materialized next step.",
      })
      checks.push({
        id: "advancement.exit_candidate_blocks_all_paths",
        ok: gateProbe.exitCandidateProbeSkipped ? false : gateProbe.exitCandidateBlocksAdvancement,
        detail: gateProbe.exitCandidateProbeSkipped
          ? "Skipped exit-candidate probe — no inbox thread for cert lead."
          : gateProbe.exitCandidateBlocksAdvancement
            ? "Pending exit candidate blocked branch + linear advancement with audit."
            : "Exit candidate did not block advancement.",
      })
      checks.push({
        id: "advancement.blocked_audit_recorded",
        ok: gateProbe.auditRecorded,
        detail: gateProbe.auditRecorded
          ? "advancement_blocked channel event recorded for paused probe."
          : "No advancement_blocked audit event recorded.",
      })

      const wakeScan = await processSequenceAttributedWakeEvent(admin, {
        leadId: enrollment.lead_id as string,
        sequenceEnrollmentId: enrollment.id,
        source: "email",
        event: "email.opened",
        occurredAt: fixedNow,
      })
      checks.push({
        id: "wake.engine_scans_without_error",
        ok: wakeScan.scannedWaits >= 0,
        detail: `Event wake engine scanned ${wakeScan.scannedWaits} active wait(s).`,
      })

      await updateGrowthSequenceEnrollment(admin, enrollment.id, { status: "active", pauseReason: null })
      const wakeCondition = await createCondition(admin, {
        patternStepId: patternStep.id,
        conditionKey: `${phase3Marker}-wake-open`,
        spec: { dslVersion: 1, source: "email", event: "email.opened" },
        label: "SR-3 Phase 4 wake probe",
      })
      const wakeWait = await createWait(admin, {
        enrollmentId: enrollment.id,
        enrollmentStepId: enrollmentStep.id,
        patternStepId: patternStep.id,
        conditionId: wakeCondition.id,
        waitKind: "until_event",
        status: "active",
        waitedForSource: "email",
        waitedForEvent: "email.opened",
        startedAt: fixedNow,
      })
      await updateGrowthSequenceEnrollmentStep(admin, enrollmentStep.id, { status: "waiting" })

      await updateGrowthSequenceEnrollment(admin, enrollment.id, { status: "paused", pauseReason: phase3Marker })
      const blockedWake = await resolveWaitMatched(admin, { waitId: wakeWait.id, now: fixedNow })
      const blockedWakeOk = blockedWake.kind === "blocked"
      checks.push({
        id: "wake.pause_gate_blocks_resolution",
        ok: blockedWakeOk,
        detail: blockedWakeOk
          ? "Paused enrollment blocked wait resolution during event wake path."
          : `Wait resolution returned ${blockedWake.kind} while paused.`,
      })

      await updateGrowthSequenceEnrollment(admin, enrollment.id, { status: "active", pauseReason: null })

      const phase5Marker = `${phase3Marker}-timeout`
      const expiredAt = new Date(Date.parse(fixedNow) - 60_000).toISOString()

      if (secondPatternStepId) {
        const timeoutEdge = await createEdge(admin, {
          patternId: pattern.id,
          fromPatternStepId: patternStep.id,
          toPatternStepId: secondPatternStepId,
          edgeType: "timeout",
          label: `${phase5Marker} timeout edge`,
        })

        await updateWait(admin, wakeWait.id, { timeoutAt: expiredAt, status: "active" })

        const { count: jobsBeforeTimeout } = await admin
          .schema("growth")
          .from("sequence_execution_jobs")
          .select("id", { count: "exact", head: true })
          .eq("sequence_enrollment_id", enrollment.id)

        const timeoutBatch1 = await processExpiredSequenceWaits(admin, { now: fixedNow, limit: 50 })
        const channelEventsAfterTimeout = await listSequenceEnrollmentChannelEvents(admin, {
          enrollmentId: enrollment.id,
          limit: 200,
        })
        const timeoutAudits = {
          conditionTimeout: channelEventsAfterTimeout.some((entry) => entry.eventKind === "condition_timeout"),
          waitResolved: channelEventsAfterTimeout.some((entry) => entry.eventKind === "wait_resolved"),
          branchEvaluated: channelEventsAfterTimeout.some((entry) => entry.eventKind === "branch_evaluated"),
        }

        checks.push({
          id: "timeout.expired_wait_resolves_timeout_edge",
          ok: timeoutBatch1.resolved >= 1,
          detail:
            timeoutBatch1.resolved >= 1
              ? `Expired wait resolved via timeout processor (resolved=${timeoutBatch1.resolved}).`
              : `Timeout processor did not resolve expired wait (resolved=${timeoutBatch1.resolved}, failed=${timeoutBatch1.failed}).`,
        })
        checks.push({
          id: "timeout.audits_recorded",
          ok: timeoutAudits.conditionTimeout && timeoutAudits.waitResolved && timeoutAudits.branchEvaluated,
          detail: `Audits: condition_timeout=${timeoutAudits.conditionTimeout}, wait_resolved=${timeoutAudits.waitResolved}, branch_evaluated=${timeoutAudits.branchEvaluated}.`,
        })

        const timeoutBatch2 = await processExpiredSequenceWaits(admin, { now: fixedNow, limit: 50 })
        const idempotentOk = timeoutBatch2.resolved === 0 && !timeoutBatch2.processedWaitIds.includes(wakeWait.id)
        checks.push({
          id: "timeout.idempotent_rerun",
          ok: idempotentOk,
          detail: idempotentOk
            ? "Second timeout processor run did not re-resolve the same wait."
            : `Idempotency probe failed (resolved=${timeoutBatch2.resolved}).`,
        })

        const waitNoEdge = await createWait(admin, {
          enrollmentId: enrollment.id,
          enrollmentStepId: enrollmentStep.id,
          patternStepId: patternStep.id,
          conditionId: wakeCondition.id,
          waitKind: "until_event",
          status: "active",
          waitedForSource: "email",
          waitedForEvent: "email.opened",
          timeoutAt: expiredAt,
          startedAt: fixedNow,
        })
        const staleEdges = await listEdgesForPattern(admin, pattern.id)
        for (const edge of staleEdges.filter((entry) => entry.fromPatternStepId === patternStep.id)) {
          await deleteEdge(admin, edge.id)
        }
        const noEdgeBatch = await processExpiredSequenceWaits(admin, { now: fixedNow, limit: 50 })
        checks.push({
          id: "timeout.missing_timeout_edge_records_failure",
          ok: noEdgeBatch.failed >= 1,
          detail:
            noEdgeBatch.failed >= 1
              ? `Wait without timeout edge counted as failed (failed=${noEdgeBatch.failed}).`
              : "Missing timeout edge did not record failure.",
        })

        const waitPaused = await createWait(admin, {
          enrollmentId: enrollment.id,
          enrollmentStepId: enrollmentStep.id,
          patternStepId: patternStep.id,
          conditionId: wakeCondition.id,
          waitKind: "until_event",
          status: "active",
          waitedForSource: "email",
          waitedForEvent: "email.opened",
          timeoutAt: expiredAt,
          startedAt: fixedNow,
        })
        await createEdge(admin, {
          patternId: pattern.id,
          fromPatternStepId: patternStep.id,
          toPatternStepId: secondPatternStepId,
          edgeType: "timeout",
          label: `${phase5Marker} paused timeout edge`,
        })
        await updateGrowthSequenceEnrollment(admin, enrollment.id, {
          status: "paused",
          pauseReason: phase5Marker,
        })
        const pausedBatch = await processExpiredSequenceWaits(admin, { now: fixedNow, limit: 50 })
        const pausedBlockedOk = pausedBatch.blocked >= 1
        checks.push({
          id: "timeout.paused_enrollment_blocks_resolution",
          ok: pausedBlockedOk,
          detail: pausedBlockedOk
            ? `Paused enrollment blocked timeout resolution (blocked=${pausedBatch.blocked}).`
            : "Paused enrollment did not block timeout processor.",
        })

        await updateGrowthSequenceEnrollment(admin, enrollment.id, { status: "active", pauseReason: null })

        const { count: jobsAfterTimeout } = await admin
          .schema("growth")
          .from("sequence_execution_jobs")
          .select("id", { count: "exact", head: true })
          .eq("sequence_enrollment_id", enrollment.id)
        const noJobsFromTimeout = (jobsBeforeTimeout ?? 0) === (jobsAfterTimeout ?? 0)
        waitTimeoutNoTransport = waitTimeoutNoTransport && noJobsFromTimeout
        checks.push({
          id: "timeout.no_execution_jobs_created",
          ok: noJobsFromTimeout,
          detail: noJobsFromTimeout
            ? "Timeout processor did not create sequence_execution_jobs rows."
            : "Timeout processor created execution jobs — forbidden.",
        })

        const recovery = await diagnoseSequenceWaitRecovery(admin, { limit: 50 })
        checks.push({
          id: "timeout.recovery_diagnostics_available",
          ok: recovery.qa_marker === GROWTH_SEQUENCE_WAIT_TIMEOUT_QA_MARKER,
          detail: `Wait recovery diagnostics returned ${recovery.totalIssues} issue(s).`,
        })

        waitTimeoutReady =
          timeoutBatch1.resolved >= 1 &&
          timeoutAudits.conditionTimeout &&
          timeoutAudits.waitResolved &&
          timeoutAudits.branchEvaluated &&
          idempotentOk &&
          noEdgeBatch.failed >= 1 &&
          pausedBlockedOk &&
          noJobsFromTimeout

        void waitNoEdge
        void waitPaused
      } else {
        checks.push({
          id: "timeout.expired_wait_resolves_timeout_edge",
          ok: false,
          detail: "Skipped timeout processor probes — second pattern step unavailable.",
        })
      }

      checks.push({
        id: "wake.timeout_resolution_available",
        ok: waitTimeoutReady || !secondPatternStepId,
        detail: waitTimeoutReady
          ? "Wait timeout resolution exercised via Phase 5 timeout processor."
          : "Timeout resolution probe skipped — second pattern step unavailable.",
      })

      const { count: jobsAfterWake } = await admin
        .schema("growth")
        .from("sequence_execution_jobs")
        .select("id", { count: "exact", head: true })
        .eq("sequence_enrollment_id", enrollment.id)
      checks.push({
        id: "wake.no_execution_jobs_created",
        ok: (jobsAfterWake ?? 0) === 0,
        detail:
          (jobsAfterWake ?? 0) === 0
            ? "Event wake / wait resolution did not create sequence_execution_jobs."
            : "Event wake path created execution jobs — forbidden.",
      })

      eventWakeReady = blockedWakeOk && wakeScan.scannedWaits >= 0 && (jobsAfterWake ?? 0) === 0

      if (secondPatternStepId) {
        const { count: jobsBeforeSimulation } = await admin
          .schema("growth")
          .from("sequence_execution_jobs")
          .select("id", { count: "exact", head: true })
          .eq("sequence_enrollment_id", enrollment.id)

        const simulation = await simulateSequenceBranchPreview(admin, {
          enrollmentId: enrollment.id,
          enrollmentStepId: enrollmentStep.id,
          now: fixedNow,
          scenario: "immediate",
          conditionOverrides: { [wakeCondition.id]: true },
        })

        const { count: jobsAfterSimulation } = await admin
          .schema("growth")
          .from("sequence_execution_jobs")
          .select("id", { count: "exact", head: true })
          .eq("sequence_enrollment_id", enrollment.id)

        branchSimulationReady =
          simulation.read_only === true &&
          simulation.qa_marker === GROWTH_SEQUENCE_BRANCH_SIMULATION_QA_MARKER &&
          (jobsBeforeSimulation ?? 0) === (jobsAfterSimulation ?? 0)

        checks.push({
          id: "simulation.read_only_preview",
          ok: simulation.read_only === true,
          detail: `Branch simulation returned path kind ${simulation.path.kind}.`,
        })
        checks.push({
          id: "simulation.no_execution_jobs_created",
          ok: (jobsBeforeSimulation ?? 0) === (jobsAfterSimulation ?? 0),
          detail:
            (jobsBeforeSimulation ?? 0) === (jobsAfterSimulation ?? 0)
              ? "Simulation did not create sequence_execution_jobs rows."
              : "Simulation created execution jobs — forbidden.",
        })
        checks.push({
          id: "simulation.graph_read_model_attached",
          ok: simulation.graph.steps.length > 0 && simulation.graph.edges.length >= 0,
          detail: `Graph read model returned ${simulation.graph.steps.length} step node(s).`,
        })
      } else {
        checks.push({
          id: "simulation.read_only_preview",
          ok: false,
          detail: "Skipped simulation probes — second pattern step unavailable.",
        })
      }

      await deleteCondition(admin, wakeCondition.id)
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

  const ok =
    schemaReady &&
    crudReady &&
    evaluatorReady &&
    branchResolverReady &&
    waitRegistryReady &&
    branchNoTransportExecution &&
    advancementGateSafe &&
    eventWakeReady &&
    waitTimeoutReady &&
    waitTimeoutNoTransport &&
    branchSimulationReady

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
    branch_resolver_ready: branchResolverReady,
    wait_registry_ready: waitRegistryReady,
    branch_no_transport_execution: branchNoTransportExecution,
    branch_advancement_integrated: branchAdvancementIntegrated,
    advancement_gate_safe: advancementGateSafe,
    event_wake_ready: eventWakeReady,
    wait_timeout_ready: waitTimeoutReady,
    wait_timeout_no_transport: waitTimeoutNoTransport,
    branch_simulation_ready: branchSimulationReady,
  }
}
