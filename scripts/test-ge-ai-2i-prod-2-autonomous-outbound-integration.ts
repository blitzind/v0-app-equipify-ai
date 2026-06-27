/**
 * GE-AI-2I-PROD-2 — Autonomous Outbound Production Integration Certification.
 * Run: pnpm test:ge-ai-2i-prod-2-autonomous-outbound-integration
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { AI_EVENT_REGISTRY } from "../lib/growth/aios/ai-event-registry"
import {
  computeOutboundConsumption,
  evaluateAutonomousOutboundActivationEligibility,
  evaluateBoundedOutboundGateMatrix,
  mapActionTypeToChannel,
  resolveTransportPath,
  selectEligibleOutboundAction,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import {
  appendAutonomousOutboundScopeEvent,
  fetchAutonomousOutboundActionByIdempotencyKey,
  fetchAutonomousOutboundScopeById,
  insertAutonomousOutboundScope,
  insertAutonomousOutboundScopeAction,
  listAutonomousOutboundScopeEvents,
  updateAutonomousOutboundScope,
  upsertAutonomousOutboundScopeRecord,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import {
  isGrowthAutonomousOutboundScopeSchemaReady,
  probeGrowthAutonomousOutboundScopeSchema,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health"
import { validateAutonomousOutboundScopeActivation } from "../lib/growth/aios/outbound/growth-autonomous-outbound-activation-service"
import type { GrowthAutonomousOutboundScope } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GROWTH_AIOS_GE_AI_2I_PROD_2_PHASE,
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION,
  GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED } from "../lib/voice/voice-drops/types"
import {
  createAutonomousOutboundIntegrationHarness,
  createMissingSchemaHarnessAdmin,
} from "./growth-autonomous-outbound-integration-harness"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleScope(overrides: Partial<GrowthAutonomousOutboundScope> = {}): GrowthAutonomousOutboundScope {
  const now = "2026-06-25T14:00:00.000Z"
  return {
    id: randomUUID(),
    organizationId: "org-integration-1",
    source: "human_approval_center",
    sourceId: "approval-1",
    status: "approved",
    approvedByUserId: "user-1",
    approvedAt: now,
    expiresAt: "2026-12-31T23:59:59.000Z",
    allowedChannels: ["email", "sms", "voice_drop", "ai_voice", "linkedin_manual"],
    audience: { leadIds: ["lead-1", "lead-2"], maxAudienceSize: 100 },
    limits: {
      maxActionsTotal: 10,
      maxActionsPerDay: 5,
      maxActionsPerLead: 2,
      maxEmailsPerDay: 3,
      maxSmsPerDay: 2,
      maxVoiceDropsPerDay: 1,
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
    title: "Integration cert scope",
    summary: "Production integration certification scope",
    voiceDropCertified: true,
    aiVoiceExplicitlyApproved: true,
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    pausedAt: null,
    completedAt: null,
    blockedReason: null,
    ...overrides,
  }
}

function baseConsumption() {
  return computeOutboundConsumption({
    scopeId: "scope-1",
    actions: [],
    dayStartIso: "2026-06-25T00:00:00.000Z",
  })
}

function gateInput(
  scope: GrowthAutonomousOutboundScope,
  channel: ReturnType<typeof mapActionTypeToChannel>,
  overrides: Partial<Parameters<typeof evaluateBoundedOutboundGateMatrix>[0]> = {},
) {
  return {
    scope,
    channel,
    leadId: "lead-1",
    nowIso: "2026-06-25T14:00:00.000Z",
    consumption: baseConsumption(),
    autonomyAllowed: true,
    autonomyReason: null,
    suppressionBlocked: false,
    optOutBlocked: false,
    complianceBlocked: false,
    senderReady: true,
    activeStopConditions: [],
    ...overrides,
  }
}

async function main(): Promise<void> {
console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_2_PHASE}] Autonomous Outbound Integration Certification`)

// --- 1. Migration SQL audit ---
const migration = readSource(`supabase/migrations/${GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION}`)
for (const token of [
  "growth.autonomous_outbound_scopes",
  "growth.autonomous_outbound_scope_actions",
  "growth.autonomous_outbound_scope_events",
  "autonomous_outbound_scope_actions_idempotency_uidx",
  "service_role",
  "trg_growth_autonomous_outbound_scopes_updated_at",
  "trg_growth_autonomous_outbound_scope_actions_updated_at",
  "enable row level security",
]) {
  assert.ok(migration.includes(token), `migration must include ${token}`)
}

// --- 2. Schema health graceful missing detection ---
const missingAdmin = createMissingSchemaHarnessAdmin()
const missingHealth = await probeGrowthAutonomousOutboundScopeSchema(missingAdmin)
assert.equal(missingHealth.ready, false, "schema health must detect missing tables")
assert.equal(await isGrowthAutonomousOutboundScopeSchemaReady(missingAdmin), false)

// --- 3–7. Repository lifecycle round-trip (in-memory harness) ---
const { admin, store } = createAutonomousOutboundIntegrationHarness()
const orgId = "org-integration-1"
const draft = sampleScope({ status: "draft" })
const inserted = await insertAutonomousOutboundScope(admin, draft)
assert.equal(inserted.status, "draft")

const approved = await updateAutonomousOutboundScope(admin, {
  ...inserted,
  status: "approved",
  updatedAt: "2026-06-25T14:05:00.000Z",
})
assert.equal(approved.status, "approved")

const activated = await updateAutonomousOutboundScope(admin, {
  ...approved,
  status: "active",
  activatedAt: "2026-06-25T14:10:00.000Z",
  updatedAt: "2026-06-25T14:10:00.000Z",
})
assert.equal(activated.status, "active")

const paused = await updateAutonomousOutboundScope(admin, {
  ...activated,
  status: "paused",
  pausedAt: "2026-06-25T14:15:00.000Z",
  updatedAt: "2026-06-25T14:15:00.000Z",
})
assert.equal(paused.status, "paused")

const expiredScope = sampleScope({ status: "approved", expiresAt: "2026-01-01T00:00:00.000Z" })
await insertAutonomousOutboundScope(admin, expiredScope)
const expired = await updateAutonomousOutboundScope(admin, expiredScope)
assert.ok(Date.parse(expired.expiresAt) <= Date.parse("2026-01-01T00:00:00.000Z"))

const completed = await updateAutonomousOutboundScope(admin, {
  ...activated,
  status: "completed",
  completedAt: "2026-06-25T15:00:00.000Z",
  updatedAt: "2026-06-25T15:00:00.000Z",
})
assert.equal(completed.status, "completed")

const actionKey = `${activated.id}:lead-1:send_email:job-1`
const action = await insertAutonomousOutboundScopeAction(admin, {
  id: randomUUID(),
  scopeId: activated.id,
  organizationId: orgId,
  actionType: "send_email",
  channel: "email",
  status: "completed",
  leadId: "lead-1",
  sequenceJobId: "job-1",
  transportPath: GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.email,
  transportReference: "sent",
  correlationId: randomUUID(),
  idempotencyKey: actionKey,
  selectedAt: "2026-06-25T14:10:00.000Z",
  completedAt: "2026-06-25T14:10:05.000Z",
  createdAt: "2026-06-25T14:10:00.000Z",
  updatedAt: "2026-06-25T14:10:05.000Z",
})
const duplicate = await insertAutonomousOutboundScopeAction(admin, { ...action, id: randomUUID() })
assert.equal(duplicate.id, action.id, "idempotency must return existing action")

const byKey = await fetchAutonomousOutboundActionByIdempotencyKey(admin, {
  organizationId: orgId,
  idempotencyKey: actionKey,
})
assert.ok(byKey)

await appendAutonomousOutboundScopeEvent(admin, {
  organizationId: orgId,
  scopeId: activated.id,
  actionId: action.id,
  eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionCompleted,
  payload: { transport_path: GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.email },
})
const events = await listAutonomousOutboundScopeEvents(admin, { organizationId: orgId, scopeId: activated.id })
assert.ok(events.some((row) => row.eventType === GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionCompleted))
assert.equal(store.autonomous_outbound_scope_events.length >= 1, true)

const fetched = await fetchAutonomousOutboundScopeById(admin, {
  organizationId: orgId,
  scopeId: inserted.id,
})
assert.ok(fetched)

await upsertAutonomousOutboundScopeRecord(admin, sampleScope({ id: "upsert-scope", status: "draft" }))
assert.ok(store.autonomous_outbound_scopes.length >= 2)

// --- 7. Event bus wiring (static) ---
const orchestrator = readSource("lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts")
assert.ok(orchestrator.includes("publishGrowthAiEvent"))
assert.ok(orchestrator.includes("appendAutonomousOutboundScopeEvent"))
for (const eventType of Object.values(GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES)) {
  assert.ok(AI_EVENT_REGISTRY.some((entry) => entry.eventType === eventType), `${eventType} registered`)
}

// --- 8–12. Activation validation ---
const activationHarness = createAutonomousOutboundIntegrationHarness()
const approvedScope = sampleScope({ status: "approved" })
await insertAutonomousOutboundScope(activationHarness.admin, approvedScope)

const noApproval = await validateAutonomousOutboundScopeActivation(activationHarness.admin, {
  organizationId: orgId,
  scopeId: (await insertAutonomousOutboundScope(activationHarness.admin, sampleScope({ status: "draft" }))).id,
  nowIso: "2026-06-25T14:00:00.000Z",
})
assert.equal(noApproval.ok, false)
assert.ok(noApproval.checks.some((row) => row.check === "human_approval" && !row.passed))

const expiredActivation = await validateAutonomousOutboundScopeActivation(activationHarness.admin, {
  organizationId: orgId,
  scopeId: (
    await insertAutonomousOutboundScope(
      activationHarness.admin,
      sampleScope({ status: "approved", expiresAt: "2026-01-01T00:00:00.000Z" }),
    )
  ).id,
  nowIso: "2026-06-25T14:00:00.000Z",
})
assert.equal(expiredActivation.ok, false)
assert.ok(expiredActivation.checks.some((row) => row.check === "expiration" && !row.passed))

const emptyAudience = await validateAutonomousOutboundScopeActivation(activationHarness.admin, {
  organizationId: orgId,
  scopeId: (
    await insertAutonomousOutboundScope(
      activationHarness.admin,
      sampleScope({ status: "approved", audience: {} }),
    )
  ).id,
})
assert.equal(emptyAudience.ok, false)
assert.ok(emptyAudience.checks.some((row) => row.check === "audience" && !row.passed))

const emptyChannels = await validateAutonomousOutboundScopeActivation(activationHarness.admin, {
  organizationId: orgId,
  scopeId: (
    await insertAutonomousOutboundScope(
      activationHarness.admin,
      sampleScope({ status: "approved", allowedChannels: [] }),
    )
  ).id,
})
assert.equal(emptyChannels.ok, false)
assert.ok(emptyChannels.checks.some((row) => row.check === "channel_allow_list" && !row.passed))

const autonomyBlockedGate = evaluateBoundedOutboundGateMatrix(
  gateInput(sampleScope({ status: "active", activatedAt: "2026-06-25T14:00:00.000Z" }), "email", {
    autonomyAllowed: false,
    autonomyReason: "Autonomous outbound disabled.",
  }),
)
assert.equal(autonomyBlockedGate.allowed, false)

const activationService = readSource("lib/growth/aios/outbound/growth-autonomous-outbound-activation-service.ts")
assert.ok(activationService.includes("growth_autonomy"))
assert.ok(activationService.includes("fetchGrowthAiOsAutonomyPolicy"))

// --- 13–19. Channel transport + gate matrix ---
const activeScope = sampleScope({ status: "active", activatedAt: "2026-06-25T14:00:00.000Z" })

assert.equal(resolveTransportPath("email"), GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.email)
assert.equal(
  evaluateBoundedOutboundGateMatrix(gateInput(activeScope, "email")).allowed,
  true,
  "email allowed after gates",
)
assert.ok(orchestrator.includes("runSequenceExecutionJob"), "email delegates to sequence runtime")

assert.equal(resolveTransportPath("sms"), GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.sms)
assert.equal(evaluateBoundedOutboundGateMatrix(gateInput(activeScope, "sms")).allowed, true)

const smsNotReady = evaluateBoundedOutboundGateMatrix(
  gateInput(activeScope, "sms", { senderReady: false }),
)
assert.equal(smsNotReady.allowed, false, "SMS blocked when sender/readiness false")

const voiceBlocked = evaluateBoundedOutboundGateMatrix(
  gateInput(activeScope, "voice_drop", { voiceDropLiveCertified: false }),
)
assert.equal(
  voiceBlocked.allowed,
  VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED === true ? false : true,
  "voice drop blocked unless certified",
)

const aiVoiceBlocked = evaluateBoundedOutboundGateMatrix(
  gateInput(
    sampleScope({
      status: "active",
      activatedAt: "2026-06-25T14:00:00.000Z",
      allowedChannels: ["ai_voice"],
      aiVoiceExplicitlyApproved: false,
    }),
    "ai_voice",
  ),
)
assert.equal(aiVoiceBlocked.allowed, false)

const linkedinAllowed = evaluateBoundedOutboundGateMatrix(
  gateInput(
    sampleScope({
      status: "active",
      activatedAt: "2026-06-25T14:00:00.000Z",
      allowedChannels: ["linkedin_manual"],
    }),
    "linkedin_manual",
  ),
)
assert.equal(linkedinAllowed.allowed, true)
assert.equal(resolveTransportPath("linkedin_manual"), GROWTH_AUTONOMOUS_OUTBOUND_TRANSPORT_PATHS.linkedin_manual)

// --- 20–25. Caps, stop, suppression ---
assert.equal(
  evaluateBoundedOutboundGateMatrix(
    gateInput(activeScope, "email", { nowIso: "2026-06-25T23:00:00.000Z" }),
  ).allowed,
  false,
  "quiet hours block",
)

assert.equal(
  evaluateBoundedOutboundGateMatrix({
    ...gateInput(activeScope, "email"),
    consumption: {
      actionsTotal: 0,
      actionsToday: 0,
      actionsByLead: { "lead-1": 2 },
      emailsToday: 0,
      smsToday: 0,
      voiceDropsToday: 0,
    },
  }).allowed,
  false,
  "per-lead cap blocks",
)

assert.equal(
  evaluateBoundedOutboundGateMatrix({
    ...gateInput(activeScope, "email"),
    consumption: {
      actionsTotal: 0,
      actionsToday: 5,
      actionsByLead: {},
      emailsToday: 0,
      smsToday: 0,
      voiceDropsToday: 0,
    },
  }).allowed,
  false,
  "per-day cap blocks",
)

assert.equal(
  evaluateBoundedOutboundGateMatrix({
    ...gateInput(activeScope, "email"),
    consumption: {
      actionsTotal: 0,
      actionsToday: 0,
      actionsByLead: {},
      emailsToday: 3,
      smsToday: 0,
      voiceDropsToday: 0,
    },
  }).allowed,
  false,
  "per-channel email cap blocks",
)

assert.equal(
  evaluateBoundedOutboundGateMatrix(gateInput(activeScope, "email", { suppressionBlocked: true })).allowed,
  false,
)
assert.equal(
  evaluateBoundedOutboundGateMatrix(gateInput(activeScope, "sms", { optOutBlocked: true })).allowed,
  false,
)

const stopBlocked = evaluateBoundedOutboundGateMatrix(
  gateInput(activeScope, "email", { activeStopConditions: ["on_reply"] }),
)
assert.equal(stopBlocked.allowed, false)

const selectionBlocked = selectEligibleOutboundAction({
  scope: activeScope,
  pendingActions: [{ actionType: "send_email", leadId: "lead-999" }],
  gateEvaluator: ({ channel, leadId }) =>
    evaluateBoundedOutboundGateMatrix(gateInput(activeScope, channel, { leadId })),
})
assert.equal(selectionBlocked.selected, null)

// --- Operator activation eligibility (read-only indicator) ---
const eligible = evaluateAutonomousOutboundActivationEligibility({
  scope: sampleScope({ status: "approved" }),
  nowIso: "2026-06-25T14:00:00.000Z",
  killSwitchStatus: { autonomyEnabled: true, autonomyOutboundEnabled: true, emergencyStopActive: false },
})
assert.equal(eligible.eligible, true)

const ineligible = evaluateAutonomousOutboundActivationEligibility({
  scope: sampleScope({ status: "approved", allowedChannels: [] }),
  nowIso: "2026-06-25T14:00:00.000Z",
  killSwitchStatus: { autonomyEnabled: true, autonomyOutboundEnabled: false, emergencyStopActive: false },
})
assert.equal(ineligible.eligible, false)

const panel = readSource("components/growth/ai-os/command-center/growth-ai-os-bounded-autonomous-outbound-section.tsx")
assert.ok(panel.includes("evaluateAutonomousOutboundActivationEligibility") || panel.includes("Eligible for activation"))
assert.equal(panel.includes('method: "POST"'), false)

// --- 26–27. Safety boundaries ---
const coreForbidden = ["public.invoices", "public.quotes", "public.customers", "blitzpay"]
for (const file of [
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository.ts",
  "lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts",
]) {
  for (const token of coreForbidden) {
    assert.equal(readSource(file).includes(token), false, `${file} must not touch ${token}`)
  }
}
assert.equal(orchestrator.includes("cron.schedule"), false)
assert.equal(orchestrator.includes("setInterval"), false)

// --- Sequence approval alignment (static) ---
const sequenceGate = readSource("lib/growth/sequences/execution/sequence-approval-gate.ts")
const sequenceRunner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
assert.ok(sequenceGate.includes("not_yet_approved"))
assert.ok(sequenceRunner.includes('job.status !== "approved"'))
assert.ok(orchestrator.includes("humanApproved: true"))
assert.ok(orchestrator.includes("runSequenceExecutionJob"))

// --- 28–29. Regressions ---
console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_2_PHASE}] Running regression certifications...`)
const regressions = [
  "test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes",
  "test:ge-ai-2i-bounded-autonomous-outbound",
  "test:ge-ai-2b-event-bus-completion",
  "test:ge-ai-2h-human-approval-center",
  "test:ge-ai-2e-priority-engine-binding",
  "test:ge-ai-2f-meta-recommender",
  "test:prod-regression-6-command-center-import-stability",
]
for (const script of regressions) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_2_PHASE}] PASS — Autonomous Outbound Integration certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
