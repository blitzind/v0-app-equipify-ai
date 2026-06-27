/**
 * GE-AI-2I — Bounded Autonomous Outbound certification.
 * Run: pnpm test:ge-ai-2i-bounded-autonomous-outbound
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { AI_EVENT_REGISTRY } from "../lib/growth/aios/ai-event-registry"
import { collectAutonomousOutboundScopeApprovalItems } from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import {
  computeOutboundConsumption,
  evaluateBoundedOutboundGateMatrix,
  isLeadInApprovedAudience,
  isScopeExpired,
  isWithinScopeQuietHours,
  mapActionTypeToChannel,
  resolveTransportPath,
  synthesizeBoundedAutonomousOutboundReadModel,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import {
  clearAutonomousOutboundStoreForTests,
  upsertAutonomousOutboundScope,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-store"
import type { GrowthAutonomousOutboundScope } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GROWTH_AIOS_GE_AI_2I_PHASE,
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS,
  GROWTH_BOUNDED_AUTONOMOUS_OUTBOUND_RULE,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED } from "../lib/voice/voice-drops/types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function sampleScope(overrides: Partial<GrowthAutonomousOutboundScope> = {}): GrowthAutonomousOutboundScope {
  const now = "2026-06-25T14:00:00.000Z"
  return {
    id: "scope-1",
    organizationId: "org-1",
    source: "objective",
    sourceId: "obj-1",
    status: "active",
    approvedByUserId: "user-1",
    approvedAt: now,
    expiresAt: "2026-12-31T23:59:59.000Z",
    allowedChannels: ["email", "sms"],
    audience: { leadIds: ["lead-1", "lead-2"], maxAudienceSize: 100 },
    limits: {
      maxActionsTotal: 10,
      maxActionsPerDay: 5,
      maxActionsPerLead: 2,
      maxEmailsPerDay: 3,
      maxSmsPerDay: 2,
      quietHours: { timezone: "UTC", start: "22:00", end: "08:00" },
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
      onMeetingBooked: true,
      onManualPause: true,
    },
    policy: {
      autonomyCapability: "autonomous_outbound_actions",
      requiresHumanApproval: true,
      enforcementSource: "growth_ai_os_autonomy_policy_engine",
    },
    title: "Demo booking scope",
    summary: "Bounded outbound for qualified leads",
    voiceDropCertified: false,
    aiVoiceExplicitlyApproved: false,
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
    pausedAt: null,
    completedAt: null,
    blockedReason: null,
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2I_PHASE}] Bounded Autonomous Outbound certification`)

assert.equal(GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER, "growth-ge-ai-2i-bounded-autonomous-outbound-v1")
assert.ok(GROWTH_BOUNDED_AUTONOMOUS_OUTBOUND_RULE.includes("existing transport"))

const requiredFiles = [
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-types.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-service.ts",
  "lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-store.ts",
  "app/api/platform/growth/ai-os/bounded-autonomous-outbound/route.ts",
  "components/growth/ai-os/command-center/growth-ai-os-bounded-autonomous-outbound-section.tsx",
  "docs/GE-AI-2I_BOUNDED_AUTONOMOUS_OUTBOUND.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const orchestrator = readSource("lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts")
assert.ok(orchestrator.includes("runSequenceExecutionJob"))
assert.ok(orchestrator.includes("evaluateAutonomyOutboundSendPolicyFromPolicyEngine"))
assert.ok(orchestrator.includes("isEmailSuppressed"))
assert.ok(orchestrator.includes("publishGrowthAiEvent"))
assert.equal(orchestrator.includes("executeTransportSend"), false, "must not bypass sequence runtime")

const service = readSource("lib/growth/aios/outbound/growth-autonomous-outbound-scope-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("fetchBoundedAutonomousOutboundReadModel"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("boundedAutonomousOutbound"))

const approvalEngine = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.ok(approvalEngine.includes("collectAutonomousOutboundScopeApprovalItems"))
assert.ok(approvalEngine.includes("bounded_autonomous_outbound.scopes"))

const route = readSource("app/api/platform/growth/ai-os/bounded-autonomous-outbound/route.ts")
assert.equal(route.includes("POST"), false)
assert.equal(route.includes("PUT"), false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-bounded-autonomous-outbound-section.tsx")
assert.equal(panel.includes('method: "POST"'), false)

const coreForbidden = [
  "public.invoices",
  "public.quotes",
  "public.customers",
  "blitzpay",
  'from "@/app/(portal)',
]
for (const file of [
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-types.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-service.ts",
  "lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts",
]) {
  assertNoCoreTouch(file, coreForbidden)
}

for (const eventType of Object.values(GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES)) {
  assert.ok(AI_EVENT_REGISTRY.some((entry) => entry.eventType === eventType), `${eventType} registered`)
}

assert.equal(mapActionTypeToChannel("send_email"), "email")
assert.equal(mapActionTypeToChannel("send_sms"), "sms")
assert.equal(mapActionTypeToChannel("create_linkedin_manual_task"), "linkedin_manual")
assert.equal(resolveTransportPath("email"), GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.email)
assert.equal(resolveTransportPath("sms"), GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.sms)
assert.equal(resolveTransportPath("linkedin_manual"), GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.linkedin_manual)

assert.ok(isLeadInApprovedAudience(sampleScope(), "lead-1"))
assert.equal(isLeadInApprovedAudience(sampleScope(), "lead-999"), false)
assert.equal(isScopeExpired(sampleScope(), "2027-01-01T00:00:00.000Z"), true)

assert.equal(
  isWithinScopeQuietHours(sampleScope(), new Date("2026-06-25T23:00:00.000Z")),
  true,
  "23:00 UTC inside 22:00-08:00 quiet window",
)
assert.equal(
  isWithinScopeQuietHours(sampleScope(), new Date("2026-06-25T14:00:00.000Z")),
  false,
  "14:00 UTC outside quiet window",
)

const consumption = computeOutboundConsumption({
  scopeId: "scope-1",
  actions: [],
  dayStartIso: "2026-06-25T00:00:00.000Z",
})
assert.equal(consumption.actionsTotal, 0)

const allowed = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(allowed.allowed, true, "all gates pass for valid email action")

const noApproval = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope({ status: "draft" }),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(noApproval.allowed, false, "draft scope blocked")

const autonomyBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: false,
  autonomyReason: "Autonomous outbound disabled.",
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(autonomyBlocked.allowed, false)

const audienceBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-999",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(audienceBlocked.allowed, false)

const channelBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope({ allowedChannels: ["sms"] }),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(channelBlocked.allowed, false)

const capBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption: {
    actionsTotal: 10,
    actionsToday: 5,
    actionsByLead: { "lead-1": 2 },
    emailsToday: 3,
    smsToday: 0,
    voiceDropsToday: 0,
  },
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(capBlocked.allowed, false)

const quietBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T23:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(quietBlocked.allowed, false)

const suppressionBlockedEval = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: true,
  optOutBlocked: true,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(suppressionBlockedEval.allowed, false)

const stopBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope(),
  channel: "email",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: ["on_reply"],
})
assert.equal(stopBlocked.allowed, false)

const voiceDropBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope({ allowedChannels: ["voice_drop"] }),
  channel: "voice_drop",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
  voiceDropLiveCertified: false,
})
assert.equal(voiceDropBlocked.allowed, VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED === true ? false : true)

const aiVoiceBlocked = evaluateBoundedOutboundGateMatrix({
  scope: sampleScope({ allowedChannels: ["ai_voice"], aiVoiceExplicitlyApproved: false }),
  channel: "ai_voice",
  leadId: "lead-1",
  nowIso: "2026-06-25T14:00:00.000Z",
  consumption,
  autonomyAllowed: true,
  autonomyReason: null,
  suppressionBlocked: false,
  optOutBlocked: false,
  complianceBlocked: false,
  senderReady: true,
  activeStopConditions: [],
})
assert.equal(aiVoiceBlocked.allowed, false)

clearAutonomousOutboundStoreForTests()
const now = "2026-06-25T14:00:00.000Z"
upsertAutonomousOutboundScope({
  organizationId: "org-1",
  scope: sampleScope({ status: "active" }),
  now,
})

const readModel = synthesizeBoundedAutonomousOutboundReadModel({
  organizationId: "org-1",
  generatedAt: now,
  scopes: [sampleScope({ status: "active" })],
  actions: [],
  stopConditionTriggers: [],
  killSwitchStatus: {
    autonomyEnabled: true,
    autonomyOutboundEnabled: false,
    emergencyStopActive: false,
  },
  lastEventAt: null,
  lastEventType: null,
})
assert.equal(readModel.readOnly, true)
assert.equal(readModel.summary.activeScopes, 1)

const approvalItems = collectAutonomousOutboundScopeApprovalItems({
  organizationId: "org-1",
  generatedAt: now,
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
  boundedAutonomousOutbound: readModel,
})
assert.ok(approvalItems.some((item) => item.source === "autonomous_outbound_scope"))

console.log(`[${GROWTH_AIOS_GE_AI_2I_PHASE}] Running regression certifications...`)

const regressions = [
  "test:ge-ai-2b-event-bus-completion",
  "test:ge-ai-2h-human-approval-center",
  "test:ge-ai-2e-priority-engine-binding",
  "test:ge-ai-2f-meta-recommender",
  "test:prod-regression-6-command-center-import-stability",
  "test:ge-aios-5c-command-center-read-model-foundation",
]

for (const script of regressions) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2I_PHASE}] PASS — Bounded Autonomous Outbound certified (local)`)
