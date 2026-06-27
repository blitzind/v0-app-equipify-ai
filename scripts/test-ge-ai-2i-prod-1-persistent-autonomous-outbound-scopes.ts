/**
 * GE-AI-2I-PROD-1 — Persistent Autonomous Outbound Scopes certification.
 * Run: pnpm test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { AI_EVENT_REGISTRY } from "../lib/growth/aios/ai-event-registry"
import { collectAutonomousOutboundScopeApprovalItems } from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import { synthesizeBoundedAutonomousOutboundReadModel } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import {
  autonomousOutboundScopeSchemaCatalog,
  mapAutonomousOutboundActionRow,
  mapAutonomousOutboundScopeRow,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import { GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_OBJECTS } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health"
import type { GrowthAutonomousOutboundScope } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GROWTH_AIOS_GE_AI_2I_PROD_1_PHASE,
  GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES,
  GROWTH_AUTONOMOUS_OUTBOUND_PERSISTENCE_RULE,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

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
    status: "approved",
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
    activatedAt: null,
    pausedAt: null,
    completedAt: null,
    blockedReason: null,
    ...overrides,
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_1_PHASE}] Persistent Autonomous Outbound Scopes certification`)

assert.equal(GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION, "20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql")
assert.ok(GROWTH_AUTONOMOUS_OUTBOUND_PERSISTENCE_RULE.includes("growth.autonomous_outbound_scopes"))

const requiredFiles = [
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-activation-service.ts",
  "supabase/migrations/20271001210000_growth_ai_2i_prod_1_autonomous_outbound_scopes.sql",
  "docs/GE-AI-2I-PROD-1_PERSISTENT_AUTONOMOUS_OUTBOUND_SCOPES.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const migration = readSource(`supabase/migrations/${GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_MIGRATION}`)
assert.ok(migration.includes("growth.autonomous_outbound_scopes"))
assert.ok(migration.includes("growth.autonomous_outbound_scope_actions"))
assert.ok(migration.includes("growth.autonomous_outbound_scope_events"))
assert.ok(migration.includes("autonomous_outbound_scope_actions_idempotency_uidx"))
assert.ok(migration.includes("service_role"))
assert.equal(migration.includes("public.invoices"), false)

const catalog = autonomousOutboundScopeSchemaCatalog()
assert.equal(catalog.qaMarker, GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER)
assert.deepEqual(catalog.tables, [
  "autonomous_outbound_scopes",
  "autonomous_outbound_scope_actions",
  "autonomous_outbound_scope_events",
])
assert.equal(GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SCHEMA_OBJECTS.length, 3)

const scopeRow = {
  id: "scope-1",
  organization_id: "org-1",
  source: "objective",
  source_id: "obj-1",
  status: "approved",
  approved_by_user_id: "user-1",
  approved_at: "2026-06-25T14:00:00.000Z",
  activated_at: null,
  paused_at: null,
  completed_at: null,
  expires_at: "2026-12-31T23:59:59.000Z",
  title: "Demo",
  summary: "Summary",
  allowed_channels: ["email", "sms"],
  audience: { leadIds: ["lead-1"] },
  limits: { maxActionsTotal: 10, maxActionsPerDay: 5, maxActionsPerLead: 2 },
  required_checks: { humanApproval: true, growthAutonomy: true },
  stop_conditions: { onReply: true },
  policy: { autonomyCapability: "autonomous_outbound_actions", requiresHumanApproval: true },
  voice_drop_certified: false,
  ai_voice_explicitly_approved: false,
  blocked_reason: null,
  audit_metadata: {},
  qa_marker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  created_at: "2026-06-25T14:00:00.000Z",
  updated_at: "2026-06-25T14:00:00.000Z",
}

const mappedScope = mapAutonomousOutboundScopeRow(scopeRow)
assert.equal(mappedScope.id, "scope-1")
assert.equal(mappedScope.organizationId, "org-1")
assert.equal(mappedScope.status, "approved")
assert.deepEqual(mappedScope.allowedChannels, ["email", "sms"])

const actionRow = {
  id: "action-1",
  organization_id: "org-1",
  scope_id: "scope-1",
  lead_id: "lead-1",
  channel: "email",
  action_type: "send_email",
  status: "completed",
  sequence_job_id: "job-1",
  transport_path: "sequence_execution.runSequenceExecutionJob",
  transport_reference: "sent",
  blocked_gate: null,
  blocked_reason: null,
  correlation_id: "corr-1",
  idempotency_key: "scope-1:lead-1:send_email:job-1",
  selected_at: "2026-06-25T14:00:00.000Z",
  queued_at: null,
  completed_at: "2026-06-25T14:01:00.000Z",
  failed_at: null,
  audit_metadata: {},
  qa_marker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  created_at: "2026-06-25T14:00:00.000Z",
  updated_at: "2026-06-25T14:01:00.000Z",
}

const mappedAction = mapAutonomousOutboundActionRow(actionRow)
assert.equal(mappedAction.idempotencyKey, "scope-1:lead-1:send_email:job-1")
assert.equal(mappedAction.transportReference, "sent")

const orchestrator = readSource("lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts")
assert.ok(orchestrator.includes("growth-autonomous-outbound-scope-repository"))
assert.ok(orchestrator.includes("insertAutonomousOutboundScopeAction"))
assert.ok(orchestrator.includes("appendAutonomousOutboundScopeEvent"))
assert.ok(orchestrator.includes("idempotencyKey"))
assert.equal(orchestrator.includes("growth-autonomous-outbound-scope-store"), false, "orchestrator must not use in-memory store")
assert.equal(orchestrator.includes("cron.schedule"), false)
assert.equal(orchestrator.includes("setInterval"), false)

const service = readSource("lib/growth/aios/outbound/growth-autonomous-outbound-scope-service.ts")
assert.ok(service.includes("isGrowthAutonomousOutboundScopeSchemaReady"))
assert.ok(service.includes("listAutonomousOutboundScopesForOrganization"))
assert.ok(service.includes("createDraftAutonomousOutboundScope"))
assert.ok(service.includes("activateAutonomousOutboundScopeWithValidation"))
assert.equal(service.includes("growth-autonomous-outbound-scope-store"), false)

const activation = readSource("lib/growth/aios/outbound/growth-autonomous-outbound-activation-service.ts")
assert.ok(activation.includes("validateAutonomousOutboundScopeActivation"))
assert.ok(activation.includes("fetchGrowthAiOsAutonomyPolicy"))
assert.ok(activation.includes("human_approval"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("fetchBoundedAutonomousOutboundReadModel"))

const approvalService = readSource("lib/growth/aios/approvals/growth-human-approval-center-service.ts")
assert.ok(approvalService.includes("fetchBoundedAutonomousOutboundReadModel"))

const coreForbidden = [
  "public.invoices",
  "public.quotes",
  "public.customers",
  "blitzpay",
  'from "@/app/(portal)',
]
for (const file of [
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-activation-service.ts",
  "lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts",
  "lib/growth/aios/outbound/growth-autonomous-outbound-scope-service.ts",
]) {
  assertNoCoreTouch(file, coreForbidden)
}

for (const eventType of Object.values(GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES)) {
  assert.ok(AI_EVENT_REGISTRY.some((entry) => entry.eventType === eventType), `${eventType} registered`)
}

const readModel = synthesizeBoundedAutonomousOutboundReadModel({
  organizationId: "org-1",
  generatedAt: "2026-06-25T14:00:00.000Z",
  scopes: [sampleScope({ status: "active", activatedAt: "2026-06-25T14:00:00.000Z" })],
  actions: [],
  stopConditionTriggers: [],
  killSwitchStatus: {
    autonomyEnabled: true,
    autonomyOutboundEnabled: false,
    emergencyStopActive: false,
  },
  lastEventAt: "2026-06-25T14:00:00.000Z",
  lastEventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.scopeActivated,
})
assert.equal(readModel.summary.activeScopes, 1)
assert.equal(readModel.lastEventType, GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.scopeActivated)

const approvalItems = collectAutonomousOutboundScopeApprovalItems({
  organizationId: "org-1",
  generatedAt: "2026-06-25T14:00:00.000Z",
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

console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_1_PHASE}] Running regression certifications...`)

const regressions = [
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

console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_1_PHASE}] PASS — Persistent Autonomous Outbound Scopes certified (local)`)
