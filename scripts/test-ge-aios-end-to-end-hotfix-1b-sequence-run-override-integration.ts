/**
 * GE-AIOS-END-TO-END HOTFIX 1B — Full request-path integration test for
 * canonicalDecisionOverrideReason forwarding on sequence job /run.
 *
 * Run: pnpm test:ge-aios-end-to-end-hotfix-1b-sequence-run-override-integration
 */
import assert from "node:assert/strict"
import Module from "node:module"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import type { SequenceExecutionRunInput } from "../lib/growth/sequences/execution/sequence-job-runner"

export const GE_AIOS_END_TO_END_HOTFIX_1B_INTEGRATION_QA_MARKER =
  "ge-aios-end-to-end-hotfix-1b-sequence-run-override-integration-v1" as const

export const TEST_NAME =
  "GE-AIOS-END-TO-END HOTFIX 1B sequence /run override integration" as const

const TEST_JOB_ID = "44b1f1f1-d5b9-4ff9-8aee-61e4ef3207ae" as const
const TEST_USER_ID = "f24f76d0-c093-4bb0-a982-292548ee9926" as const
const TEST_USER_EMAIL = "integration@test.equipify.ai" as const
const TEST_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
const TEST_ORG_ID = "00757488-1026-44a5-aac4-269533ac21be" as const
const OVERRIDE_REASON = "integration-test" as const
const INTEGRATION_STOP_ERROR = "integration_test_stop" as const

type EnforcementCapture = {
  operatorOverrideReason?: string | null
  operatorId?: string | null
  operatorEmail?: string | null
  channelLabel?: string | null
  allowed?: boolean
}

type IntegrationTrace = {
  runnerInputs: SequenceExecutionRunInput[]
  enforcementCaptures: EnforcementCapture[]
  httpBodies: unknown[]
}

type Harness = {
  trace: IntegrationTrace
  mockAdmin: SupabaseClient
  runApprovedDueSequenceExecutionJobs: (
    admin: SupabaseClient,
    input: { actingUserId: string; actingUserEmail: string; limit?: number },
  ) => Promise<{ scanned: number; sent: number; blocked: number; failed: number; skippedLocked: number }>
  restore: () => void
}

function modulePath(request: string): string {
  return String(request).replace(/\\/g, "/")
}

function buildApprovedJob() {
  const now = new Date().toISOString()
  return {
    id: TEST_JOB_ID,
    status: "approved" as const,
    channel: "email" as const,
    leadId: TEST_LEAD_ID,
    sequenceEnrollmentId: "a362d777-ea07-44c7-bb66-702bc3bc3973",
    sequenceStepId: "step-integration-test",
    humanApprovedAt: now,
    humanApprovedBy: TEST_USER_ID,
    requiresHumanApproval: true,
    attemptCount: 0,
    deliveryAttemptId: null,
    senderPoolId: null,
    allowAutoRotation: false,
    manualSenderAccountId: null,
    senderAccountId: null,
    lastError: null,
    lockedAt: null,
    lockedBy: null,
    organizationId: TEST_ORG_ID,
  }
}

function buildWaitResolution(): GrowthCanonicalDecisionResolution {
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: TEST_ORG_ID,
    leadId: TEST_LEAD_ID,
    generatedAt: new Date().toISOString(),
    companyName: "Block Imaging",
    decision: {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER,
      decisionId: "decision:integration-test",
      decisionFingerprint: "decision-fingerprint:integration-test",
      organizationId: TEST_ORG_ID,
      leadId: TEST_LEAD_ID,
      generatedAt: new Date().toISOString(),
      primaryAction: "wait",
      title: "Wait per revenue strategy",
      rationale: ["Revenue strategy recommends delay."],
      urgency: "scheduled",
      confidence: 74,
      recommendedActor: "ava",
      recommendedChannel: "none",
      targetContactId: null,
      targetRole: null,
      waitUntil: null,
      prerequisites: [],
      blockedBy: [],
      supportingActions: [],
      suppressedActions: [],
      sourceSummary: {
        relationshipGoal: "Expand committee",
        revenueRecommendation: "delay",
        latestMaterialEvent: null,
        currentStage: null,
        packageStatus: "approved",
        approvalStatus: null,
      },
      operatorReviewRequired: false,
      transportBlocked: false,
    },
    operatorCard: {
      qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER,
      status: "wait",
      label: "Wait",
      summary: "Integration test wait decision.",
      recommendation: "Wait.",
      essentials: [],
    },
    freshness: {
      state: "current",
      label: "Current",
      packageGeneratedAt: null,
      approvalAt: null,
      materialEventAt: null,
      decisionFingerprint: "decision-fingerprint:integration-test",
      packageFingerprint: null,
      strategyChangedSincePackage: false,
      stalePackageRelativeToDecision: false,
    },
    suppressionHints: {
      suppressColdOutreach: false,
      suppressSequenceSends: false,
      suppressDuplicatePackage: false,
      suppressTransport: false,
      reasons: [],
    },
    inputDegraded: [],
  }
}

