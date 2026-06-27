/**
 * GE-AI-3D-PROD-2 — Operator-Gated Adaptive Calibration certification.
 * Run: pnpm test:ge-ai-3d-prod-2-operator-gated-adaptive-calibration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { collectAdaptiveCalibrationApprovalItems } from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import {
  generateAdaptiveCalibrationProposalFromInsight,
  generateAdaptiveCalibrationProposalsFromInsights,
  validateAdaptiveCalibrationGuardrails,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-engine"
import { mapAdaptiveCalibrationProposalRow } from "../lib/growth/aios/learning/growth-adaptive-calibration-repository"
import { GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_OBJECTS } from "../lib/growth/aios/learning/growth-adaptive-calibration-schema-health"
import {
  buildAdaptiveCalibrationProposalIdempotencyKey,
  canTransitionAdaptiveCalibrationStatus,
  GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES,
  GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS,
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  GROWTH_ADAPTIVE_CALIBRATION_RULE,
  GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION,
  GROWTH_AIOS_GE_AI_3D_PROD_2_PHASE,
  type GrowthAdaptiveCalibrationProposal,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthLearningInsight } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import {
  enrichRevenueDirectorWithAdaptiveCalibration,
  fetchGrowthAdaptiveCalibrationReadModel,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-service"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "../lib/growth/aios/revenue-director/growth-revenue-director-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_GE_AI_3D_PROD_2_PHASE}] Operator-Gated Adaptive Calibration certification`)

assert.equal(
  GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION,
  "20271001240000_growth_ai_3d_prod_2_adaptive_calibration.sql",
)

const requiredFiles = [
  "lib/growth/aios/learning/growth-adaptive-calibration-types.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-engine.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-repository.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-schema-health.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-service.ts",
  `supabase/migrations/${GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION}`,
  "app/api/platform/growth/ai-os/adaptive-calibration/route.ts",
  "app/api/platform/growth/ai-os/adaptive-calibration/[id]/approve/route.ts",
  "app/api/platform/growth/ai-os/adaptive-calibration/[id]/reject/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-adaptive-calibration-section.tsx",
  "docs/GE-AI-3D-PROD-2_OPERATOR_GATED_ADAPTIVE_CALIBRATION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const migration = readSource(`supabase/migrations/${GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.adaptive_calibration_proposals"))
assert.ok(migration.includes("growth.adaptive_calibration_events"))
assert.ok(migration.includes("adaptive_calibration_proposals_idempotency_uidx"))
assert.ok(migration.includes("service_role"))
assert.ok(migration.includes("no automatic apply"))

const service = readSource("lib/growth/aios/learning/growth-adaptive-calibration-service.ts")
assert.ok(service.includes("syncAdaptiveCalibrationProposalsFromInsights"))
assert.ok(service.includes("approveAdaptiveCalibrationProposal"))
assert.ok(service.includes("applied: false"))
assert.equal(service.includes("applyAdaptiveCalibration"), false)
assert.equal(service.includes("updateIcp"), false)
assert.equal(service.includes("setChannelWeight"), false)
assert.equal(service.includes("mutateGrowthAutonomy"), false)
assert.equal(service.includes("runSequenceExecutionJob"), false)

const registry = readSource("lib/growth/aios/ai-event-registry.ts")
assert.ok(registry.includes(GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalCreated))
assert.ok(registry.includes(GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalApproved))
assert.ok(registry.includes(GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalRejected))

assert.equal(GROWTH_ADAPTIVE_CALIBRATION_SCHEMA_OBJECTS.length, 2)

const approveRoute = readSource("app/api/platform/growth/ai-os/adaptive-calibration/[id]/approve/route.ts")
const rejectRoute = readSource("app/api/platform/growth/ai-os/adaptive-calibration/[id]/reject/route.ts")
const getRoute = readSource("app/api/platform/growth/ai-os/adaptive-calibration/route.ts")
assert.ok(approveRoute.includes("requireGrowthOperatorAccess"))
assert.ok(rejectRoute.includes("requireGrowthOperatorAccess"))
assert.ok(approveRoute.includes("applied: false"))
assert.ok(rejectRoute.includes("applied: false"))
assert.ok(getRoute.includes("noAutoApply: true"))

const applyRoutePath = path.join(
  process.cwd(),
  "app/api/platform/growth/ai-os/adaptive-calibration/[id]/apply/route.ts",
)
if (fs.existsSync(applyRoutePath)) {
  const applyRoute = readSource("app/api/platform/growth/ai-os/adaptive-calibration/[id]/apply/route.ts")
  assert.ok(applyRoute.includes("requireGrowthOperatorAccess"))
  assert.ok(applyRoute.includes("autonomyMutated: false"))
  assert.ok(applyRoute.includes("outboundExecuted: false"))
} else {
  assert.equal(fs.existsSync(applyRoutePath), false, "Apply route deferred to PROD-3 when absent")
}

const hacEngine = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.ok(hacEngine.includes("collectAdaptiveCalibrationApprovalItems"))
assert.ok(hacEngine.includes('"adaptive_calibration"'))
assert.ok(hacEngine.includes('"review_recommendation"'))

const hacTypes = readSource("lib/growth/aios/approvals/growth-human-approval-center-types.ts")
assert.ok(hacTypes.includes('"adaptive_calibration"'))

assert.equal(
  buildAdaptiveCalibrationProposalIdempotencyKey({
    organizationId: "org-1",
    sourceInsightId: "ins-1",
  }),
  "calibration-proposal:org-1:ins-1",
)

assert.equal(canTransitionAdaptiveCalibrationStatus("proposed", "approved"), true)
assert.equal(canTransitionAdaptiveCalibrationStatus("approved", "applied"), true)
assert.equal(canTransitionAdaptiveCalibrationStatus("rejected", "approved"), false)

const highSampleInsight: GrowthLearningInsight = {
  id: "ins-high",
  organizationId: "org-1",
  insightType: "channel_performance",
  title: "SMS outperforming email",
  summary: "Advisory channel shift",
  recommendedAdjustment: "increase_weight",
  targetSystem: "communication_engine",
  confidence: 0.82,
  impact: 0.55,
  sampleSize: 5,
  evidence: [{ source: "email", label: "replyRate", value: 0.12 }],
  status: "advisory",
  generatedFromWindow: "2026-06-27",
  createdAt: "2026-06-27T12:00:00.000Z",
}

const lowSampleInsight: GrowthLearningInsight = {
  ...highSampleInsight,
  id: "ins-low",
  sampleSize: 1,
  status: "not_enough_data",
}

const weightProposal = generateAdaptiveCalibrationProposalFromInsight({
  organizationId: "org-1",
  generatedAt: "2026-06-27T12:00:00.000Z",
  insight: highSampleInsight,
})
assert.ok(weightProposal)
assert.equal(weightProposal?.proposalType, "adjust_weight")
assert.ok(weightProposal!.evidence.length > 0)
assert.equal(validateAdaptiveCalibrationGuardrails(weightProposal!).ok, true)

const monitorProposal = generateAdaptiveCalibrationProposalFromInsight({
  organizationId: "org-1",
  generatedAt: "2026-06-27T12:00:00.000Z",
  insight: lowSampleInsight,
})
assert.ok(monitorProposal)
assert.equal(monitorProposal?.proposalType, "monitor_only")

const blockedProposal: GrowthAdaptiveCalibrationProposal = {
  ...weightProposal!,
  sampleSize: 1,
  proposalType: "adjust_weight",
}
assert.equal(validateAdaptiveCalibrationGuardrails(blockedProposal).ok, false)

const oversizedDeltaProposal: GrowthAdaptiveCalibrationProposal = {
  ...weightProposal!,
  proposedChange: {
    ...weightProposal!.proposedChange,
    delta: GROWTH_ADAPTIVE_CALIBRATION_GUARDRAILS.maxWeightDelta + 0.1,
  },
}
assert.equal(validateAdaptiveCalibrationGuardrails(oversizedDeltaProposal).ok, false)

const generated = generateAdaptiveCalibrationProposalsFromInsights({
  organizationId: "org-1",
  generatedAt: "2026-06-27T12:00:00.000Z",
  insights: [highSampleInsight, lowSampleInsight],
})
assert.equal(generated.length, 2)

const proposalRow = {
  id: "prop-1",
  organization_id: "org-1",
  source_insight_id: "ins-high",
  target_system: "communication_engine",
  proposal_type: "adjust_weight",
  status: "proposed",
  title: "Calibration: SMS outperforming email",
  summary: "Advisory",
  proposed_change: { key: "sms_engagement_weight", currentValue: 0.3, proposedValue: 0.35, delta: 0.05 },
  evidence: [{ source: "learning_insight", label: "sampleSize", value: 5 }],
  confidence: 0.82,
  impact: 0.55,
  sample_size: 5,
  risk_level: "medium",
  requires_operator_approval: true,
  approved_by_user_id: null,
  approved_at: null,
  rejected_by_user_id: null,
  rejected_at: null,
  rejection_reason: null,
  idempotency_key: "calibration-proposal:org-1:ins-high",
  expires_at: "2026-07-04T12:00:00.000Z",
  created_at: "2026-06-27T12:00:00.000Z",
}
const mapped = mapAdaptiveCalibrationProposalRow(proposalRow)
assert.equal(mapped.targetSystem, "communication_engine")
assert.equal(mapped.review.requiresOperatorApproval, true)

const hacItems = collectAdaptiveCalibrationApprovalItems({
  organizationId: "org-1",
  generatedAt: "2026-06-27T12:00:00.000Z",
  approvalWorkOrders: [],
  executionPlanReviewQueue: [],
  needsAttention: [],
  metaRecommendations: [],
  priorityBindings: [],
  revenueOperatorOrchestrations: [],
  geV15Inbox: [],
  automationApprovals: [],
  sequenceJobs: [],
  aiVoiceSessions: [],
  humanExecutionApprovals: [],
  outreachPreparationRuns: [],
  meetingPreparationRuns: [],
  boundedAutonomousOutbound: null,
  adaptiveCalibrationProposals: [mapped],
})
assert.equal(hacItems.length, 1)
assert.equal(hacItems[0]?.source, "adaptive_calibration")
assert.equal(hacItems[0]?.actionType, "review_recommendation")

const emptyReadModelPromise = fetchGrowthAdaptiveCalibrationReadModel(null, {
  organizationId: "org-1",
  generatedAt: "2026-06-27T12:00:00.000Z",
})

async function runCertification(): Promise<void> {
const emptyReadModel = await emptyReadModelPromise
assert.equal(emptyReadModel.schemaReady, false)
assert.equal(emptyReadModel.noAutoApply, true)
assert.equal(emptyReadModel.proposals.length, 0)

const revenueEnriched = enrichRevenueDirectorWithAdaptiveCalibration({
  revenueDirector: {
    readOnly: true,
    qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
    generatedAt: "2026-06-27T12:00:00.000Z",
    rule: "rule",
    rankingFormula: "formula",
    executiveSummary: {
      revenueHealth: "on_pace",
      onPace: true,
      primaryFocus: null,
      headline: "test",
      shouldPauseOutbound: false,
      shouldIntervene: false,
    },
    objectiveHealth: [],
    kpis: {
      approvalBacklog: 0,
      activeAutonomousScopes: 0,
      blockedAutonomousScopes: 0,
      activeMissions: 0,
      stalledMissions: 0,
      humanReviewRequired: 0,
      communicationPlansGenerated: 0,
      eventBusHealthy: true,
    },
    resourceAllocation: {
      topObjectiveId: null,
      topObjectiveTitle: null,
      starvedBindingCount: 0,
      outboundActionsToday: 0,
      outboundDailyLimit: null,
      communicationTopChannel: null,
    },
    workflowRequests: [],
    bottlenecks: [],
    risks: [],
    escalations: [],
    recommendations: [],
    health: {
      agentHealthStatus: "healthy",
      eventBusStatus: "healthy",
      autonomyStatus: "enabled",
    },
    eventObservation: {
      subscriberId: "revenue_director_observer",
      eventsReceived: 0,
      lastEventType: null,
    },
  },
  calibration: {
    readOnly: true,
    advisoryOnly: true,
    noAutoApply: true,
    qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
    generatedAt: "2026-06-27T12:00:00.000Z",
    rule: GROWTH_ADAPTIVE_CALIBRATION_RULE,
    schemaReady: false,
    summary: {
      proposedCount: 1,
      approvedNotAppliedCount: 0,
      rejectedCount: 0,
      highestImpactTitle: mapped.title,
      targetSystemsAffected: ["communication_engine"],
      lastGeneratedAt: null,
    },
    proposals: [mapped],
  },
})
assert.ok(revenueEnriched.calibrationAdvisory)
assert.ok(revenueEnriched.recommendations.some((row) => row.source === "adaptive_calibration"))

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-adaptive-calibration-section.tsx")
assert.ok(ui.includes("data-qa-section=\"adaptive-calibration\""))
assert.ok(ui.includes("explicitly apply") || ui.includes("no automatic apply"))
assert.equal(ui.includes("Apply button"), false)

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("syncAdaptiveCalibrationProposalsFromInsights"))
assert.ok(commandCenterService.includes("adaptiveCalibration"))

console.log("[GE-AI-3D-PROD-2] Static certification passed (regression suites run separately)")
console.log("[GE-AI-3D-PROD-2] Operator-Gated Adaptive Calibration certification PASSED")
}

runCertification().catch((error) => {
  console.error(error)
  process.exit(1)
})
