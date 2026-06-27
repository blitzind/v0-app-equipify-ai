/**
 * GE-AI-2K — Communication Engine foundation certification.
 * Run: pnpm test:ge-ai-2k-communication-engine
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  rankCommunicationChannels,
  resolveBoundedOutboundActionFromPlan,
  scoreCommunicationChannel,
  synthesizeGrowthCommunicationEngineReadModel,
  synthesizeGrowthCommunicationPlan,
} from "../lib/growth/aios/communication/growth-communication-engine-engine"
import {
  GROWTH_AIOS_GE_AI_2K_PHASE,
  GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES,
  GROWTH_COMMUNICATION_ENGINE_QA_MARKER,
  GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA,
  GROWTH_COMMUNICATION_ENGINE_RUNTIME_RULE,
} from "../lib/growth/aios/communication/growth-communication-engine-types"
import { buildAutonomousOutboundScopeRow } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import type { GrowthAutonomousOutboundScope } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2K_PHASE}] Communication Engine foundation certification`)

assert.equal(GROWTH_COMMUNICATION_ENGINE_QA_MARKER, "growth-ge-ai-2k-communication-engine-v1")
assert.ok(GROWTH_COMMUNICATION_ENGINE_RUNTIME_RULE.includes("read-only"))
assert.ok(GROWTH_COMMUNICATION_ENGINE_RANKING_FORMULA.includes("0.30"))
assert.equal(isRegisteredAiEventType(GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated), true)

const requiredFiles = [
  "lib/growth/aios/communication/growth-communication-engine-types.ts",
  "lib/growth/aios/communication/growth-communication-engine-engine.ts",
  "lib/growth/aios/communication/growth-communication-engine-service.ts",
  "app/api/platform/growth/ai-os/communication-plan/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-communication-engine-section.tsx",
  "docs/GE-AI-2K_COMMUNICATION_ENGINE_FOUNDATION.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/communication/growth-communication-engine-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("buildGrowthCommunicationEngineReadModel"))
assert.ok(service.includes("requestGrowthCommunicationPlan"))
assert.equal(service.includes("transitionAiWorkOrder"), false)
assert.equal(service.includes("send-sms"), false)
assert.equal(service.includes("runSequenceExecutionJob"), false)

const engine = readSource("lib/growth/aios/communication/growth-communication-engine-engine.ts")
assert.equal(engine.includes('import "server-only"'), false)
assert.ok(engine.includes("synthesizeGrowthCommunicationPlan"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("buildGrowthCommunicationEngineReadModel"))
assert.ok(commandCenterService.includes("communicationEngine"))

const commandCenterTypes = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(commandCenterTypes.includes("communicationEngine: GrowthCommunicationEngineReadModel"))

const communicationRoute = readSource("app/api/platform/growth/ai-os/communication-plan/route.ts")
assert.ok(communicationRoute.includes("requireGrowthEnginePlatformAccess(request)"))
assert.equal(communicationRoute.includes("POST"), false)
assert.equal(communicationRoute.includes("PUT"), false)
assert.equal(communicationRoute.includes("PATCH"), false)
assert.equal(communicationRoute.includes("DELETE"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx")
assert.ok(panel.includes("communicationEngine={model.communicationEngine}"))

const operationsUi = readSource("components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx")
assert.ok(operationsUi.includes("GrowthAiOsCommunicationEngineSection"))

const outreachDraft = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
assert.ok(outreachDraft.includes("requestGrowthCommunicationPlan"))
assert.ok(outreachDraft.includes("resolveCommunicationPlanRecommendedChannel"))

const approvalEngine = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.ok(approvalEngine.includes("communication_engine"))
assert.ok(approvalEngine.includes("Primary channel"))

const commUi = readSource("components/growth/ai-os/command-center/growth-ai-os-communication-engine-section.tsx")
assert.equal(commUi.includes('method: "POST"'), false)
assert.equal(commUi.includes("Approve"), false)
assert.equal(commUi.includes("Send"), false)

const generatedAt = "2026-06-25T12:00:00.000Z"
const orgId = "org-2k-cert"
const baseInput = {
  organizationId: orgId,
  subject: { type: "lead" as const, id: "lead-1" },
  generatedAt,
}

const planA = synthesizeGrowthCommunicationPlan(baseInput)
const planB = synthesizeGrowthCommunicationPlan(baseInput)
assert.equal(planA.id, planB.id, "plans must be deterministic")
assert.ok(planA.evidence.length > 0)
assert.equal(planA.stopConditions.onReply, true)
assert.equal(planA.stopConditions.onOptOut, true)

const emailScore = scoreCommunicationChannel("email", {
  emailReady: true,
  smsReady: true,
  senderReady: true,
  engagementScore: 50,
})
const smsScore = scoreCommunicationChannel("sms", {
  emailReady: true,
  smsReady: true,
  senderReady: true,
  engagementScore: 50,
})
assert.ok(emailScore.score > 0)
assert.ok(smsScore.score > 0)
assert.equal(emailScore.blocked, false)
assert.equal(smsScore.blocked, false)

const smsFirstPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    emailReady: true,
    smsReady: true,
    senderReady: true,
    engagementScore: 80,
    metaRecommendationType: "sms",
    scopeAllowedChannels: ["email", "sms"],
  },
})
assert.equal(smsFirstPlan.recommendedStrategy, "sms_first")

const emailFirstPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    emailReady: true,
    smsReady: true,
    senderReady: true,
    engagementScore: 60,
    metaRecommendationType: "email",
    scopeAllowedChannels: ["email", "sms"],
  },
})
assert.equal(emailFirstPlan.recommendedStrategy, "email_first")

const dncPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: { suppressionBlocked: true, optOutBlocked: true },
})
assert.equal(dncPlan.recommendedStrategy, "do_not_contact")

const blockedFallbackPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    emailReady: true,
    smsReady: true,
    senderReady: true,
    metaRecommendationType: "email",
    scopeAllowedChannels: ["email", "sms"],
  },
})
const outboundResolution = resolveBoundedOutboundActionFromPlan({
  plan: blockedFallbackPlan,
  scopeAllowedChannels: ["email", "sms"],
  gateBlockedChannels: ["email"],
})
assert.equal(outboundResolution.usedFallback, true)
assert.equal(outboundResolution.preferredChannel, "sms")

const quietHoursPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    emailReady: true,
    smsReady: true,
    senderReady: true,
    quietHoursActive: true,
    scopeAllowedChannels: ["email"],
  },
})
assert.equal(quietHoursPlan.steps[0]?.timing.mode, "delay")
assert.equal(quietHoursPlan.steps[0]?.timing.delayHours, 8)

const replyPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: { replyReceived: true, positiveIntent: true, emailReady: true, smsReady: true },
})
assert.equal(replyPlan.recommendedStrategy, "wait")
assert.equal(replyPlan.goal, "book_meeting")

const engagementPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: { engagementScore: 85, emailReady: true, smsReady: true, scopeAllowedChannels: ["email", "sms"] },
})
const ranked = rankCommunicationChannels({
  engagementScore: 85,
  emailReady: true,
  smsReady: true,
  scopeAllowedChannels: ["email", "sms"],
})
assert.equal(ranked[0]?.channel, "sms")

const autonomyBlockedPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    autonomyOutboundEnabled: false,
    scopeAllowedChannels: ["email", "sms"],
    emailReady: true,
    smsReady: true,
  },
})
assert.ok(
  autonomyBlockedPlan.policy.blockedChannels.some((row) =>
    row.reason.includes("Growth Autonomy outbound disabled"),
  ),
)

const aiVoicePlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: { scopeAllowedChannels: ["email", "ai_voice"], emailReady: true },
})
assert.ok(aiVoicePlan.policy.blockedChannels.some((row) => row.channel === "ai_voice"))

const aiVoiceAllowedPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    aiVoiceExplicitlyAllowed: true,
    scopeAllowedChannels: ["ai_voice", "email"],
    emailReady: true,
  },
})
assert.equal(
  aiVoiceAllowedPlan.policy.blockedChannels.some((row) => row.channel === "ai_voice"),
  false,
)

const linkedInStep = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: { emailReady: true, smsReady: true, scopeAllowedChannels: ["email", "sms", "linkedin_manual"] },
}).steps.find((step) => step.channel === "linkedin_manual")
assert.ok(linkedInStep)
assert.equal(linkedInStep.actionType, "create_linkedin_task")

const voiceDropPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: { voiceDropCertified: false, scopeAllowedChannels: ["voice_drop", "email"], emailReady: true },
})
assert.ok(voiceDropPlan.policy.blockedChannels.some((row) => row.channel === "voice_drop"))

const videoPlan = synthesizeGrowthCommunicationPlan({
  ...baseInput,
  context: {
    engagementScore: 75,
    metaRecommendationType: "video",
    scopeAllowedChannels: ["video", "sendr", "email"],
    emailReady: true,
  },
})
assert.ok(videoPlan.steps.some((step) => step.channel === "video" || step.channel === "sendr"))
assert.equal(engine.includes("runSequenceExecutionJob"), false)

const scopeFixture: GrowthAutonomousOutboundScope = {
  id: "scope-2k",
  organizationId: orgId,
  status: "active",
  source: "objective",
  sourceId: "obj-1",
  title: "Cert scope",
  summary: "Cert",
  approvedByUserId: "operator-1",
  approvedAt: generatedAt,
  audience: { leadIds: ["lead-1"] },
  allowedChannels: ["email", "sms"],
  limits: {
    maxActionsTotal: 10,
    maxActionsPerDay: 5,
    maxActionsPerLead: 2,
    quietHours: { timezone: "America/New_York", start: "21:00", end: "08:00" },
  },
  requiredChecks: {
    growthAutonomy: true,
    humanApproval: true,
    suppression: true,
    senderReadiness: true,
    compliance: true,
    optOut: true,
    budget: true,
  },
  stopConditions: {
    onReply: true,
    onPositiveIntent: true,
    onNegativeIntent: true,
    onBounce: true,
    onUnsubscribe: true,
    onMeetingBooked: true,
    onManualPause: true,
  },
  policy: {
    requiresHumanApproval: true,
    autonomyCapability: "email_execution",
    enforcementSource: "growth_autonomy",
  },
  voiceDropCertified: false,
  aiVoiceExplicitlyApproved: false,
  createdAt: generatedAt,
  updatedAt: generatedAt,
  activatedAt: generatedAt,
  pausedAt: null,
  completedAt: null,
  blockedReason: null,
  expiresAt: "2027-01-01T00:00:00.000Z",
}

const scopeRow = buildAutonomousOutboundScopeRow({
  scope: scopeFixture,
  actions: [],
  stopConditionTriggers: [],
  dayStartIso: generatedAt,
  generatedAt,
})
assert.ok(scopeRow.communicationPlanSummary)
assert.ok(scopeRow.communicationPlanSummary.primaryChannel)

const readModel = synthesizeGrowthCommunicationEngineReadModel({
  organizationId: orgId,
  generatedAt,
  subjects: [{ subject: { type: "lead", id: "lead-1" }, context: { emailReady: true, smsReady: true } }],
})
assert.equal(readModel.qaMarker, GROWTH_COMMUNICATION_ENGINE_QA_MARKER)
assert.ok(readModel.plans.length > 0)

for (const file of [
  "lib/growth/aios/communication/growth-communication-engine-engine.ts",
  "lib/growth/aios/communication/growth-communication-engine-service.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "send-sms", "transitionAiWorkOrder"])
}

const regressionScripts = [
  "test:ge-ai-2i-prod-3-gated-operator-activation",
  "test:ge-ai-2i-prod-2-autonomous-outbound-integration",
  "test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes",
  "test:ge-ai-2i-bounded-autonomous-outbound",
  "test:ge-ai-2b-event-bus-completion",
  "test:ge-ai-2h-human-approval-center",
  "test:ge-ai-2e-priority-engine-binding",
  "test:ge-ai-2f-meta-recommender",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2K_PHASE}] PASS — Communication Engine foundation certified (local)`)
