/**
 * GE-AIOS-GROWTH-4A — Agent Framework Foundation certification.
 * Run: pnpm test:ge-aios-growth-4a-agent-framework
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AGENT_FRAMEWORK_QA_MARKER,
  GROWTH_AGENT_FRAMEWORK_RULE,
  GROWTH_AGENT_KINDS,
} from "../lib/growth/aios/growth/growth-agent-framework-types"
import {
  agentMayExecuteWorkflow,
  buildAgentPlanContext,
  buildAgentRunContractPreview,
  isAgentSchedulerActive,
  GROWTH_AGENT_KIND_PERMISSION_MAP,
  GROWTH_AGENT_SCHEDULER_RULE,
} from "../lib/growth/aios/growth/growth-agent-framework-permissions"
import { isRuntimePilotWorkflow } from "../lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import {
  GROWTH_AGENT_REGISTRY,
  listGrowthAgentDefinitions,
  resolveOwningAgentForWorkflow,
} from "../lib/growth/aios/growth/growth-agent-framework-registry"

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
  ]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log("[GE-AIOS-GROWTH-4A] Agent Framework Foundation certification")

assert.equal(GROWTH_AGENT_FRAMEWORK_QA_MARKER, "growth-aios-growth-4a-agent-framework-v1")
assert.match(GROWTH_AGENT_FRAMEWORK_RULE, /read-only|No autonomous execution/i)
assert.equal(GROWTH_AGENT_KINDS.length, 7)
assert.equal(GROWTH_AGENT_REGISTRY.length, 7)

assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-framework-types.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-framework-registry.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-framework-permissions.ts")
assertNoForbiddenPaths("lib/growth/aios/growth/growth-agent-framework-service.ts")

const uiSource = readSource("components/growth/ai-os/command-center/growth-ai-os-agent-framework-section.tsx")
assert.match(uiSource, /Agent Framework/)
assert.equal(uiSource.toLowerCase().includes("run agent"), false)

const missionPlanning = readSource("lib/growth/aios/ai-executive-mission-planning-review-service.ts")
assert.match(missionPlanning, /buildAgentPlanContext/)

for (const kind of GROWTH_AGENT_KINDS) {
  assert.ok(GROWTH_AGENT_KIND_PERMISSION_MAP[kind], `${kind} must have permission profile`)
}

const registrySnapshot = JSON.stringify(listGrowthAgentDefinitions())
const registrySnapshot2 = JSON.stringify(listGrowthAgentDefinitions())
assert.equal(registrySnapshot, registrySnapshot2, "Registry must be deterministic")
console.log("  ✓ Deterministic registry")

for (const agent of GROWTH_AGENT_REGISTRY) {
  assert.equal(agent.status, "disabled", `${agent.agentKind} must default to disabled`)
  assert.equal(agent.schedulerMode, "disabled", `${agent.agentKind} scheduler must be disabled`)
  assert.equal(agent.telemetry.providerCallCount, 0)
  assert.equal(agent.telemetry.outboundAttemptedCount, 0)
  assert.equal(agent.telemetry.coreMutationCount, 0)
  assert.equal(agent.capabilities.outboundBlocked, true)
  assert.equal(agent.capabilities.coreMutationBlocked, true)
}
console.log("  ✓ All agents disabled with zero side-effect telemetry")

const outreachBlocked = agentMayExecuteWorkflow({
  agentKind: "outreach_agent",
  workflowType: "outreach_generation",
})
assert.equal(outreachBlocked.allowed, false)
assert.ok(outreachBlocked.blockedReasons.some((r) => /outbound|not executable/i.test(r)))
console.log("  ✓ Outreach Agent blocked")

const revenueBlocked = agentMayExecuteWorkflow({
  agentKind: "revenue_operator_agent",
  workflowType: "approval",
})
assert.equal(revenueBlocked.allowed, false)
assert.ok(revenueBlocked.blockedReasons.some((r) => /cannot execute|recommendations only/i.test(r)))
console.log("  ✓ Revenue Operator cannot execute directly")

const executionPilot = buildAgentRunContractPreview({
  agentKind: "execution_agent",
  workflowType: "research_company",
})
assert.equal(isRuntimePilotWorkflow("research_company"), true)
assert.ok(
  executionPilot.blockedReasons.some((r) => /disabled|3C|pilot|dry-run|gate/i.test(r)) ||
    executionPilot.requiredGates.includes("runtime_pilot"),
)
console.log("  ✓ Execution Agent bound to 3C pilot rules")

const executionNonPilot = agentMayExecuteWorkflow({
  agentKind: "execution_agent",
  workflowType: "verify_email",
})
assert.equal(executionNonPilot.allowed, false)
console.log("  ✓ Execution Agent rejects non-pilot workflows")

assert.equal(isAgentSchedulerActive(), false)
assert.match(GROWTH_AGENT_SCHEDULER_RULE, /no background jobs|no cron/i)
console.log("  ✓ Scheduler placeholder — no jobs started")

const contract = buildAgentRunContractPreview({
  agentKind: "research_agent",
  workflowType: "research_company",
  leadId: "lead-cert-4a",
})
assert.ok(["run_preview", "run_blocked", "run_ready_for_dry_run", "run_not_allowed"].includes(contract.runStatus))
assert.equal(typeof contract.runId, "string")
console.log("  ✓ Run contracts generated read-only")

const planContext = buildAgentPlanContext({
  workflowType: "research_company",
  leadId: "lead-cert-4a",
})
assert.equal(planContext.owningAgentKind, "execution_agent")
assert.ok(planContext.requiredGates.includes("dry_run"))
console.log("  ✓ Mission planning agent context")

assert.equal(resolveOwningAgentForWorkflow("outreach_generation"), "outreach_agent")

console.log("[GE-AIOS-GROWTH-4A] Running 3C regression…")
const result = spawnSync("pnpm", ["test:ge-aios-growth-3c-runtime-pilot"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(result.status, 0, "3C regression failed")

console.log("[GE-AIOS-GROWTH-4A] PASS — agent framework certified")
