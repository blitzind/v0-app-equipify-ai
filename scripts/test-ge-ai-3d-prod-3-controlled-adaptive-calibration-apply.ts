/**
 * GE-AI-3D-PROD-3 — Controlled Adaptive Calibration Apply certification.
 * Run: pnpm test:ge-ai-3d-prod-3-controlled-adaptive-calibration-apply
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  collectAdaptiveCalibrationReadyToApplyItems,
} from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import {
  buildConfigSnapshotAfter,
  validateCalibrationApplyProposal,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-apply-engine"
import { GROWTH_CALIBRATION_APPLY_SCHEMA_OBJECTS } from "../lib/growth/aios/learning/growth-adaptive-calibration-apply-schema-health"
import {
  buildCalibrationApplyIdempotencyKey,
  GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS,
  GROWTH_CALIBRATION_APPLY_EVENT_TYPES,
  GROWTH_CALIBRATION_APPLY_QA_MARKER,
  GROWTH_CALIBRATION_APPLY_RULE,
  GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION,
  GROWTH_AIOS_GE_AI_3D_PROD_3_PHASE,
  isCalibrationApplyTargetAllowed,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import {
  clearInMemoryCalibrationConfig,
  resolveCommunicationEngineWeights,
  resolveMetaRecommenderCoefficients,
  setInMemoryCalibrationConfig,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-config-resolver"
import { getDefaultCalibrationConfig } from "../lib/growth/aios/learning/growth-adaptive-calibration-config-registry"
import {
  calibrationApplySchemaCatalog,
  mapCalibrationActiveConfigRow,
  mapCalibrationVersionRow,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-version-repository"
import {
  buildCalibrationVersionAdvisory,
  enrichRevenueDirectorWithCalibrationApply,
} from "../lib/growth/aios/learning/growth-adaptive-calibration-apply-service"
import type { GrowthAdaptiveCalibrationProposal } from "../lib/growth/aios/learning/growth-adaptive-calibration-types"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "../lib/growth/aios/revenue-director/growth-revenue-director-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_GE_AI_3D_PROD_3_PHASE}] Controlled Adaptive Calibration Apply certification`)

assert.equal(
  GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION,
  "20271001250000_growth_ai_3d_prod_3_calibration_apply.sql",
)

const requiredFiles = [
  "lib/growth/aios/learning/growth-adaptive-calibration-apply-types.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-apply-engine.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-apply-service.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-version-repository.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-config-registry.ts",
  "lib/growth/aios/learning/growth-adaptive-calibration-config-resolver.ts",
  `supabase/migrations/${GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION}`,
  "app/api/platform/growth/ai-os/adaptive-calibration/[id]/apply/route.ts",
  "app/api/platform/growth/ai-os/adaptive-calibration/rollback/[rollbackToken]/route.ts",
  "docs/GE-AI-3D-PROD-3_CONTROLLED_ADAPTIVE_CALIBRATION_APPLY.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const migration = readSource(`supabase/migrations/${GROWTH_CALIBRATION_APPLY_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.calibration_config_versions"))
assert.ok(migration.includes("growth.calibration_active_config"))
assert.ok(migration.includes("growth.calibration_config_events"))
assert.ok(migration.includes("calibration_config_versions_idempotency_uidx"))
assert.ok(migration.includes("service_role"))

const applyService = readSource("lib/growth/aios/learning/growth-adaptive-calibration-apply-service.ts")
assert.ok(applyService.includes("applyApprovedCalibrationProposal"))
assert.ok(applyService.includes("rollbackCalibrationVersion"))
assert.equal(applyService.includes("mutateGrowthAutonomy"), false)
assert.equal(applyService.includes("runSequenceExecutionJob"), false)
assert.equal(applyService.includes("updateIcp"), false)

const applyRoute = readSource("app/api/platform/growth/ai-os/adaptive-calibration/[id]/apply/route.ts")
const rollbackRoute = readSource("app/api/platform/growth/ai-os/adaptive-calibration/rollback/[rollbackToken]/route.ts")
assert.ok(applyRoute.includes("requireGrowthOperatorAccess"))
assert.ok(rollbackRoute.includes("requireGrowthOperatorAccess"))
assert.ok(applyRoute.includes("autonomyMutated: false"))
assert.ok(rollbackRoute.includes("outboundExecuted: false"))

const registry = readSource("lib/growth/aios/ai-event-registry.ts")
assert.ok(registry.includes(GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationApplied))
assert.ok(registry.includes(GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationRolledBack))
assert.ok(registry.includes(GROWTH_CALIBRATION_APPLY_EVENT_TYPES.calibrationApplyFailed))
assert.ok(registry.includes(GROWTH_CALIBRATION_APPLY_EVENT_TYPES.versionCreated))

assert.equal(GROWTH_CALIBRATION_APPLY_SCHEMA_OBJECTS.length, 3)
assert.deepEqual(calibrationApplySchemaCatalog().tables, [
  "calibration_config_versions",
  "calibration_active_config",
  "calibration_config_events",
])

assert.equal(isCalibrationApplyTargetAllowed("communication_engine"), true)
assert.equal(isCalibrationApplyTargetAllowed("icp_learning"), false)
assert.equal(isCalibrationApplyTargetAllowed("revenue_director"), false)

const approvedProposal: GrowthAdaptiveCalibrationProposal = {
  id: "prop-1",
  organizationId: "org-1",
  sourceInsightId: "ins-1",
  targetSystem: "communication_engine",
  proposalType: "adjust_weight",
  status: "approved",
  title: "Calibration: SMS outperforming email",
  summary: "Advisory",
  proposedChange: {
    key: "sms_engagement_weight",
    currentValue: 0.3,
    proposedValue: 0.35,
    delta: 0.05,
  },
  evidence: [{ source: "learning_insight", label: "sampleSize", value: 5 }],
  confidence: 0.82,
  impact: 0.55,
  sampleSize: 5,
  riskLevel: "medium",
  review: { requiresOperatorApproval: true },
  createdAt: "2026-06-27T12:00:00.000Z",
}

const proposedOnly = { ...approvedProposal, status: "proposed" as const }
assert.equal(validateCalibrationApplyProposal({ proposal: proposedOnly, currentConfig: getDefaultCalibrationConfig("communication_engine") }).ok, false)

const validation = validateCalibrationApplyProposal({
  proposal: approvedProposal,
  currentConfig: getDefaultCalibrationConfig("communication_engine"),
})
assert.equal(validation.ok, true)

const blockedTarget = { ...approvedProposal, targetSystem: "icp_learning" as const }
assert.equal(
  validateCalibrationApplyProposal({
    proposal: blockedTarget,
    currentConfig: getDefaultCalibrationConfig("communication_engine"),
  }).ok,
  false,
)

const snapshotAfter = buildConfigSnapshotAfter({
  targetSystem: "communication_engine",
  currentConfig: getDefaultCalibrationConfig("communication_engine"),
  proposal: approvedProposal,
  key: "sms_engagement_weight",
})
assert.equal(snapshotAfter.sms_engagement_weight, 0.35)

assert.equal(
  buildCalibrationApplyIdempotencyKey({ organizationId: "org-1", proposalId: "prop-1" }),
  "calibration-apply:org-1:prop-1",
)

const versionRow = {
  id: "ver-1",
  organization_id: "org-1",
  proposal_id: "prop-1",
  target_system: "communication_engine",
  version_number: 1,
  version_kind: "apply",
  status: "applied",
  config_snapshot_before: { sms_engagement_weight: 0.3 },
  config_snapshot_after: { sms_engagement_weight: 0.35 },
  rollback_token: "rollback:org-1:prop-1:123",
  previous_version_id: null,
  applied_by_user_id: "user-1",
  applied_at: "2026-06-27T12:00:00.000Z",
  confidence: 0.82,
  impact: 0.55,
  idempotency_key: "calibration-apply:org-1:prop-1",
  event_correlation_id: "corr-1",
  created_at: "2026-06-27T12:00:00.000Z",
}
const mappedVersion = mapCalibrationVersionRow(versionRow)
assert.equal(mappedVersion.targetSystem, "communication_engine")
assert.equal(mappedVersion.configSnapshotAfter.sms_engagement_weight, 0.35)

const activeRow = {
  id: "active-1",
  organization_id: "org-1",
  target_system: "communication_engine",
  config: { sms_engagement_weight: 0.35 },
  active_version_id: "ver-1",
  updated_at: "2026-06-27T12:00:00.000Z",
}
assert.equal(mapCalibrationActiveConfigRow(activeRow).config.sms_engagement_weight, 0.35)

clearInMemoryCalibrationConfig()
setInMemoryCalibrationConfig({
  organizationId: "org-1",
  targetSystem: "meta_recommender",
  config: { impact_coefficient: 0.4 },
})
const metaCoeffs = resolveMetaRecommenderCoefficients({ organizationId: "org-1" })
assert.equal(metaCoeffs.impact, 0.4)
const commWeights = resolveCommunicationEngineWeights({ organizationId: "org-1" })
assert.equal(commWeights.engagement, 0.3)
clearInMemoryCalibrationConfig()

const hacItems = collectAdaptiveCalibrationReadyToApplyItems({
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
  adaptiveCalibrationProposals: [approvedProposal],
})
assert.equal(hacItems.length, 1)
assert.ok(hacItems[0]?.title.includes("Ready to apply"))

const applyReadModel = {
  readOnly: true as const,
  qaMarker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
  generatedAt: "2026-06-27T12:00:00.000Z",
  rule: GROWTH_CALIBRATION_APPLY_RULE,
  schemaReady: true,
  activeVersions: [mapCalibrationActiveConfigRow(activeRow)],
  recentVersions: [mappedVersion],
  summary: {
    activeCalibrationCount: 1,
    readyToApplyCount: 1,
    rollbackAvailableCount: 1,
    lastAppliedAt: mappedVersion.appliedAt,
    lastAppliedByUserId: "user-1",
    lastAppliedTargetSystem: "communication_engine" as const,
    lastAppliedConfidence: 0.82,
  },
}

const versionAdvisory = buildCalibrationVersionAdvisory({
  applyReadModel,
  readyToApplyProposalIds: ["prop-1"],
})
assert.ok(versionAdvisory.rollbackAvailable)
assert.equal(versionAdvisory.pendingApplyProposalIds.length, 1)

const revenueEnriched = enrichRevenueDirectorWithCalibrationApply({
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
  applyReadModel,
  readyToApplyProposalIds: ["prop-1"],
})
assert.ok(revenueEnriched.calibrationVersionAdvisory)

const ui = readSource("components/growth/ai-os/command-center/growth-ai-os-adaptive-calibration-section.tsx")
assert.ok(ui.includes("Ready to apply"))
assert.ok(ui.includes("Rollback available"))
assert.equal(ui.includes("Apply button"), false)

const hacEngine = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.ok(hacEngine.includes("collectAdaptiveCalibrationReadyToApplyItems"))

assert.ok(GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS.includes("communication_engine"))
assert.ok(!GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS.includes("icp_learning" as never))

console.log("[GE-AI-3D-PROD-3] Static certification passed (regression suites run separately)")
console.log("[GE-AI-3D-PROD-3] Controlled Adaptive Calibration Apply certification PASSED")
