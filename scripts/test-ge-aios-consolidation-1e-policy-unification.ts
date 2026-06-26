/**
 * GE-AIOS-CONSOLIDATION-1E — Policy evaluation unification certification.
 * Run: pnpm test:ge-aios-consolidation-1e-policy-unification
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  buildCommandCenterSafeModeFromPolicy,
  buildGrowthAiOsAutonomyPolicyReadModel,
  buildSchedulerBudgetLimitsFromPolicy,
  enrichRevenueOperatorWithAutonomyPolicy,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  GROWTH_AIOS_CONSOLIDATION_1E_PHASE,
  GROWTH_AI_OS_AUTONOMY_POLICY_EVALUATION_RULE,
} from "../lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import type { RevenueOperatorReadModel } from "../lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import { GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER } from "../lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_CONSOLIDATION_1E_PHASE}] Policy evaluation unification certification`)

assert.ok(GROWTH_AI_OS_AUTONOMY_POLICY_EVALUATION_RULE.includes("fetchGrowthAiOsAutonomyPolicyEvaluationContext"))

const requiredFiles = [
  "lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service.ts",
  "docs/GE-AIOS-CONSOLIDATION-1E_CERTIFICATION.md",
  "docs/GE-AIOS-CONSOLIDATION-1E_POLICY_UNIFICATION.md",
  "docs/GE-AIOS-CONSOLIDATION-1E_INFRASTRUCTURE_AUDIT.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}
console.log("  ✓ Required files present")

const legacyPolicyService = readSource("lib/growth/autonomy/growth-autonomy-policy-service.ts")
assert.ok(legacyPolicyService.includes("evaluateAutonomyCapabilityFromPolicyEngine"))
assert.equal(legacyPolicyService.includes("fetchGrowthAutonomySettings"), false)
assert.equal(legacyPolicyService.includes("getRuntimeKillSwitchStates"), false)
console.log("  ✓ evaluateAutonomyCapability delegates to policy engine")

const outboundPolicy = readSource("lib/growth/autonomy/growth-autonomy-outbound-send-policy.ts")
assert.ok(outboundPolicy.includes("evaluateAutonomyOutboundSendPolicyFromPolicyEngine"))
assert.equal(outboundPolicy.includes("fetchGrowthAutonomySettings"), false)
assert.equal(outboundPolicy.includes("getRuntimeKillSwitchStates"), false)
console.log("  ✓ evaluateAutonomyOutboundSendPolicy delegates to policy engine")

const evaluationService = readSource("lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service.ts")
assert.ok(evaluationService.includes("fetchGrowthAiOsAutonomyPolicyEvaluationContext"))
assert.equal(evaluationService.includes("fetchGrowthAutonomySettings"), false)
console.log("  ✓ Canonical evaluation service uses policy engine context only")

const engineService = readSource("lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service.ts")
assert.ok(engineService.includes("fetchGrowthAiOsAutonomyPolicyEvaluationContext"))
console.log("  ✓ Policy engine exposes evaluation context")

const schedulerService = readSource("lib/growth/aios/growth/growth-scheduler-readiness-service.ts")
assert.ok(schedulerService.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(schedulerService.includes("enrichSchedulerReadinessWithAutonomyPolicy"))
console.log("  ✓ Scheduler readiness service consumes policy engine")

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("buildCommandCenterSafeModeFromPolicy"))
assert.equal(commandCenterService.includes("getRuntimeKillSwitchStates"), false)
console.log("  ✓ Command Center safe mode from policy engine")

const pilotService = readSource("lib/growth/aios/growth/growth-autonomous-research-pilot-service.ts")
assert.ok(pilotService.includes("evaluateResearchPilotAutonomyPolicyGate"))
assert.match(pilotService, /runAutonomousResearchManualRefresh[\s\S]*evaluateResearchPilotAutonomyPolicyGate/)
console.log("  ✓ Research manual refresh uses policy gate")

const pilotActionRoute = readSource("app/api/platform/growth/ai-os/autonomous-research-pilot/action/route.ts")
assert.ok(pilotActionRoute.includes("policy_control_plane_required"))
assert.equal(pilotActionRoute.includes("applyGrowthAutonomousResearchPilotControl"), false)
console.log("  ✓ Pilot action API policy-gated (Growth Autonomy only)")

const enqueueRoute = readSource("app/api/platform/growth/ai-os/execution-runtime/enqueue/route.ts")
assert.equal(enqueueRoute.includes("runtimeOverride"), false)
assert.equal(enqueueRoute.includes("pilotOverride"), false)
assert.equal(enqueueRoute.includes("runtimeEnabled: z.boolean"), false)
console.log("  ✓ Runtime enqueue API has no request-body policy overrides")

const resumeRoute = readSource("app/api/platform/growth/ai-os/execution-runtime/[executionId]/action/route.ts")
assert.equal(resumeRoute.includes("runtimeEnabled: z.boolean"), false)
console.log("  ✓ Runtime resume API has no runtimeEnabled override")

const runtimeLifecycle = readSource(
  "lib/growth/aios/growth/growth-lead-research-execution-runtime-lifecycle-service.ts",
)
assert.ok(runtimeLifecycle.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(runtimeLifecycle.includes("evaluateRuntimeAutonomyPolicyGate"))
console.log("  ✓ Runtime validation uses policy engine")

const defaultSettings = buildDefaultGrowthAutonomySettings("org-cert-1e")
const policy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-cert-1e",
  generatedAt: "2026-06-25T12:00:00.000Z",
  settings: {
    ...defaultSettings,
    masterMode: "manual",
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: false,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: false,
  runtimePilotEnabled: false,
})

const safeMode = buildCommandCenterSafeModeFromPolicy(policy)
assert.equal(safeMode.emergencyStopActive, false)
assert.equal(safeMode.autonomyEnabled, true)
assert.equal(safeMode.killSwitches.autonomy_enabled, true)

const schedulerBudgets = buildSchedulerBudgetLimitsFromPolicy(policy)
assert.ok(schedulerBudgets.maxAgentPreviewsPerHour > 0)
console.log("  ✓ Policy-derived safe mode and scheduler budgets")

const revenueBase: RevenueOperatorReadModel = {
  qaMarker: GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
  generatedAt: "2026-06-25T12:00:00.000Z",
  rule: "rule",
  supervisorAgent: "revenue_operator_agent",
  schedulerActive: false,
  summary: { leadsEvaluated: 1, humanReviewRequired: 0, blocked: 0, executionReady: 0 },
  orchestrations: [
    {
      orchestrationId: "o1",
      evaluationTimestamp: "2026-06-25T12:00:00.000Z",
      leadId: "lead-1",
      companyId: null,
      companyName: "Co",
      currentLifecycleStage: "research",
      owningAgent: "research_agent",
      candidateAgents: ["research_agent"],
      orchestrationDecision: "handoff_to_qualification",
      recommendedNextAgent: "research_agent",
      confidence: 0.8,
      reasoning: "test",
      requiredGates: ["approval"],
      blockedReasons: [],
      escalationLevel: "none",
      recommendedNextAction: "test",
      handoffPreview: null,
    },
  ],
}

const blockedPolicy = buildGrowthAiOsAutonomyPolicyReadModel({
  organizationId: "org-cert-1e",
  generatedAt: "2026-06-25T12:00:00.000Z",
  settings: {
    ...defaultSettings,
    masterMode: "manual",
    capabilityToggles: { ...defaultSettings.capabilityToggles, research: false },
    killSwitches: {
      autonomyEnabled: true,
      autonomyOutboundEnabled: false,
      autonomyGenerationEnabled: false,
      autonomyObjectiveModeEnabled: false,
    },
  },
  runtimeEnabled: false,
  runtimePilotEnabled: false,
})

const enrichedRevenue = enrichRevenueOperatorWithAutonomyPolicy(revenueBase, blockedPolicy)
assert.ok(enrichedRevenue.orchestrations[0]?.policyBlockReasons?.length)
assert.ok(enrichedRevenue.orchestrations[0]?.policyEvaluationKeys?.length)
console.log("  ✓ Revenue Operator orchestrations annotated with policy blocks")

const regressionScripts = [
  "test:ge-aios-consolidation-1c-autonomy-control-plane",
  "test:ge-aios-consolidation-1b-information-architecture",
  "test:growth-autonomy-ge-auto-1a",
  "test:growth-autonomy-ge-auto-1c",
  "test:growth-autonomy-ge-auto-1e",
  "test:ge-aios-growth-5b-autonomous-research-agent",
  "test:ge-aios-growth-5a-scheduler-readiness",
  "test:ge-aios-5c-command-center-read-model-foundation",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_CONSOLIDATION_1E_PHASE}] PASS — policy evaluation unified (local)`)
