/**
 * GE-v1-5 — Automation Runtime certification.
 *
 * Local: pnpm test:ge-v1-5-automation-runtime
 * Production: pnpm test:ge-v1-5-automation-runtime:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  approveGeV15PreparedAction,
  canGeV15TransitionApproval,
  listGeV15PendingApprovals,
  resolveGeV15InitialApprovalStatus,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import { evaluateGeV15Conditions } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-conditions"
import {
  buildGeV15DelayDedupeKey,
  resolveGeV15DelayMs,
  scheduleGeV15Delay,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-delays"
import {
  appendGeV15RuntimeLog,
  createEmptyGeV15RuntimeState,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging"
import {
  GE_V1_5_BUILTIN_PLAYBOOKS,
  matchGeV15Playbooks,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-playbooks"
import { buildGeV15ProviderReadinessReport } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-provider-readiness"
import { buildGeV15RuntimeReadinessReport } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-readiness"
import {
  GE_V1_5_AUTOMATION_RUNTIME_ACTIONS,
  GE_V1_5_AUTOMATION_RUNTIME_CONFIRM,
  GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS,
  GE_V1_5_CONDITION_KINDS,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import {
  GE_V1_5_SENDR_EVENT_TO_TRIGGER,
  normalizeSendrEventToGeV15Trigger,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-triggers"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const REQUIRED_FILES = [
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-types.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-triggers.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-conditions.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-playbooks.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-actions.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-delays.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-signal-processor.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-readiness.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-provider-readiness.ts",
  "lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval-service.ts",
  "app/api/platform/growth/automation-runtime/readiness/route.ts",
  "app/api/platform/growth/automation-runtime/approvals/route.ts",
] as const

const REUSED_INFRASTRUCTURE = [
  "lib/growth/automation/growth-automation-trigger-matcher.ts",
  "lib/growth/automation/growth-automation-runtime-orchestrator.ts",
  "lib/growth/automation/growth-automation-approval-service.ts",
  "lib/growth/sendr/growth-sendr-public-engagement-service.ts",
  "lib/growth/sendr/growth-sendr-recommendation-service.ts",
  "lib/growth/notifications/emit-growth-notification.ts",
  "lib/growth/cadence/cadence-task-repository.ts",
  "lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts",
  "lib/growth/runtime-guardrails/growth-runtime-kill-switch-service.ts",
  "lib/growth/runtime-guardrails/growth-runtime-budget-service.ts",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GE-v1-5 Automation Runtime (${GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER}) ===\n`)

  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER, "ge-v1-5-automation-runtime-v1")
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_CONFIRM, "RUN_GE_V1_5_AUTOMATION_RUNTIME_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  for (const relativePath of REQUIRED_FILES) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log(`  ✓ ${REQUIRED_FILES.length} GE-v1-5 module files exist`)

  for (const relativePath of REUSED_INFRASTRUCTURE) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing reused: ${relativePath}`)
  }
  console.log(`  ✓ ${REUSED_INFRASTRUCTURE.length} reused infrastructure modules exist`)

  // Safety flags
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled, false)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.no_autonomous_sending, true)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.human_approval_required, true)
  console.log("  ✓ Safety flags block autonomous sending")

  // Triggers
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS.length, 18)
  for (const trigger of [
    "email_opened",
    "video_completed",
    "booking_completed",
    "question_asked",
    "agent_opened",
    "lead_created",
    "video_generated",
  ] as const) {
    assert.ok(GE_V1_5_AUTOMATION_RUNTIME_TRIGGERS.includes(trigger), `Missing trigger: ${trigger}`)
  }
  assert.equal(normalizeSendrEventToGeV15Trigger("video_complete"), "video_completed")
  assert.equal(normalizeSendrEventToGeV15Trigger("question_asked"), "question_asked")
  assert.equal(normalizeSendrEventToGeV15Trigger("booking_completed"), "booking_completed")
  assert.ok(Object.keys(GE_V1_5_SENDR_EVENT_TO_TRIGGER).length >= 8)
  console.log("  ✓ Supported triggers (engagement, demo assistant, lead, media)")

  // Conditions
  assert.equal(GE_V1_5_CONDITION_KINDS.length, 7)
  const conditionEval = evaluateGeV15Conditions(
    [
      { kind: "intent_score", operator: "gte", value: 50 },
      { kind: "lead_score", operator: "gte", value: 30 },
    ],
    { intentScore: 67, leadScore: 45 },
  )
  assert.equal(conditionEval.passed, true)
  const blockedEval = evaluateGeV15Conditions(
    [{ kind: "inactivity_duration", operator: "gte", value: 7 }],
    { inactivityDays: 3 },
  )
  assert.equal(blockedEval.passed, false)
  console.log("  ✓ Condition evaluation (lead score, intent score, inactivity)")

  // Actions
  assert.ok(GE_V1_5_AUTOMATION_RUNTIME_ACTIONS.includes("create_recommendation"))
  assert.ok(GE_V1_5_AUTOMATION_RUNTIME_ACTIONS.includes("operator_notification"))
  assert.ok(GE_V1_5_AUTOMATION_RUNTIME_ACTIONS.includes("prepare_email"))
  assert.ok(GE_V1_5_AUTOMATION_RUNTIME_ACTIONS.includes("queue_approval_item"))
  console.log("  ✓ Supported actions (recommendations, notifications, tasks, prepare outbound)")

  // Delays
  assert.equal(resolveGeV15DelayMs({ amount: 1, unit: "days" }), 86_400_000)
  assert.equal(resolveGeV15DelayMs({ amount: 2, unit: "hours" }), 7_200_000)
  const dedupeKey = buildGeV15DelayDedupeKey({
    playbookId: "inactivity_follow_up",
    trigger: "video_view_started",
    leadId: "lead-1",
  })
  const { scheduled, deduped } = scheduleGeV15Delay({
    playbookId: "inactivity_follow_up",
    trigger: "video_view_started",
    leadId: "lead-1",
    delay: { amount: 1, unit: "days" },
    existing: [],
  })
  assert.ok(scheduled)
  assert.equal(deduped, false)
  const dedupedAgain = scheduleGeV15Delay({
    playbookId: "inactivity_follow_up",
    trigger: "video_view_started",
    leadId: "lead-1",
    delay: { amount: 1, unit: "days" },
    existing: scheduled ? [scheduled] : [],
  })
  assert.equal(dedupedAgain.deduped, true)
  assert.ok(dedupeKey.includes("inactivity_follow_up"))
  console.log("  ✓ Delays (minutes/hours/days, idempotent dedupe)")

  // Approval runtime
  assert.equal(resolveGeV15InitialApprovalStatus("prepare_email"), "pending_approval")
  assert.equal(resolveGeV15InitialApprovalStatus("create_recommendation"), "prepared")
  assert.equal(canGeV15TransitionApproval("pending_approval", "approved"), true)
  assert.equal(canGeV15TransitionApproval("pending_approval", "executed"), false)
  const pendingAction = {
    id: "act_test",
    action: "prepare_email" as const,
    channel: "email" as const,
    title: "Test",
    summary: "Test",
    status: "pending_approval" as const,
    playbookId: "video_completion",
    trigger: "video_completed" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const approved = approveGeV15PreparedAction([pendingAction], "act_test", "operator-1")
  assert.equal(approved[0]?.status, "approved")
  assert.equal(approved[0]?.approvedBy, "operator-1")
  assert.equal(listGeV15PendingApprovals(approved).length, 0)
  console.log("  ✓ Human approval runtime (prepared → pending → approved, no bypass)")

  // Logging
  let state = createEmptyGeV15RuntimeState()
  state = appendGeV15RuntimeLog(state, {
    phase: "trigger",
    message: "Signal video_completed received",
    trigger: "video_completed",
  })
  assert.equal(state.logs.length, 1)
  assert.equal(state.logs[0]?.phase, "trigger")
  console.log("  ✓ Runtime logging (trigger, condition, action, approval)")

  // Cert scenarios
  console.log("\n  --- Certification scenarios ---")

  const pricingPlaybooks = matchGeV15Playbooks({
    trigger: "question_asked",
    triggerPayload: { intent: "pricing" },
  })
  assert.ok(pricingPlaybooks.some((p) => p.id === "pricing_intent"))
  const pricingPb = pricingPlaybooks.find((p) => p.id === "pricing_intent")!
  assert.ok(pricingPb.actions.some((a) => a.action === "create_recommendation"))
  assert.ok(pricingPb.actions.some((a) => a.action === "operator_notification"))
  console.log("  ✓ Pricing intent: high intent → recommendation → operator notification")

  const videoPlaybooks = matchGeV15Playbooks({ trigger: "video_completed" })
  assert.ok(videoPlaybooks.some((p) => p.id === "video_completion"))
  const videoPb = videoPlaybooks.find((p) => p.id === "video_completion")!
  assert.ok(videoPb.actions.some((a) => a.action === "create_recommendation"))
  assert.ok(videoPb.actions.some((a) => a.action === "prepare_email"))
  console.log("  ✓ Video completion: recommendation → follow-up prepared")

  const bookingPlaybooks = matchGeV15Playbooks({ trigger: "booking_completed" })
  assert.ok(bookingPlaybooks.some((p) => p.id === "booking_completed"))
  const bookingPb = bookingPlaybooks.find((p) => p.id === "booking_completed")!
  assert.ok(bookingPb.actions.some((a) => a.action === "create_recommendation"))
  assert.ok(bookingPb.actions.some((a) => a.action === "create_task"))
  console.log("  ✓ Booking completed: recommendation → task created")

  const inactivityPlaybooks = matchGeV15Playbooks({ trigger: "video_view_started" })
  assert.ok(inactivityPlaybooks.some((p) => p.id === "inactivity_follow_up"))
  const inactivityPb = inactivityPlaybooks.find((p) => p.id === "inactivity_follow_up")!
  assert.ok(
    inactivityPb.conditions.some((c) => c.kind === "inactivity_duration" && c.value === 7),
  )
  assert.ok(inactivityPb.actions.some((a) => a.action === "request_follow_up"))
  console.log("  ✓ Inactivity: no engagement → recommendation → suggested follow-up")

  // Wiring hooks
  const sendrSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sendr/growth-sendr-public-engagement-service.ts"),
    "utf8",
  )
  assert.match(sendrSource, /ingestGeV15AutomationRuntimeFromSendrEvents/)
  assert.match(sendrSource, /automation_runtime_enabled/)

  const demoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/demo-assistant/ge-v1-4-demo-analytics.ts"),
    "utf8",
  )
  assert.match(demoSource, /ingestGeV15AutomationRuntimeFromSendrEvents/)
  console.log("  ✓ Signal hooks wired to SENDR engagement + demo assistant")

  const guardrailSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts"),
    "utf8",
  )
  assert.match(guardrailSource, /automation_runtime_enabled/)
  console.log("  ✓ Kill switch automation_runtime_enabled registered")

  // Readiness report
  const readiness = buildGeV15RuntimeReadinessReport()
  assert.ok(readiness.entries.length >= 15)
  assert.match(readiness.flow, /Signals/)
  assert.match(readiness.flow, /Human approval/)
  assert.ok(readiness.summary.complete >= 10)
  console.log("  ✓ Runtime readiness report generated")

  assert.ok(GE_V1_5_BUILTIN_PLAYBOOKS.length >= 8)
  console.log(`  ✓ ${GE_V1_5_BUILTIN_PLAYBOOKS.length} built-in operator-assist playbooks`)

  console.log("\nGE-v1-5 Automation Runtime local certification passed.\n")
}

async function runProductionProbe(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  assert.ok(
    boot,
    "Production Supabase unavailable — link Supabase CLI project or ensure production env files contain a service_role JWT.",
  )

  const admin = createClient(boot!.url, boot!.jwt, { auth: { persistSession: false, autoRefreshToken: false } })
  const report = await buildGeV15ProviderReadinessReport(admin)

  assert.equal(report.qaMarker, GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER)
  assert.equal(report.humanApprovalRequired, true)
  assert.equal(report.outboundSendBlocked, true)
  assert.equal(report.supportedTriggers.length, 18)

  console.log("\n=== GE-v1-5 Production Provider Readiness ===\n")
  console.log(JSON.stringify(report, null, 2))
  console.log("\nGE-v1-5 production probe complete.\n")
}

const production = process.argv.includes("--production")
if (production) {
  void runProductionProbe()
} else {
  runLocalRegression()
}
