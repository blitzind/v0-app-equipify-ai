/**
 * GE-AI-2H — L3 Human Approval Center certification.
 * Run: pnpm test:ge-ai-2h-human-approval-center
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "../lib/growth/aios/ai-os-command-center-types"
import { GROWTH_MISSION_PRIORITY_QA_MARKER } from "../lib/growth/aios/growth/growth-mission-priority-types"
import {
  collectGeV15ApprovalItems,
  collectSequenceJobApprovalItems,
  rankHumanApprovalItems,
  synthesizeGrowthHumanApprovalCenterReadModel,
} from "../lib/growth/aios/approvals/growth-human-approval-center-engine"
import {
  GROWTH_AIOS_GE_AI_2H_PHASE,
  GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
  GROWTH_HUMAN_APPROVAL_CENTER_RANKING_FORMULA,
  GROWTH_HUMAN_APPROVAL_CENTER_RULE,
} from "../lib/growth/aios/approvals/growth-human-approval-center-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string, forbidden: string[]): void {
  const source = readSource(relativePath)
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

console.log(`[${GROWTH_AIOS_GE_AI_2H_PHASE}] Human Approval Center certification`)

assert.equal(GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER, "growth-ge-ai-2h-human-approval-center-v1")
assert.ok(GROWTH_HUMAN_APPROVAL_CENTER_RULE.includes("read-only"))
assert.ok(GROWTH_HUMAN_APPROVAL_CENTER_RANKING_FORMULA.includes("priorityScore"))

const requiredFiles = [
  "lib/growth/aios/approvals/growth-human-approval-center-types.ts",
  "lib/growth/aios/approvals/growth-human-approval-center-engine.ts",
  "lib/growth/aios/approvals/growth-human-approval-center-service.ts",
  "app/api/platform/growth/ai-os/approvals/route.ts",
  "app/(growth)/growth/os/approvals/page.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-human-approval-center-section.tsx",
  "components/growth/ai-os/approvals/growth-human-approval-center-panel.tsx",
  "docs/GE-AI-2H_HUMAN_APPROVAL_CENTER.md",
]
for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(process.cwd(), file)), `${file} must exist`)
}

const service = readSource("lib/growth/aios/approvals/growth-human-approval-center-service.ts")
assert.ok(service.includes('import "server-only"'))
assert.ok(service.includes("fetchGrowthHumanApprovalCenterReadModel"))
assert.equal(service.includes("transitionAiWorkOrder"), false)
assert.equal(service.includes("send-sms"), false)

const engine = readSource("lib/growth/aios/approvals/growth-human-approval-center-engine.ts")
assert.equal(engine.includes('import "server-only"'), false)
assert.ok(engine.includes("GROWTH_HUMAN_APPROVAL_CENTER_SOURCE_COLLECTORS"))
assert.ok(engine.includes("collectSequenceJobApprovalItems"))

const commandCenterService = readSource("lib/growth/aios/ai-os-command-center-service.ts")
assert.ok(commandCenterService.includes("fetchGrowthHumanApprovalCenterReadModel"))
assert.ok(commandCenterService.includes("humanApprovalCenter"))

const commandCenterTypes = readSource("lib/growth/aios/ai-os-command-center-types.ts")
assert.ok(commandCenterTypes.includes("humanApprovalCenter: GrowthHumanApprovalCenterReadModel"))

const route = readSource("app/api/platform/growth/ai-os/approvals/route.ts")
assert.ok(route.includes("requireGrowthEnginePlatformAccess(request)"))
assert.equal(route.includes("POST"), false)
assert.equal(route.includes("PUT"), false)

const panel = readSource("components/growth/ai-os/approvals/growth-human-approval-center-panel.tsx")
assert.ok(panel.includes("GrowthAvaCompletedWorkPanel"))
assert.equal(panel.includes('method: "POST"'), false)

const completedWorkPanel = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx",
)
assert.ok(completedWorkPanel.includes("/api/platform/growth/ai-os/approvals"))
assert.ok(completedWorkPanel.includes("GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER"))

const packageCard = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
)
assert.ok(packageCard.includes("buildAvaOperatorPackageActionApiPath"))
assert.ok(packageCard.includes("Authorize"))

const section = readSource("components/growth/ai-os/command-center/growth-ai-os-human-approval-center-section.tsx")
assert.equal(section.includes('method: "POST"'), false)
assert.ok(section.includes("GROWTH_AVA_COMPLETED_WORK_TITLE") || section.includes("Ava completed work"))
assert.ok(section.includes("completed"))

const generatedAt = "2026-06-25T16:00:00.000Z"

const smsSequenceJob = {
  id: "seq-job-sms-1",
  sequenceEnrollmentId: "enroll-1",
  sequenceStepId: "step-1",
  leadId: "lead-sms-1",
  channel: "sms" as const,
  status: "pending_approval" as const,
  scheduledFor: generatedAt,
  requiresHumanApproval: true,
  humanApproved: false,
  humanApprovalConfirmed: false,
  humanApprovedBy: null,
  smsDraftBody: "Hello from Equipify",
  smsToE164: "+15551234567",
  voiceDropCampaignId: null,
  createdAt: generatedAt,
  updatedAt: generatedAt,
}

const emailSequenceJob = {
  ...smsSequenceJob,
  id: "seq-job-email-1",
  leadId: "lead-email-1",
  channel: "email" as const,
  smsDraftBody: null,
  smsToE164: null,
}

const smsItems = collectSequenceJobApprovalItems({
  organizationId: "org-2h-cert",
  generatedAt,
  approvalWorkOrders: [],
  executionPlanReviewQueue: [],
  needsAttention: [],
  metaRecommendations: [],
  priorityBindings: [],
  revenueOperatorOrchestrations: [],
  geV15Inbox: [],
  automationApprovals: [],
  sequenceJobs: [smsSequenceJob],
  aiVoiceSessions: [],
  humanExecutionApprovals: [],
  outreachPreparationRuns: [],
  meetingPreparationRuns: [],
})

assert.equal(smsItems.length, 1)
assert.equal(smsItems[0]?.channel, "sms")
assert.equal(smsItems[0]?.actionType, "send_sms")
assert.equal(smsItems[0]?.source, "sms_sequence")
assert.equal(smsItems[0]?.route, "/growth/campaigns/sequences")

const geV15Sms = collectGeV15ApprovalItems({
  organizationId: "org-2h-cert",
  generatedAt,
  approvalWorkOrders: [],
  executionPlanReviewQueue: [],
  needsAttention: [],
  metaRecommendations: [],
  priorityBindings: [],
  revenueOperatorOrchestrations: [],
  geV15Inbox: [
    {
      leadId: "lead-ge-sms",
      leadName: "Taylor",
      companyName: "Acme",
      action: {
        id: "ge-action-sms",
        action: "prepare_sms",
        channel: "sms",
        title: "Prepare SMS",
        summary: "SMS draft prepared for review",
        status: "pending_approval",
        playbookId: "pb-1",
        trigger: "manual",
        createdAt: generatedAt,
        updatedAt: generatedAt,
      },
    },
  ],
  automationApprovals: [],
  sequenceJobs: [],
  aiVoiceSessions: [],
  humanExecutionApprovals: [],
  outreachPreparationRuns: [],
  meetingPreparationRuns: [],
})

assert.equal(geV15Sms[0]?.channel, "sms")
assert.equal(geV15Sms[0]?.policy.enforcementSource, "ge_v15_automation_runtime_approval_gate")

const fixtureInput = {
  organizationId: "org-2h-cert",
  generatedAt,
  approvalWorkOrders: [
    {
      workOrderId: "wo-1",
      missionId: "mission-1",
      workOrderType: "planning_review" as const,
      status: "awaiting_approval" as const,
      assignedAgent: "planning_agent",
      priority: 800,
      updatedAt: generatedAt,
      planningReviewHref: "/growth/os/missions/mission-1/planning",
    },
  ],
  executionPlanReviewQueue: [
    {
      planId: "plan-1",
      leadId: "lead-1",
      companyName: "Acme",
      recommendedWorkflow: "research_company",
      readinessStatus: "ready_for_review",
      approvalStatus: "pending_review" as const,
      approvalRequired: true,
      missingPrerequisites: [],
      estimatedDuration: "2d",
      estimatedCost: "low",
      confidence: 0.8,
      reason: "Execution plan ready for review",
      createdAt: generatedAt,
      reviewUpdatedAt: generatedAt,
      reviewedByUserId: null,
      observationHref: "/growth/os/pilot/lead-research/lead-1",
    },
  ],
  needsAttention: [],
  metaRecommendations: [
    {
      id: "meta-1",
      organizationId: "org-2h-cert",
      scope: "lead" as const,
      subjectId: "lead-1",
      recommendationType: "sms" as const,
      title: "Send follow-up SMS",
      summary: "Meta-recommender SMS signal",
      confidence: 80,
      urgency: 85,
      impact: 75,
      effort: 30,
      score: 70,
      evidence: [{ source: "meta", label: "Signal", value: "sms" }],
      policy: { requiresHumanApproval: true },
      createdAt: generatedAt,
    },
  ],
  priorityBindings: [
    {
      id: "bind-1",
      organizationId: "org-2h-cert",
      objectiveId: "obj-1",
      priorityRank: 1,
      priorityScore: 88,
      status: "needs_approval" as const,
      recommendedNextStep: "approve_outreach" as const,
      workflowAgent: "outreach_preparation" as const,
      title: "Approve outreach package",
      summary: "Priority binding blocker",
      evidence: [{ source: "priority_binding", label: "Status", value: "needs_approval" }],
      blockers: [{ type: "approval" as const, label: "Human approval required", severity: "high" as const }],
      route: "/growth/os/missions/obj-1/planning",
      createdAt: generatedAt,
    },
  ],
  revenueOperatorOrchestrations: [
    {
      orchestrationId: "orch-1",
      evaluationTimestamp: generatedAt,
      leadId: "lead-1",
      companyId: null,
      companyName: "Acme",
      currentLifecycleStage: "planning",
      owningAgent: "planning_agent",
      candidateAgents: ["planning_agent"],
      orchestrationDecision: "human_review_required",
      recommendedNextAgent: "planning_agent",
      confidence: 0.7,
      reasoning: "Human review required before execution handoff.",
      requiredGates: [],
      blockedReasons: [],
      escalationLevel: "medium",
      recommendedNextAction: "Review planning state",
      handoffPreview: null,
    },
  ],
  geV15Inbox: geV15Sms.map((row) => ({
    leadId: "lead-ge-sms",
    leadName: "Taylor",
    companyName: "Acme",
    action: {
      id: "ge-action-sms",
      action: "prepare_sms" as const,
      channel: "sms" as const,
      title: "Prepare SMS",
      summary: "SMS draft prepared for review",
      status: "pending_approval" as const,
      playbookId: "pb-1",
      trigger: "manual" as const,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    },
  })),
  automationApprovals: [],
  sequenceJobs: [smsSequenceJob, emailSequenceJob],
  aiVoiceSessions: [
    {
      sessionId: "voice-1",
      leadId: "lead-voice-1",
      companyName: "Voice Co",
      workflowType: "qualification_callback",
      status: "pending_operator_approval",
      summary: "AI voice session awaiting operator approval",
      createdAt: generatedAt,
      route: "/growth/settings/voice/readiness",
    },
  ],
  humanExecutionApprovals: [],
  outreachPreparationRuns: [],
  meetingPreparationRuns: [],
}

const readModelA = synthesizeGrowthHumanApprovalCenterReadModel(fixtureInput)
const readModelB = synthesizeGrowthHumanApprovalCenterReadModel(fixtureInput)

assert.equal(readModelA.qaMarker, GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER)
assert.ok(readModelA.items.length >= 5)
assert.ok(readModelA.summary.smsPending >= 2)
assert.ok(readModelA.summary.emailPending >= 1)
assert.ok(readModelA.filterCounts.byChannel.sms != null && readModelA.filterCounts.byChannel.sms >= 2)
assert.ok(readModelA.items.every((item) => item.policy.requiresHumanApproval))
assert.ok(readModelA.items.every((item) => item.evidence.length > 0))
assert.deepEqual(
  readModelA.topItems.map((item) => item.id),
  readModelB.topItems.map((item) => item.id),
)

const ranked = rankHumanApprovalItems(readModelA.items, generatedAt)
assert.ok(ranked[0].priorityScore >= ranked.at(-1)!.priorityScore)

assert.ok(readModelA.sourcesIncluded.length > 0)

for (const file of [
  "lib/growth/aios/approvals/growth-human-approval-center-engine.ts",
  "lib/growth/aios/approvals/growth-human-approval-center-service.ts",
  "lib/growth/aios/ai-os-command-center-service.ts",
]) {
  assertNoCoreTouch(file, ["public.invoices", "public.quotes", "send-sms", "transitionAiWorkOrder"])
}

assert.equal(readSource("lib/growth/aios/approvals/growth-human-approval-center-service.ts").includes("schedulerActive: true"), false)

const regressionScripts = [
  "test:ge-ai-2e-priority-engine-binding",
  "test:ge-ai-2f-meta-recommender",
  "test:prod-regression-6-command-center-import-stability",
  "test:ge-aios-5c-command-center-read-model-foundation",
]
for (const script of regressionScripts) {
  execSync(`pnpm ${script}`, { stdio: "inherit", cwd: process.cwd() })
}

console.log(`[${GROWTH_AIOS_GE_AI_2H_PHASE}] PASS — Human Approval Center certified (local)`)

