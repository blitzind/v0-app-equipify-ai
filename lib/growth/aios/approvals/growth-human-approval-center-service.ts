/** GE-AI-2H / GE-AIOS-OPERATOR-UX-1A — Human Approval Center service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import {
  synthesizeGrowthHumanApprovalCenterReadModel,
  buildHumanApprovalCenterSummary,
  type AiVoiceApprovalSnapshotItem,
  type GeV15ApprovalInboxSnapshotItem,
  type GrowthHumanApprovalCenterInput,
} from "@/lib/growth/aios/approvals/growth-human-approval-center-engine"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import {
  collectSubjectLeadIdsFromApprovalItems,
  fetchCompletedWorkLeadLifecycleMap,
} from "@/lib/growth/aios/approvals/completed-work-lead-lifecycle"
import { filterActiveCompletedWorkItems } from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import { fetchBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-service"
import { listGeV15OrganizationApprovalInbox } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval-inbox"
import { listPendingAutomationApprovals } from "@/lib/growth/automation/growth-automation-approval-service"
import { listHumanExecutionApprovals } from "@/lib/growth/human-execution/human-execution-repository"
import { listSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { listPendingApprovalOutboundSessions } from "@/lib/voice/repository/voice-ai-outbound-repository"

export function buildGrowthHumanApprovalCenterReadModel(input: {
  organizationId: string
  generatedAt: string
  commandCenter: Pick<
    AiOsCommandCenterReadModel,
    | "approvalWorkOrders"
    | "executionPlanReviewQueue"
    | "needsAttention"
    | "metaRecommender"
    | "priorityBinding"
    | "revenueOperator"
    | "autonomousOutreachPreparationPilot"
    | "autonomousMeetingPilot"
  >
  geV15Inbox?: GeV15ApprovalInboxSnapshotItem[]
  automationApprovals?: GrowthHumanApprovalCenterInput["automationApprovals"]
  sequenceJobs?: GrowthHumanApprovalCenterInput["sequenceJobs"]
  aiVoiceSessions?: AiVoiceApprovalSnapshotItem[]
  humanExecutionApprovals?: GrowthHumanApprovalCenterInput["humanExecutionApprovals"]
  boundedAutonomousOutbound?: GrowthHumanApprovalCenterInput["boundedAutonomousOutbound"]
  adaptiveCalibrationProposals?: GrowthHumanApprovalCenterInput["adaptiveCalibrationProposals"]
  topLimit?: number
  totalLimit?: number
}): GrowthHumanApprovalCenterReadModel {
  const engineInput: GrowthHumanApprovalCenterInput = {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    approvalWorkOrders: input.commandCenter.approvalWorkOrders,
    executionPlanReviewQueue: input.commandCenter.executionPlanReviewQueue,
    needsAttention: input.commandCenter.needsAttention,
    metaRecommendations: input.commandCenter.metaRecommender.recommendations,
    priorityBindings: input.commandCenter.priorityBinding.bindings.filter(
      (binding) => binding.status === "needs_approval",
    ),
    revenueOperatorOrchestrations: input.commandCenter.revenueOperator.orchestrations,
    geV15Inbox: input.geV15Inbox ?? [],
    automationApprovals: input.automationApprovals ?? [],
    sequenceJobs: input.sequenceJobs ?? [],
    aiVoiceSessions: input.aiVoiceSessions ?? [],
    humanExecutionApprovals: input.humanExecutionApprovals ?? [],
    outreachPreparationRuns: input.commandCenter.autonomousOutreachPreparationPilot.recentRuns,
    meetingPreparationRuns: input.commandCenter.autonomousMeetingPilot.recentRuns,
    boundedAutonomousOutbound: input.boundedAutonomousOutbound ?? null,
    adaptiveCalibrationProposals: input.adaptiveCalibrationProposals ?? [],
    topLimit: input.topLimit,
    totalLimit: input.totalLimit,
  }

  return synthesizeGrowthHumanApprovalCenterReadModel(engineInput)
}

export async function fetchGrowthHumanApprovalCenterReadModel(
  admin: SupabaseClient,
  input: {
    organizationId: string
    commandCenter: Parameters<typeof buildGrowthHumanApprovalCenterReadModel>[0]["commandCenter"]
    generatedAt: string
    adaptiveCalibrationProposals?: GrowthHumanApprovalCenterInput["adaptiveCalibrationProposals"]
    topLimit?: number
    totalLimit?: number
  },
): Promise<GrowthHumanApprovalCenterReadModel> {
  const [geV15Result, automationResult, sequenceResult, voiceResult, humanExecResult] =
    await Promise.allSettled([
      listGeV15OrganizationApprovalInbox(admin, { organizationId: input.organizationId, limit: 100 }),
      listPendingAutomationApprovals(admin, { organizationId: input.organizationId, status: "pending_only" }),
      listSequenceExecutionJobs(admin, { status: "pending_approval", limit: 100 }),
      listPendingApprovalOutboundSessions(admin, input.organizationId, 50),
      listHumanExecutionApprovals(admin, { status: ["draft", "review"], limit: 50 }),
    ])

  const geV15Inbox: GeV15ApprovalInboxSnapshotItem[] =
    geV15Result.status === "fulfilled"
      ? geV15Result.value.map((row) => ({
          leadId: row.leadId,
          leadName: row.leadName,
          companyName: row.companyName,
          action: row.action,
        }))
      : []

  const automationApprovals = automationResult.status === "fulfilled" ? automationResult.value : []
  const sequenceJobs = sequenceResult.status === "fulfilled" ? sequenceResult.value : []

  const aiVoiceSessions: AiVoiceApprovalSnapshotItem[] =
    voiceResult.status === "fulfilled"
      ? voiceResult.value.map((session) => ({
          sessionId: session.id,
          leadId: session.relatedProspectId,
          companyName: null,
          workflowType: session.outboundWorkflowType,
          status: session.outboundSessionStatus,
          summary:
            session.messagePreview ??
            `AI voice session ${session.outboundWorkflowType.replaceAll("_", " ")} awaiting operator approval.`,
          createdAt: session.createdAt,
          route: "/growth/settings/voice/readiness",
        }))
      : []

  const humanExecutionApprovals =
    humanExecResult.status === "fulfilled" ? humanExecResult.value : []

  const boundedAutonomousOutbound = await fetchBoundedAutonomousOutboundReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
  })

  const readModel = buildGrowthHumanApprovalCenterReadModel({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    commandCenter: input.commandCenter,
    geV15Inbox,
    automationApprovals,
    sequenceJobs,
    aiVoiceSessions,
    humanExecutionApprovals,
    boundedAutonomousOutbound,
    adaptiveCalibrationProposals: input.adaptiveCalibrationProposals,
    topLimit: input.topLimit,
    totalLimit: input.totalLimit,
  })

  // OPERATOR-UX-1A — exclude archived/disqualified leads from active Completed Work.
  let filteredModel = readModel
  try {
    const leadIds = collectSubjectLeadIdsFromApprovalItems(readModel.items)
    const lifecycleById = await fetchCompletedWorkLeadLifecycleMap(admin, leadIds)
    const activeItems = filterActiveCompletedWorkItems({
      items: readModel.items,
      leadLifecycleById: lifecycleById,
    })
    if (activeItems.length !== readModel.items.length) {
      const topLimit = input.topLimit ?? 10
      filteredModel = {
        ...readModel,
        items: activeItems,
        topItems: activeItems.slice(0, topLimit),
        summary: buildHumanApprovalCenterSummary(activeItems),
      }
    }
  } catch {
    // Fail open on lifecycle lookup so approvals remain visible if lead query fails.
    filteredModel = readModel
  }

  const externalFailures: Array<{ source: string; message: string }> = []
  if (geV15Result.status === "rejected") {
    externalFailures.push({ source: "ge_v15_automation_runtime.inbox.fetch", message: String(geV15Result.reason) })
  }
  if (automationResult.status === "rejected") {
    externalFailures.push({ source: "growth_automation_flow.fetch", message: String(automationResult.reason) })
  }
  if (sequenceResult.status === "rejected") {
    externalFailures.push({ source: "sequence_execution_jobs.fetch", message: String(sequenceResult.reason) })
  }
  if (voiceResult.status === "rejected") {
    externalFailures.push({ source: "voice_ai_outbound.fetch", message: String(voiceResult.reason) })
  }
  if (humanExecResult.status === "rejected") {
    externalFailures.push({ source: "human_execution.fetch", message: String(humanExecResult.reason) })
  }

  if (externalFailures.length === 0) return filteredModel

  return {
    ...filteredModel,
    sourcesFailed: [...filteredModel.sourcesFailed, ...externalFailures],
  }
}
