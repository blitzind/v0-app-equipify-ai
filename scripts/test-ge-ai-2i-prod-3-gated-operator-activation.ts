/**
 * GE-AI-2I-PROD-3 — Gated Operator Activation Surface certification.
 * Run: pnpm test:ge-ai-2i-prod-3-gated-operator-activation
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { evaluateAutonomousOutboundActivationEligibility } from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import { submitOperatorAutonomousOutboundScopeActivation } from "../lib/growth/aios/outbound/growth-autonomous-outbound-operator-activation-service"
import {
  insertAutonomousOutboundScope,
  updateAutonomousOutboundScope,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import {
  GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE,
  GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING,
  GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
} from "../lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  createAutonomousOutboundIntegrationHarness,
  createMissingSchemaHarnessAdmin,
} from "./growth-autonomous-outbound-integration-harness"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleApprovedScope(overrides: Record<string, unknown> = {}) {
  const now = "2026-06-25T14:00:00.000Z"
  return {
    id: randomUUID(),
    organizationId: "org-prod-3",
    source: "human_approval_center" as const,
    sourceId: "approval-1",
    status: "approved" as const,
    approvedByUserId: "user-1",
    approvedAt: now,
    expiresAt: "2026-12-31T23:59:59.000Z",
    allowedChannels: ["email", "sms"] as const,
    audience: { leadIds: ["lead-1"] },
    limits: {
      maxActionsTotal: 10,
      maxActionsPerDay: 5,
      maxActionsPerLead: 2,
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
    stopConditions: { onReply: true, onManualPause: true },
    policy: {
      autonomyCapability: "autonomous_outbound_actions",
      requiresHumanApproval: true,
      enforcementSource: "growth_ai_os_autonomy_policy_engine",
    },
    title: "Prod-3 activation scope",
    summary: "Cert scope",
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    pausedAt: null,
    completedAt: null,
    blockedReason: null,
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE}] Gated Operator Activation certification`)

  const activateRoute =
    "app/api/platform/growth/ai-os/bounded-autonomous-outbound/scopes/[scopeId]/activate/route.ts"
  const readRoute = "app/api/platform/growth/ai-os/bounded-autonomous-outbound/route.ts"
  const operatorService = "lib/growth/aios/outbound/growth-autonomous-outbound-operator-activation-service.ts"
  const activationControl = "components/growth/ai-os/approvals/growth-autonomous-outbound-scope-activation-control.tsx"
  const approvalPanel = "components/growth/ai-os/approvals/growth-human-approval-center-panel.tsx"
  const opsPanel = "components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx"
  const commandCenterSection =
    "components/growth/ai-os/command-center/growth-ai-os-bounded-autonomous-outbound-section.tsx"
  const orchestrator = "lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator.ts"
  const sequenceApprove = "app/api/platform/growth/sequences/execution/jobs/[jobId]/approve/route.ts"

  for (const file of [activateRoute, operatorService, activationControl, "scripts/test-ge-ai-2i-prod-3-live-db-smoke.ts"]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
  }

  const routeSource = readSource(activateRoute)
  assert.ok(routeSource.includes("export async function POST"))
  assert.equal(routeSource.includes("export async function GET"), false)
  assert.ok(routeSource.includes("requireGrowthOperatorAccess"))
  assert.ok(routeSource.includes("submitOperatorAutonomousOutboundScopeActivation"))
  assert.ok(routeSource.includes("getGrowthEngineAiOrgId"))
  assert.ok(routeSource.includes("sendOccurred: false"))
  assert.equal(routeSource.includes("executeBoundedAutonomousOutboundAction"), false)
  assert.equal(routeSource.includes("runSequenceExecutionJob"), false)

  const readSourceFile = readSource(readRoute)
  assert.ok(readSourceFile.includes("export async function GET"))
  assert.equal(readSourceFile.includes("export async function POST"), false)

  const serviceSource = readSource(operatorService)
  assert.ok(serviceSource.includes("activateAutonomousOutboundScopeWithValidation"))
  assert.ok(serviceSource.includes("isGrowthAutonomousOutboundScopeSchemaReady"))
  assert.equal(serviceSource.includes("executeBoundedAutonomousOutbound"), false)

  const missingAdmin = createMissingSchemaHarnessAdmin()
  const schemaBlocked = await submitOperatorAutonomousOutboundScopeActivation(missingAdmin, {
    organizationId: "org-prod-3",
    scopeId: randomUUID(),
    operatorUserId: "user-1",
  })
  assert.equal(schemaBlocked.ok, false)
  assert.equal(schemaBlocked.error, "schema_not_ready")

  const harness = createAutonomousOutboundIntegrationHarness()
  const orgId = "org-prod-3"

  const draft = sampleApprovedScope({ status: "draft", approvedByUserId: "" })
  const draftRow = await insertAutonomousOutboundScope(harness.admin, draft)
  const noApproval = await submitOperatorAutonomousOutboundScopeActivation(harness.admin, {
    organizationId: orgId,
    scopeId: draftRow.id,
    operatorUserId: "user-1",
  })
  assert.equal(noApproval.ok, false)

  const expired = sampleApprovedScope({ expiresAt: "2026-01-01T00:00:00.000Z" })
  const expiredRow = await insertAutonomousOutboundScope(harness.admin, expired)
  const expiredActivation = await submitOperatorAutonomousOutboundScopeActivation(harness.admin, {
    organizationId: orgId,
    scopeId: expiredRow.id,
    operatorUserId: "user-1",
    nowIso: "2026-06-25T14:00:00.000Z",
  })
  assert.equal(expiredActivation.ok, false)

  const emptyAudience = sampleApprovedScope({ audience: {} })
  const emptyAudienceRow = await insertAutonomousOutboundScope(harness.admin, emptyAudience)
  const audienceBlocked = await submitOperatorAutonomousOutboundScopeActivation(harness.admin, {
    organizationId: orgId,
    scopeId: emptyAudienceRow.id,
    operatorUserId: "user-1",
  })
  assert.equal(audienceBlocked.ok, false)

  const emptyChannels = sampleApprovedScope({ allowedChannels: [] })
  const emptyChannelsRow = await insertAutonomousOutboundScope(harness.admin, emptyChannels)
  const channelsBlocked = await submitOperatorAutonomousOutboundScopeActivation(harness.admin, {
    organizationId: orgId,
    scopeId: emptyChannelsRow.id,
    operatorUserId: "user-1",
  })
  assert.equal(channelsBlocked.ok, false)

  const approved = sampleApprovedScope()
  const approvedRow = await insertAutonomousOutboundScope(harness.admin, approved)
  const activationAttempt = await submitOperatorAutonomousOutboundScopeActivation(harness.admin, {
    organizationId: orgId,
    scopeId: approvedRow.id,
    operatorUserId: "user-1",
  })
  assert.equal(activationAttempt.sendOccurred, false)
  assert.equal(activationAttempt.sequenceJobApprovalRequired, true)
  assert.ok(activationAttempt.dualApprovalWarning.toLowerCase().includes("sequence"))

  const orchestratorSource = readSource(orchestrator)
  assert.equal(orchestratorSource.includes("cron.schedule"), false)
  assert.equal(orchestratorSource.includes("approveSequenceExecutionJob"), false)

  const sequenceSource = readSource(sequenceApprove)
  assert.ok(sequenceSource.includes("approveSequenceExecutionJob"))
  assert.equal(routeSource.includes("approveSequenceExecutionJob"), false, "activation must not auto-approve jobs")

  const uiSource = readSource(activationControl)
  assert.ok(uiSource.includes("GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING"))
  assert.ok(uiSource.includes('method: "POST"'))
  assert.equal(uiSource.includes("executeBoundedAutonomousOutbound"), false)
  assert.ok(uiSource.includes("disabled={!eligibility.eligible"))

  const panelSource = readSource(approvalPanel)
  assert.ok(panelSource.includes("GrowthAutonomousOutboundScopeActivationControl"))
  assert.ok(panelSource.includes('item.source === "autonomous_outbound_scope"'))

  const opsSource = readSource(opsPanel)
  assert.equal(opsSource.includes('method: "POST"'), false, "AI Operations remains read-only")

  const ccSource = readSource(commandCenterSection)
  assert.equal(ccSource.includes('method: "POST"'), false)

  assert.equal(GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE.includes("never sends"), true)
  assert.equal(GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING.toLowerCase().includes("sequence"), true)

  const ineligible = evaluateAutonomousOutboundActivationEligibility({
    scope: {
      ...sampleApprovedScope(),
      allowedChannels: [],
    },
    nowIso: "2026-06-25T14:00:00.000Z",
    killSwitchStatus: { autonomyEnabled: true, autonomyOutboundEnabled: true, emergencyStopActive: false },
  })
  assert.equal(ineligible.eligible, false)

  const collector = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
  assert.ok(collector.includes('label: "Scope ID"'))

  const coreForbidden = ["public.invoices", "public.quotes", "public.customers", "blitzpay"]
  for (const file of [activateRoute, operatorService]) {
    for (const token of coreForbidden) {
      assert.equal(readSource(file).includes(token), false, `${file} must not touch ${token}`)
    }
  }

  assert.equal(GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER, "growth-ge-ai-2i-bounded-autonomous-outbound-v1")

  console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE}] Running regression certifications...`)
  const regressions = [
    "test:ge-ai-2i-prod-2-autonomous-outbound-integration",
    "test:ge-ai-2i-prod-1-persistent-autonomous-outbound-scopes",
    "test:ge-ai-2i-bounded-autonomous-outbound",
    "test:ge-ai-2b-event-bus-completion",
    "test:ge-ai-2h-human-approval-center",
    "test:ge-ai-2e-priority-engine-binding",
    "test:ge-ai-2f-meta-recommender",
  ]
  for (const script of regressions) {
    execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
  }

  execSync("pnpm test:ge-ai-2i-prod-3-live-db-smoke", { stdio: "inherit", cwd: process.cwd() })

  console.log(`[${GROWTH_AIOS_GE_AI_2I_PROD_3_PHASE}] PASS — Gated Operator Activation certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
