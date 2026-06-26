/**
 * GE-AIOS-GROWTH-4C — Agent Event & Scheduling Framework certification.
 * Run: pnpm test:ge-aios-growth-4c-agent-events
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AGENT_EVENT_QA_MARKER,
  GROWTH_AGENT_EVENT_RULE,
  GROWTH_AGENT_EVENT_TYPES,
} from "../lib/growth/aios/growth/growth-agent-event-types"
import {
  buildAgentEventPlanContext,
  buildAgentEventQueueItem,
  buildAgentEventRecord,
  buildAgentEventsReadModel,
  isAgentEventSchedulerActive,
  listSupportedSchedulerModes,
  mapAiOsEventTypeToAgentEventType,
  resolveAgentEventRouting,
} from "../lib/growth/aios/growth/growth-agent-event-engine"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoForbiddenPaths(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of [
    "createAiWorkOrder",
    "invokeAiOsProvider",
    "sendEmail",
    "sendSms",
    "executeTransportSend",
    "cron.schedule",
    "setInterval",
    "enqueueRuntime",
    "startWorkflow",
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function baseEvent(overrides: Partial<Parameters<typeof buildAgentEventRecord>[0]> = {}) {
  return buildAgentEventRecord({
    eventType: "lead_discovered",
    source: "plan_state",
    timestamp: "2026-06-25T00:00:00.000Z",
    leadId: "lead-cert-4c",
    companyName: "Cert Co",
    workflowType: "research_company",
    triggeringReason: "Certification fixture",
    ...overrides,
  })
}

console.log("[GE-AIOS-GROWTH-4C] Agent Event & Scheduling certification")

assert.equal(GROWTH_AGENT_EVENT_QA_MARKER, "growth-aios-growth-4c-agent-events-v1")
assert.match(GROWTH_AGENT_EVENT_RULE, /recommendation-only|Scheduler remains disabled/i)
assert.equal(GROWTH_AGENT_EVENT_TYPES.length, 15)
console.log("  ✓ QA marker and event types")

assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-event-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-event-engine.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-event-service.ts")
console.log("  ✓ No forbidden side-effect tokens")

const commandCenterUi = readSource(
  "components/growth/ai-os/command-center/growth-ai-os-agent-events-section.tsx",
)
assert.match(commandCenterUi, /Agent Events/)
assert.equal(commandCenterUi.toLowerCase().includes("run agent"), false)
console.log("  ✓ Command Center Agent Events section — no run controls")

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildGrowthAgentEventPlanContext/)
assert.match(missionPlanning, /agentEventContext/)

const missionPlanningUi = readSource(
  "components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx",
)
assert.match(missionPlanningUi, /agent-event-context/)
console.log("  ✓ Mission Planning Review agent event context")

assert.equal(mapAiOsEventTypeToAgentEventType("growth.execution_plan.review_changed"), "execution_plan_approved")
assert.equal(mapAiOsEventTypeToAgentEventType("growth.execution_runtime.lifecycle_changed"), "runtime_completed")
assert.equal(mapAiOsEventTypeToAgentEventType("executive.tick"), "daily_review")
console.log("  ✓ AI OS event bus mapping")

const researchRouting = resolveAgentEventRouting({ event: baseEvent({ eventType: "lead_discovered" }) })
assert.equal(researchRouting.routedAgent, "research_agent")
console.log("  ✓ lead_discovered → Research Agent")

const qualificationRouting = resolveAgentEventRouting({
  event: baseEvent({ eventType: "research_completed" }),
})
assert.equal(qualificationRouting.routedAgent, "qualification_agent")
console.log("  ✓ research_completed → Qualification Agent")

const planningRouting = resolveAgentEventRouting({
  event: baseEvent({ eventType: "qualification_completed" }),
})
assert.equal(planningRouting.routedAgent, "planning_agent")
console.log("  ✓ qualification_completed → Planning Agent")

const approvedRouting = resolveAgentEventRouting({
  event: baseEvent({ eventType: "execution_plan_approved" }),
})
assert.equal(approvedRouting.routedAgent, "revenue_operator_agent")
console.log("  ✓ execution_plan_approved → Revenue Operator")

const runtimeRouting = resolveAgentEventRouting({
  event: baseEvent({ eventType: "runtime_completed" }),
})
assert.equal(runtimeRouting.routedAgent, "revenue_operator_agent")
console.log("  ✓ runtime_completed → Revenue Operator")

const meetingRouting = resolveAgentEventRouting({
  event: baseEvent({ eventType: "meeting_booked", workflowType: "meeting_preparation" }),
})
assert.equal(meetingRouting.routedAgent, "meeting_agent")
console.log("  ✓ meeting_booked → Meeting Agent")

const outreachBlocked = resolveAgentEventRouting({
  event: baseEvent({
    eventType: "execution_plan_created",
    workflowType: "outreach_generation",
    blockedReasons: ["Outreach workflow — outbound blocked."],
  }),
})
assert.equal(outreachBlocked.queueStatus, "blocked")
console.log("  ✓ Outreach events blocked in queue")

const routingSnapshot = JSON.stringify(
  resolveAgentEventRouting({ event: baseEvent({ eventType: "dry_run_completed" }) }),
)
const routingSnapshot2 = JSON.stringify(
  resolveAgentEventRouting({ event: baseEvent({ eventType: "dry_run_completed" }) }),
)
assert.equal(routingSnapshot, routingSnapshot2, "Routing must be deterministic")
console.log("  ✓ Deterministic routing")

const queueItem = buildAgentEventQueueItem({
  event: baseEvent({ eventType: "execution_plan_approved" }),
  planState: {
    leadId: "lead-cert-4c",
    workflowType: "research_company",
    approvalStatus: "approved_for_future_execution",
    readinessState: "ready_for_future_execution",
    latestDryRunStatus: "dry_run_passed",
    generatedAt: "2026-06-25T00:00:00.000Z",
  },
})
assert.ok(queueItem.revenueOperator.recommendation.length > 0)
assert.equal(typeof queueItem.revenueOperator.escalationLevel, "string")
console.log("  ✓ Revenue Operator consumes event with recommendation")

const planContext = buildAgentEventPlanContext({ queueItem })
assert.ok(planContext)
assert.equal(planContext?.latestTriggeringEvent, "execution_plan_approved")
console.log("  ✓ Mission planning event context")

const readModel = buildAgentEventsReadModel({
  generatedAt: "2026-06-25T00:00:00.000Z",
  events: [
    baseEvent({ eventType: "lead_discovered" }),
    baseEvent({ eventType: "research_completed", leadId: "lead-2" }),
    baseEvent({
      eventType: "daily_review",
      source: "scheduler_placeholder",
      leadId: null,
      priority: "low",
    }),
  ],
})
assert.equal(readModel.schedulerActive, false)
assert.equal(readModel.schedulingMode, "disabled")
assert.ok(readModel.queue.pending.length >= 0)
assert.ok(readModel.queue.completedRecommendations.length >= 1)
console.log("  ✓ Read-only event queue partitions")

const schedulerModes = listSupportedSchedulerModes()
assert.ok(schedulerModes.includes("manual"))
assert.ok(schedulerModes.includes("event_driven"))
assert.ok(schedulerModes.includes("disabled"))
assert.equal(readModel.schedulingDefinitions.every((row) => row.schedulerActive === false), true)
console.log("  ✓ Scheduling modes defined — all inactive")

assert.equal(isAgentEventSchedulerActive(), false)
console.log("  ✓ Scheduler disabled — no background jobs")

console.log("[GE-AIOS-GROWTH-4C] Running 4B regression…")
const result = spawnSync("pnpm", ["test:ge-aios-growth-4b-revenue-operator"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(result.status, 0, "4B regression failed")

console.log("[GE-AIOS-GROWTH-4C] PASS — Agent Event & Scheduling Framework certified")