function buildActiveAutonomousScope() {
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString()
  return {
    id: "scope-integration-test",
    organizationId: TEST_ORG_ID,
    source: "saved_search" as const,
    sourceId: "source-integration-test",
    status: "active" as const,
    approvedByUserId: TEST_USER_ID,
    approvedAt: now,
    expiresAt,
    allowedChannels: ["email" as const],
    audience: { leadIds: [TEST_LEAD_ID], maxAudienceSize: 10 },
    limits: {
      maxActionsTotal: 10,
      maxActionsPerDay: 10,
      maxActionsPerLead: 3,
      maxEmailsPerDay: 10,
    },
    requiredChecks: {
      growthAutonomy: true as const,
      humanApproval: true as const,
      suppression: true as const,
      senderReadiness: true as const,
      compliance: true as const,
      optOut: true as const,
      budget: true as const,
    },
    stopConditions: { onReply: true },
    policy: {
      autonomyCapability: "email",
      requiresHumanApproval: true as const,
      enforcementSource: "integration-test",
    },
    title: "Integration test scope",
    summary: "Integration test scope",
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
  }
}

function installHarness(): Harness {
  const trace: IntegrationTrace = {
    runnerInputs: [],
    enforcementCaptures: [],
    httpBodies: [],
  }
  const mockAdmin = {} as SupabaseClient
  const approvedJob = buildApprovedJob()
  const originalLoad = Module._load
  let runApprovedDueSequenceExecutionJobsRef: Harness["runApprovedDueSequenceExecutionJobs"] = async () => ({
    scanned: 0,
    sent: 0,
    blocked: 0,
    failed: 0,
    skippedLocked: 0,
  })

  Module._load = function patchedLoad(request, parent, isMain) {
    const resolved = modulePath(request)
    const exports = originalLoad.call(this, request, parent, isMain)

    if (resolved.includes("/lib/growth/access")) {
      return {
        ...exports,
        requireGrowthEnginePlatformAccess: async () => ({
          ok: true as const,
          admin: mockAdmin,
          userId: TEST_USER_ID,
          userEmail: TEST_USER_EMAIL,
        }),
      }
    }

    if (resolved.includes("growth-canonical-decision-engine-1d-sequence-enforcement")) {
      const originalEnforce = exports.enforceCanonicalDecisionForSequenceChannelJob
      return {
        finalizeCanonicalDecisionSuppressedJob: exports.finalizeCanonicalDecisionSuppressedJob,
        enforceCanonicalDecisionForSequenceChannelJob: async (
          admin: SupabaseClient,
          input: Parameters<typeof originalEnforce>[1],
        ) => {
          const result = await originalEnforce(admin, input)
          trace.enforcementCaptures.push({
            operatorOverrideReason: input.operatorOverrideReason ?? null,
            operatorId: input.operatorId ?? null,
            operatorEmail: input.operatorEmail ?? null,
            channelLabel: input.channelLabel ?? null,
            allowed: result.allowed,
          })
          return result
        },
      }
    }

    if (
      resolved.includes("/sequences/execution/sequence-job-runner") &&
      !resolved.includes("sequence-sms-runner") &&
      !resolved.includes("sequence-voice-drop-runner")
    ) {
      const originalRun = exports.runSequenceExecutionJob
      const wrappedRun = async (admin: SupabaseClient, input: SequenceExecutionRunInput) => {
        trace.runnerInputs.push({ ...input })
        return originalRun(admin, input)
      }
      runApprovedDueSequenceExecutionJobsRef = async (
        admin: SupabaseClient,
        input: { actingUserId: string; actingUserEmail: string; limit?: number },
      ) => {
        const dueJobs = [approvedJob]
        const summary = { scanned: dueJobs.length, sent: 0, blocked: 0, failed: 0, skippedLocked: 0 }
        for (const job of dueJobs) {
          const result = await wrappedRun(admin, {
            jobId: job.id,
            actingUserId: input.actingUserId,
            actingUserEmail: input.actingUserEmail,
            humanApproved: true,
            humanApprovalConfirmed: true,
            approvedBy: job.humanApprovedBy,
            lockedBy: "cron:growth-sequence-safe-execute",
            cronMode: true,
          })
          if (result.message === "job_locked") {
            summary.skippedLocked += 1
            continue
          }
          if (result.ok && result.status === "sent") summary.sent += 1
          else if (result.blocked) summary.blocked += 1
          else summary.failed += 1
        }
        return summary
      }
      return {
        approveSequenceExecutionJob: exports.approveSequenceExecutionJob,
        skipSequenceExecutionJob: exports.skipSequenceExecutionJob,
        restoreSequenceExecutionJob: exports.restoreSequenceExecutionJob,
        runSequenceExecutionJob: wrappedRun,
        runApprovedDueSequenceExecutionJobs: runApprovedDueSequenceExecutionJobsRef,
      }
    }

    if (resolved.includes("/sequences/execution/sequence-job-repository")) {
      return {
        ...exports,
        getSequenceExecutionJob: async () => approvedJob,
        tryLockSequenceExecutionJob: async () => ({ ...approvedJob, lockedAt: new Date().toISOString() }),
        updateSequenceExecutionJob: async () => approvedJob,
        listApprovedDueSequenceExecutionJobs: async () => [approvedJob],
      }
    }

    if (resolved.includes("/sequences/execution/sequence-pause-gate")) {
      return {
        ...exports,
        assertSequenceExecutionPauseGate: async () => ({ blocked: false, code: null }),
      }
    }

    if (resolved.includes("/lead-repository")) {
      return {
        ...exports,
        fetchGrowthLeadById: async () => ({
          id: TEST_LEAD_ID,
          promotedOrganizationId: TEST_ORG_ID,
          companyName: "Block Imaging",
          contactEmail: "josh.block@blockimaging.com",
          status: "active",
        }),
      }
    }

    if (resolved.includes("growth-canonical-decision-engine-1c-cache")) {
      return {
        ...exports,
        resolveGrowthCanonicalDecisionForLeadCached: async () => buildWaitResolution(),
      }
    }

    if (resolved.includes("growth-canonical-decision-engine-1d-operator-override")) {
      return {
        ...exports,
        recordCanonicalDecisionOperatorOverride: async () => undefined,
      }
    }

    if (resolved.includes("/sequences/execution/sequence-execution-events")) {
      return {
        ...exports,
        recordSequenceExecutionJobAuditEvent: async () => undefined,
        recordSequenceExecutionTimelineEvent: async () => undefined,
      }
    }

    if (resolved.includes("/outbound/reply-intelligence")) {
      return {
        ...exports,
        shouldSuppressCampaignFollowUp: async () => ({ suppress: false }),
      }
    }

    if (resolved.includes("/sequences/execution/sequence-send-builder")) {
      return {
        ...exports,
        buildSequenceExecutionSendPayload: async () => ({ error: INTEGRATION_STOP_ERROR }),
      }
    }

    if (resolved.includes("/sequence-enrollment/run-sequence-scheduler")) {
      return {
        ...exports,
        fetchGrowthSequenceSchedulerStatus: async () => ({ dueCount: 0 }),
        runGrowthSequenceScheduler: async () => ({
          planned: 0,
          skippedSuppressed: 0,
          skippedAlreadyQueued: 0,
        }),
      }
    }

    if (resolved.includes("growth-autonomous-outbound-scope-repository")) {
      const activeScope = buildActiveAutonomousScope()
      return {
        ...exports,
        fetchAutonomousOutboundScopeById: async () => activeScope,
        listAutonomousOutboundActionsForOrganization: async () => [],
        listAutonomousOutboundStopConditionTriggers: async () => [],
        insertAutonomousOutboundScopeAction: async (_admin: SupabaseClient, action: unknown) => action,
        appendAutonomousOutboundScopeEvent: async () => undefined,
      }
    }

    if (resolved.includes("growth-ai-os-autonomy-policy-evaluation-service")) {
      return {
        ...exports,
        evaluateAutonomyOutboundSendPolicyFromPolicyEngine: async () => ({
          allowed: true,
          reason: null,
        }),
      }
    }

    if (resolved.includes("/outbound/suppression-repository")) {
      return {
        ...exports,
        isEmailSuppressed: async () => false,
      }
    }

    if (resolved.includes("/runtime/outbound-transport-readiness")) {
      return {
        ...exports,
        evaluateGrowthOutboundTransportReadiness: async () => ({ ready: true }),
      }
    }

    return exports
  }

  return {
    trace,
    mockAdmin,
    runApprovedDueSequenceExecutionJobs: (admin, input) =>
      runApprovedDueSequenceExecutionJobsRef(admin, input),
    restore: () => {
      Module._load = originalLoad
    },
  }
}

