/**
 * Regression checks for Sequence Execution Foundation (Phase 2A).
 * Run: pnpm test:growth-sequence-execution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildSequenceExecutionDashboard } from "../lib/growth/sequences/sequence-dashboard"
import { computeEnrollmentNextDueAt } from "../lib/growth/sequences/sequence-enrollment"
import { evaluateSequenceExitRules } from "../lib/growth/sequences/sequence-exit-rules"
import { buildSequenceStatusChangeEvents } from "../lib/growth/sequences/sequence-event-builder"
import {
  computeSequenceHealthScore,
  evaluateSequenceHealth,
  isSequenceStepOverdue,
  sequenceHealthScoreToTier,
} from "../lib/growth/sequences/sequence-health"
import {
  assertSequenceEnrollmentTransition,
  canTransitionSequenceEnrollment,
} from "../lib/growth/sequences/sequence-state-machine"
import {
  GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER,
  GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE,
  GROWTH_SEQUENCE_TIMELINE_EVENT_TYPES,
} from "../lib/growth/sequences/sequence-types"
import { GROWTH_SEQUENCE_EXECUTION_SCHEMA_MIGRATION } from "../lib/growth/sequences/sequence-schema-health"

async function main(): Promise<void> {
  assert.equal(GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER, "growth-sequence-execution-foundation-v1")
  assert.match(GROWTH_SEQUENCE_EXECUTION_PRIVACY_NOTE, /human approval|no sending/i)
  assert.equal(GROWTH_SEQUENCE_TIMELINE_EVENT_TYPES.length, 6)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_SEQUENCE_EXECUTION_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.sequence_templates/)
  assert.match(migration, /growth\.sequence_template_steps/)
  assert.match(migration, /growth\.sequence_template_enrollments/)
  assert.match(migration, /growth\.sequence_execution_events/)
  assert.match(migration, /sequence_started/)
  assert.match(migration, /sequence_health_declined/)
  assert.match(migration, /deleted_at/)
  assert.match(migration, /service role only/)

  assert.equal(canTransitionSequenceEnrollment("draft", "active"), true)
  assert.equal(canTransitionSequenceEnrollment("active", "paused"), true)
  assert.equal(canTransitionSequenceEnrollment("paused", "active"), true)
  assert.equal(canTransitionSequenceEnrollment("draft", "completed"), false)
  assert.throws(() => assertSequenceEnrollmentTransition("completed", "active"))

  assert.equal(computeSequenceHealthScore({ status: "active" }), 100)
  assert.equal(sequenceHealthScoreToTier(100), "healthy")
  assert.equal(sequenceHealthScoreToTier(75), "warning")
  assert.equal(sequenceHealthScoreToTier(55), "degraded")
  assert.equal(sequenceHealthScoreToTier(20), "critical")
  assert.equal(
    computeSequenceHealthScore({
      status: "paused",
      overdue_step: true,
      has_failed_event: true,
      has_critical_event: true,
    }),
    25,
  )

  const overdue = isSequenceStepOverdue(new Date(Date.now() - 60_000).toISOString(), "active")
  assert.equal(overdue, true)

  const health = evaluateSequenceHealth({ status: "active", overdue_step: true })
  assert.equal(health.health_tier, "warning")

  const exit = evaluateSequenceExitRules({ reply_detected: true, exit_on_reply: true })
  assert.equal(exit.should_exit, true)
  assert.equal(exit.signal, "reply_detected")

  const blocked = evaluateSequenceExitRules({ suppressed_lead: true })
  assert.equal(blocked.should_exit, true)

  const dueAt = computeEnrollmentNextDueAt(
    [
      {
        id: "s1",
        sequence_template_id: "t1",
        step_number: 1,
        channel: "email",
        delay_days: 2,
        generation_type: "intro",
        approval_required: true,
        condition_rules: {},
        exit_rules: {},
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    1,
    new Date().toISOString(),
  )
  assert.ok(dueAt)

  const events = buildSequenceStatusChangeEvents({
    leadLabel: "Acme",
    sequenceName: "Intro",
    previousStatus: "draft",
    nextStatus: "active",
    previousScore: 100,
    nextScore: 80,
  })
  assert.ok(events.some((event) => event.timeline_type === "sequence_started"))
  assert.ok(events.some((event) => event.timeline_type === "sequence_health_declined"))

  const dashboard = buildSequenceExecutionDashboard({
    templates: [
      {
        id: "t1",
        name: "Intro",
        description: null,
        category: "outbound",
        status: "draft",
        approval_required: true,
        exit_on_reply: true,
        exit_on_meeting: true,
        exit_on_positive_intent: true,
        created_by: null,
        step_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ],
    enrollments: [
      {
        id: "e1",
        lead_id: "l1",
        lead_label: "Acme",
        sequence_template_id: "t1",
        sequence_name: "Intro",
        status: "active",
        current_step: 1,
        next_step_due_at: new Date().toISOString(),
        completion_reason: null,
        health_score: 90,
        health_tier: "healthy",
        enrolled_by: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "e2",
        lead_id: "l2",
        lead_label: "Beta",
        sequence_template_id: "t1",
        sequence_name: "Intro",
        status: "paused",
        current_step: 2,
        next_step_due_at: null,
        completion_reason: null,
        health_score: 70,
        health_tier: "warning",
        enrolled_by: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  })
  assert.equal(dashboard.qa_marker, GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER)
  assert.equal(dashboard.draft_count, 1)
  assert.equal(dashboard.active_count, 1)
  assert.equal(dashboard.paused_count, 1)

  const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/sequences/sequence-repository.ts"), "utf8")
  assert.match(repoSource, /softDeleteSequenceTemplate/)
  assert.match(repoSource, /enrollLeadInSequence/)
  assert.match(repoSource, /sequence_template_enrollments/)
  assert.doesNotMatch(repoSource, /executeStep|sendMail|outreach_queue\.insert/i)

  for (const route of [
    "app/api/platform/growth/sequences/route.ts",
    "app/api/platform/growth/sequences/dashboard/route.ts",
    "app/api/platform/growth/sequences/enroll/route.ts",
    "app/api/platform/growth/sequences/[id]/route.ts",
    "app/api/platform/growth/sequences/[id]/pause/route.ts",
    "app/api/platform/growth/sequences/[id]/resume/route.ts",
    "app/api/platform/growth/sequences/[id]/cancel/route.ts",
  ]) {
    const apiSource = fs.readFileSync(path.join(process.cwd(), route), "utf8")
    assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  }

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-sequence-execution-foundation-dashboard.tsx"),
    "utf8",
  )
  assert.match(uiSource, /Sequence Health/)
  assert.match(uiSource, /Step Viewer/)
  assert.match(uiSource, /Coming Soon/)
  assert.match(uiSource, /GROWTH_SEQUENCE_EXECUTION_FOUNDATION_QA_MARKER/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/sequences\/execution/)

  console.log("growth-sequence-execution: all checks passed")
}

void main()