async function invokeRunRoute(body: Record<string, unknown>): Promise<Response> {
  const route = await import("../app/api/platform/growth/sequences/execution/jobs/[jobId]/run/route")
  const request = new Request(`http://localhost/api/platform/growth/sequences/execution/jobs/${TEST_JOB_ID}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return route.POST(request, { params: Promise.resolve({ jobId: TEST_JOB_ID }) })
}

async function testPositiveOverrideForwarding(trace: IntegrationTrace): Promise<{
  runnerInput: SequenceExecutionRunInput
  enforcementInput: EnforcementCapture
}> {
  trace.runnerInputs.length = 0
  trace.enforcementCaptures.length = 0

  const body = {
    humanApproved: true,
    humanApprovalConfirmed: true,
    canonicalDecisionOverrideReason: OVERRIDE_REASON,
  }
  trace.httpBodies.push(body)

  const response = await invokeRunRoute(body)
  assert.equal(response.status, 200)
  const json = (await response.json()) as { ok?: boolean; result?: { message?: string; blocked?: boolean } }

  assert.equal(trace.runnerInputs.length, 1, "runner must be invoked once")
  assert.equal(trace.enforcementCaptures.length, 1, "canonical enforcement must run once")

  assert.equal(
    trace.runnerInputs[0]?.canonicalDecisionOverrideReason,
    OVERRIDE_REASON,
    "runner must receive exact override string",
  )
  assert.equal(
    trace.enforcementCaptures[0]?.operatorOverrideReason,
    OVERRIDE_REASON,
    "enforcement must receive exact operatorOverrideReason",
  )
  assert.equal(trace.enforcementCaptures[0]?.allowed, true, "override must allow canonical gate")
  assert.equal(json.result?.message, INTEGRATION_STOP_ERROR, "runner must proceed past canonical gate")

  return {
    runnerInput: trace.runnerInputs[0]!,
    enforcementInput: trace.enforcementCaptures[0]!,
  }
}

async function testNoOverrideSupplied(trace: IntegrationTrace): Promise<void> {
  trace.runnerInputs.length = 0
  trace.enforcementCaptures.length = 0

  const body = {
    humanApproved: true,
    humanApprovalConfirmed: true,
  }
  trace.httpBodies.push(body)

  const response = await invokeRunRoute(body)
  assert.equal(response.status, 200)
  const json = (await response.json()) as {
    ok?: boolean
    result?: { message?: string; blocked?: boolean; status?: string }
  }

  assert.equal(trace.runnerInputs.length, 1)
  assert.equal(trace.enforcementCaptures.length, 1)
  assert.equal(trace.runnerInputs[0]?.canonicalDecisionOverrideReason ?? null, null)
  assert.equal(trace.enforcementCaptures[0]?.operatorOverrideReason ?? null, null)
  assert.equal(json.ok, false)
  assert.equal(json.result?.blocked, true)
  assert.equal(json.result?.message, "canonical_decision_wait_until")
  assert.equal(trace.enforcementCaptures[0]?.allowed, false)
}

async function testSchedulerPathCannotInjectOverride(trace: IntegrationTrace): Promise<void> {
  const before = trace.runnerInputs.length
  const route = await import("../app/api/platform/growth/sequences/scheduler/run/route")
  const response = await route.POST(
    new Request("http://localhost/api/platform/growth/sequences/scheduler/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dryRun: true, limit: 1 }),
    }),
  )
  assert.equal(response.status, 200)

  const newInputs = trace.runnerInputs.slice(before)
  assert.equal(
    newInputs.every((input) => input.canonicalDecisionOverrideReason == null),
    true,
    "scheduler path must not inject override",
  )
}

async function testCronPathCannotInjectOverride(
  trace: IntegrationTrace,
  runApprovedDueSequenceExecutionJobs: Harness["runApprovedDueSequenceExecutionJobs"],
  mockAdmin: SupabaseClient,
): Promise<void> {
  const before = trace.runnerInputs.length

  await runApprovedDueSequenceExecutionJobs(mockAdmin, {
    actingUserId: "system",
    actingUserEmail: "cron@growth.equipify.internal",
    limit: 1,
  })

  const newInputs = trace.runnerInputs.slice(before)
  assert.equal(newInputs.length, 1, "cron batch runner must invoke sequence job run")
  assert.equal(newInputs[0]?.canonicalDecisionOverrideReason ?? null, null)
  assert.equal(newInputs[0]?.cronMode, true)
}

async function testAutonomousOrchestratorCannotInjectOverride(trace: IntegrationTrace): Promise<void> {
  const before = trace.runnerInputs.length
  const { executeBoundedAutonomousOutboundAction } = await import(
    "../lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator"
  )

  await executeBoundedAutonomousOutboundAction({
    admin: {} as SupabaseClient,
    organizationId: TEST_ORG_ID,
    scopeId: "scope-integration-test",
    actionType: "send_email",
    leadId: TEST_LEAD_ID,
    sequenceJobId: TEST_JOB_ID,
    leadEmail: "josh.block@blockimaging.com",
    actingUserId: "bounded-autonomous-outbound-executor",
  })

  const newInputs = trace.runnerInputs.slice(before)
  assert.equal(newInputs.length, 1, "autonomous orchestrator must invoke sequence job run")
  assert.equal(newInputs[0]?.canonicalDecisionOverrideReason ?? null, null)
  assert.equal(newInputs[0]?.cronMode, true)
}

async function main(): Promise<void> {
  const harness = installHarness()

  try {
    console.log(`[${GE_AIOS_END_TO_END_HOTFIX_1B_INTEGRATION_QA_MARKER}] ${TEST_NAME}`)

    const positiveTrace = await testPositiveOverrideForwarding(harness.trace)
    console.log("  ✓ positive override survives HTTP → Zod → route → runner → enforcement")

    await testNoOverrideSupplied(harness.trace)
    console.log("  ✓ no override preserves prior blocked wait behavior")

    await testSchedulerPathCannotInjectOverride(harness.trace)
    console.log("  ✓ scheduler path cannot inject override")

    await testCronPathCannotInjectOverride(
      harness.trace,
      harness.runApprovedDueSequenceExecutionJobs,
      harness.mockAdmin,
    )
    console.log("  ✓ cron batch path cannot inject override")

    await testAutonomousOrchestratorCannotInjectOverride(harness.trace)
    console.log("  ✓ autonomous orchestrator cannot inject override")

    console.log(
      JSON.stringify(
        {
          ok: true,
          qaMarker: GE_AIOS_END_TO_END_HOTFIX_1B_INTEGRATION_QA_MARKER,
          testName: TEST_NAME,
          runtimeCallTrace: {
            positive: {
              httpBody: {
                humanApproved: true,
                humanApprovalConfirmed: true,
                canonicalDecisionOverrideReason: OVERRIDE_REASON,
              },
              runnerInput: {
                canonicalDecisionOverrideReason:
                  positiveTrace.runnerInput.canonicalDecisionOverrideReason ?? null,
              },
              enforcementInput: {
                operatorOverrideReason: positiveTrace.enforcementInput.operatorOverrideReason ?? null,
                allowed: positiveTrace.enforcementInput.allowed ?? null,
              },
            },
          },
        },
        null,
        2,
      ),
    )
    console.log("\nPASS")
  } finally {
    harness.restore()
  }
}

void main().catch((error) => {
  console.error(error)
  console.log("\nFAIL")
  process.exit(1)
})
