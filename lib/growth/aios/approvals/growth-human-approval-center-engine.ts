/** GE-AI-2H — Human Approval Center engine (client-safe, deterministic). */

import type {
  AiOsCommandCenterAttentionItem,
  AiOsCommandCenterWorkOrderSummary,
} from "@/lib/growth/aios/ai-os-command-center-types"
import type { GrowthLeadResearchExecutionPlanQueueItem } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthAutonomousMeetingRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { GrowthAutonomousOutreachPreparationRunRecord } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { RevenueOperatorOrchestrationRecord } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { GrowthPriorityBinding } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import type { GrowthMetaRecommendation } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import type { GrowthAdaptiveCalibrationProposal } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthAutomationApprovalRecord } from "@/lib/growth/automation/growth-automation-approval-types"
import type { GeV15PreparedAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import type { HumanExecutionApprovalItem } from "@/lib/growth/human-execution/human-execution-types"
import type { GrowthSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
  GROWTH_HUMAN_APPROVAL_CENTER_RANKING_FORMULA,
  GROWTH_HUMAN_APPROVAL_CENTER_RULE,
  type GrowthHumanApprovalActionType,
  type GrowthHumanApprovalCenterReadModel,
  type GrowthHumanApprovalCenterSummary,
  type GrowthHumanApprovalChannel,
  type GrowthHumanApprovalItem,
  type GrowthHumanApprovalSource,
  type GrowthHumanApprovalStatus,
} from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { filterHumanApprovalItemsThroughCanonicalEscalation } from "@/lib/growth/aios/approvals/growth-hac-escalation-gate-1f"
import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import {
  buildGrowthReviewHref,
  resolveOperatorPackageReviewHref,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export type GeV15ApprovalInboxSnapshotItem = {
  leadId: string
  leadName: string
  companyName: string
  action: GeV15PreparedAction
}

export type AiVoiceApprovalSnapshotItem = {
  sessionId: string
  leadId: string | null
  companyName: string | null
  workflowType: string
  status: string
  summary: string
  createdAt: string
  route: string
}

export type GrowthHumanApprovalCenterInput = {
  organizationId: string
  generatedAt: string
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  executionPlanReviewQueue: GrowthLeadResearchExecutionPlanQueueItem[]
  needsAttention: AiOsCommandCenterAttentionItem[]
  metaRecommendations: GrowthMetaRecommendation[]
  priorityBindings: GrowthPriorityBinding[]
  revenueOperatorOrchestrations: RevenueOperatorOrchestrationRecord[]
  geV15Inbox: GeV15ApprovalInboxSnapshotItem[]
  automationApprovals: GrowthAutomationApprovalRecord[]
  sequenceJobs: GrowthSequenceExecutionJob[]
  aiVoiceSessions: AiVoiceApprovalSnapshotItem[]
  humanExecutionApprovals: HumanExecutionApprovalItem[]
  outreachPreparationRuns: GrowthAutonomousOutreachPreparationRunRecord[]
  meetingPreparationRuns: GrowthAutonomousMeetingRunRecord[]
  boundedAutonomousOutbound?: GrowthBoundedAutonomousOutboundReadModel | null
  adaptiveCalibrationProposals?: GrowthAdaptiveCalibrationProposal[]
  /** AVA-GROWTH-OPERATOR-1F — portfolio authority for escalation deferral */
  canonicalAuthorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null
  topLimit?: number
  totalLimit?: number
}

const APPROVAL_CENTER_HREF = buildGrowthReviewHref({ tab: "packages" })

function stableApprovalId(parts: Array<string | number | null | undefined>): string {
  const fingerprint = parts.map((part) => String(part ?? "")).join("|")
  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `approval-${Math.abs(hash).toString(36)}`
}

function riskWeight(level: GrowthHumanApprovalItem["riskLevel"]): number {
  if (level === "high") return 100
  if (level === "medium") return 65
  return 35
}

function ageWeight(createdAt: string, generatedAt: string): number {
  const ageMs = Date.parse(generatedAt) - Date.parse(createdAt)
  if (!Number.isFinite(ageMs) || ageMs <= 0) return 40
  const ageHours = ageMs / (1000 * 60 * 60)
  return Math.min(100, Math.round(ageHours * 4))
}

export function computeHumanApprovalItemScore(input: {
  priorityScore: number
  riskLevel: GrowthHumanApprovalItem["riskLevel"]
  createdAt: string
  generatedAt: string
  urgencyBoost?: number
}): number {
  const raw =
    input.priorityScore * 0.45 +
    riskWeight(input.riskLevel) * 0.3 +
    (input.urgencyBoost ?? 50) * 0.15 +
    ageWeight(input.createdAt, input.generatedAt) * 0.1
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function mapGeV15ActionToApproval(action: GeV15PreparedAction): {
  source: GrowthHumanApprovalSource
  actionType: GrowthHumanApprovalActionType
  channel: GrowthHumanApprovalChannel
} {
  if (action.action === "prepare_sms") {
    return { source: "sms_sequence", actionType: "send_sms", channel: "sms" }
  }
  if (action.action === "prepare_voice_drop") {
    return { source: "voice_drop", actionType: "launch_voice_drop", channel: "voice" }
  }
  return { source: "email_sequence", actionType: "send_email", channel: "email" }
}

function mapSequenceChannel(channel: GrowthSequenceExecutionJob["channel"]): {
  source: GrowthHumanApprovalSource
  actionType: GrowthHumanApprovalActionType
  channel: GrowthHumanApprovalChannel
} {
  if (channel === "sms") {
    return { source: "sms_sequence", actionType: "send_sms", channel: "sms" }
  }
  if (channel === "voice_drop") {
    return { source: "voice_drop", actionType: "launch_voice_drop", channel: "voice" }
  }
  return { source: "email_sequence", actionType: "send_email", channel: "email" }
}

function mapAutomationActionType(actionType: GrowthAutomationApprovalRecord["actionType"]): {
  actionType: GrowthHumanApprovalActionType
  channel: GrowthHumanApprovalChannel
} {
  if (actionType === "send_sms") return { actionType: "send_sms", channel: "sms" }
  if (actionType === "send_voice_drop") return { actionType: "launch_voice_drop", channel: "voice" }
  if (actionType === "send_email") return { actionType: "send_email", channel: "email" }
  return { actionType: "approve_automation", channel: "none" }
}

export function collectAiWorkOrderApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.approvalWorkOrders.map((workOrder) => ({
    id: stableApprovalId(["ai_work_order", workOrder.workOrderId]),
    organizationId: input.organizationId,
    source: "ai_work_order",
    actionType: "review_recommendation",
    channel: "none",
    subjectType: "mission",
    subjectId: workOrder.missionId,
    title: `Approve ${workOrder.workOrderType.replaceAll("_", " ")}`,
    summary: `Work Order ${workOrder.workOrderId.slice(0, 8)} is ${workOrder.status.replaceAll("_", " ")}.`,
    riskLevel: workOrder.priority >= 700 ? "high" : workOrder.priority >= 400 ? "medium" : "low",
    priorityScore: Math.min(100, Math.round(workOrder.priority / 10)),
    status: "pending",
    evidence: [
      { source: "ai_work_orders", label: "Work order type", value: workOrder.workOrderType },
      { source: "ai_work_orders", label: "Status", value: workOrder.status },
      { source: "ai_work_orders", label: "Priority", value: workOrder.priority },
    ],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "ai_work_order_status_machine",
    },
    route: workOrder.planningReviewHref ?? `/growth/os/missions/${workOrder.missionId}/planning`,
    createdAt: workOrder.updatedAt,
  }))
}

export function collectExecutionPlanReviewItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.executionPlanReviewQueue
    .filter((item) => item.approvalStatus === "pending_review" || item.approvalRequired)
    .map((item) => ({
      id: stableApprovalId(["execution_plan", item.planId, item.leadId]),
      organizationId: input.organizationId,
      source: "execution_plan",
      actionType: "approve_execution_plan",
      channel: "none",
      subjectType: "lead",
      subjectId: item.leadId,
      title: `Review execution plan — ${item.companyName ?? item.leadId}`,
      summary: item.reason,
      riskLevel: item.confidence != null && item.confidence < 0.5 ? "high" : "medium",
      priorityScore: 78,
      status: item.approvalStatus === "blocked" ? "blocked" : "needs_review",
      evidence: [
        { source: "execution_plan_review", label: "Approval status", value: item.approvalStatus },
        { source: "execution_plan_review", label: "Workflow", value: item.recommendedWorkflow },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "growth_lead_research_execution_plan_review",
      },
      route: item.observationHref,
      createdAt: item.reviewUpdatedAt ?? item.createdAt,
    }))
}

export function collectGeV15ApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.geV15Inbox.map((row) => {
    const mapped = mapGeV15ActionToApproval(row.action)
    return {
      id: stableApprovalId(["ge_v15", row.leadId, row.action.id]),
      organizationId: input.organizationId,
      source: mapped.source,
      actionType: mapped.actionType,
      channel: mapped.channel,
      subjectType: "lead",
      subjectId: row.leadId,
      title: `${row.companyName} — ${row.action.action.replaceAll("_", " ")}`,
      summary: row.action.summary ?? `Prepared ${mapped.channel} action awaiting operator review.`,
      riskLevel: mapped.channel === "sms" ? "high" : mapped.channel === "voice" ? "high" : "medium",
      priorityScore: mapped.channel === "sms" ? 88 : 75,
      status:
        row.action.status === "pending_approval" || row.action.status === "prepared"
          ? "pending"
          : "needs_review",
      evidence: [
        { source: "ge_v15_automation_runtime", label: "Action", value: row.action.action },
        { source: "ge_v15_automation_runtime", label: "Status", value: row.action.status },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "ge_v15_automation_runtime_approval_gate",
      },
      route: "/growth/campaigns/sequences",
      createdAt: row.action.updatedAt,
    }
  })
}

export function collectAutomationFlowApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.automationApprovals.map((approval) => {
    const mapped = mapAutomationActionType(approval.actionType)
    return {
      id: stableApprovalId(["automation_flow", approval.approvalId]),
      organizationId: input.organizationId,
      source: "automation",
      actionType: mapped.actionType,
      channel: mapped.channel,
      subjectType: "lead",
      subjectId: approval.leadId,
      title: approval.previewPayload.summary,
      summary: `${approval.previewPayload.stepKind} step — ${approval.previewPayload.channel ?? "automation"} approval required.`,
      riskLevel: approval.riskLevel,
      priorityScore: approval.riskLevel === "high" ? 90 : approval.riskLevel === "medium" ? 70 : 55,
      status: approval.status === "pending" ? "pending" : "needs_review",
      evidence: [
        { source: "growth_automation_flow", label: "Action type", value: approval.actionType },
        { source: "growth_automation_flow", label: "Risk", value: approval.riskLevel },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "growth_automation_approval_service",
      },
      route: "/growth/campaigns/sequences",
      createdAt: approval.createdAt,
    }
  })
}

export function collectSequenceJobApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.sequenceJobs
    .filter((job) => job.status === "pending_approval")
    .map((job) => {
      const mapped = mapSequenceChannel(job.channel)
      return {
        id: stableApprovalId(["sequence_job", job.id]),
        organizationId: input.organizationId,
        source: mapped.source,
        actionType: mapped.actionType,
        channel: mapped.channel,
        subjectType: "lead",
        subjectId: job.leadId,
        title: `Sequence ${mapped.channel} step pending approval`,
        summary:
          mapped.channel === "sms"
            ? "Due sequence SMS step queued for human approval — no auto-send."
            : mapped.channel === "voice"
              ? "Due sequence voice drop step queued for human approval — no auto-send."
              : "Due sequence email step queued for human approval — no auto-send.",
        riskLevel: mapped.channel === "sms" || mapped.channel === "voice" ? "high" : "medium",
        priorityScore: mapped.channel === "sms" ? 92 : 80,
        status: "pending",
        evidence: [
          { source: "sequence_execution_jobs", label: "Channel", value: job.channel },
          { source: "sequence_execution_jobs", label: "Status", value: job.status },
          { source: "sequence_execution_jobs", label: "Scheduled for", value: job.scheduledFor },
        ],
        policy: {
          requiresHumanApproval: true,
          enforcementSource: "sequence_approval_gate",
        },
        route: "/growth/campaigns/sequences",
        createdAt: job.createdAt,
      }
    })
}

export function collectAiVoiceApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.aiVoiceSessions.map((session) => ({
    id: stableApprovalId(["ai_voice", session.sessionId]),
    organizationId: input.organizationId,
    source: "ai_voice",
    actionType: "start_ai_voice_session",
    channel: "voice",
    subjectType: session.leadId ? "lead" : "system",
    subjectId: session.leadId ?? undefined,
    title: `AI voice session — ${session.workflowType.replaceAll("_", " ")}`,
    summary: session.summary,
    riskLevel: "high",
    priorityScore: 85,
    status: session.status === "blocked_by_compliance" ? "blocked" : "pending",
    evidence: [
      { source: "voice_ai_outbound", label: "Workflow", value: session.workflowType },
      { source: "voice_ai_outbound", label: "Status", value: session.status },
    ],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "voice_ai_outbound_approval_workflow",
    },
    route: session.route,
    createdAt: session.createdAt,
  }))
}

export function collectHumanExecutionApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.humanExecutionApprovals
    .filter((item) => item.approvalStatus === "draft" || item.approvalStatus === "review")
    .map((item) => ({
      id: stableApprovalId(["human_execution", item.id]),
      organizationId: input.organizationId,
      source: "human_execution",
      actionType: item.channel === "sms" ? "send_sms" : item.channel === "email" ? "send_email" : "place_call",
      channel:
        item.channel === "sms"
          ? "sms"
          : item.channel === "email"
            ? "email"
            : item.channel === "manual_call" || item.channel === "voicemail"
              ? "call"
              : "none",
      subjectType: "lead",
      subjectId: item.leadId,
      title: item.title,
      summary: item.why,
      riskLevel: item.readinessBand === "critical" || item.readinessBand === "high" ? "high" : "medium",
      priorityScore: Math.min(100, item.readinessScore),
      status: item.approvalStatus === "review" ? "needs_review" : "pending",
      evidence: [
        { source: "human_execution", label: "Channel", value: item.channel },
        { source: "human_execution", label: "Readiness", value: item.readinessScore },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "human_execution_approval_gate",
      },
      route: item.ctaHref,
      createdAt: item.createdAt,
    }))
}

export function collectOutreachPackageApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  const items: GrowthHumanApprovalItem[] = []
  for (const run of input.outreachPreparationRuns) {
    const pkg = run.approvalPackage
    if (!pkg?.pendingHumanApproval) continue
    if (pkg.packageApprovalDecision === "approved" || pkg.packageApprovalDecision === "rejected") {
      continue
    }
    const hasSms = pkg.generatedAssets.some((asset) => asset.channel === "sms")
    const hasEmail = pkg.generatedAssets.some((asset) => asset.channel === "email")
    items.push({
      id: stableApprovalId(["outreach_package", pkg.packageId]),
      organizationId: input.organizationId,
      source: "outreach_package",
      actionType: hasSms ? "approve_outreach_package" : "approve_outreach_package",
      channel: hasSms ? "sms" : hasEmail ? "email" : "none",
      subjectType: "lead",
      subjectId: pkg.leadId,
      title: `Outreach package — ${pkg.companyName ?? pkg.leadId}`,
      summary: pkg.expectedOutcome,
      riskLevel: hasSms ? "high" : "medium",
      priorityScore: Math.round(pkg.confidence * 100),
      status: "needs_review",
      evidence: [
        { source: "outreach_preparation_pilot", label: "Recommended channel", value: pkg.recommendedChannel },
        { source: "outreach_preparation_pilot", label: "Assets", value: pkg.generatedAssets.length },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "autonomous_outreach_preparation_pilot",
        blockedReason: "Transport blocked — draft only until human approval.",
      },
      route: resolveOperatorPackageReviewHref({
        leadId: pkg.leadId,
        packageId: pkg.packageId,
      }),
      createdAt: pkg.preparedAt,
    })
  }
  return items
}

export function collectMeetingPrepApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  const items: GrowthHumanApprovalItem[] = []
  for (const run of input.meetingPreparationRuns) {
    const pkg = run.preparationPackage
    if (!pkg?.pendingHumanApproval) continue
    items.push({
      id: stableApprovalId(["meeting_prep", pkg.packageId]),
      organizationId: input.organizationId,
      source: "meeting_prep",
      actionType: "approve_meeting_prep",
      channel: "none",
      subjectType: "lead",
      subjectId: pkg.leadId,
      title: `Meeting prep — ${pkg.companyName ?? pkg.leadId}`,
      summary: pkg.expectedOutcome,
      riskLevel: "medium",
      priorityScore: Math.round(pkg.confidence * 100),
      status: "needs_review",
      evidence: [
        { source: "meeting_preparation_pilot", label: "Assets", value: pkg.generatedAssets.length },
        { source: "meeting_preparation_pilot", label: "Confidence", value: pkg.confidence },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "autonomous_meeting_preparation_pilot",
      },
      route: `/growth/os/pilot/lead-research/${pkg.leadId}`,
      createdAt: pkg.preparedAt,
    })
  }
  return items
}

export function collectRevenueOperatorReviewItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.revenueOperatorOrchestrations
    .filter((row) => row.orchestrationDecision === "human_review_required")
    .map((row) => ({
      id: stableApprovalId(["revenue_operator", row.orchestrationId]),
      organizationId: input.organizationId,
      source: "revenue_operator",
      actionType: "review_recommendation",
      channel: "none",
      subjectType: "lead",
      subjectId: row.leadId,
      title: `${row.companyName ?? row.leadId} — human review required`,
      summary: row.reasoning,
      riskLevel: row.escalationLevel === "critical" || row.escalationLevel === "high" ? "high" : "medium",
      priorityScore: Math.round(row.confidence * 100),
      status: row.blockedReasons.length > 0 ? "blocked" : "needs_review",
      evidence: [
        { source: "revenue_operator", label: "Decision", value: row.orchestrationDecision },
        { source: "revenue_operator", label: "Escalation", value: row.escalationLevel },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "revenue_operator_orchestration_engine",
        blockedReason: row.policyBlockReasons?.[0] ?? row.blockedReasons[0],
      },
      route: `/growth/os/pilot/lead-research/${row.leadId}`,
      createdAt: row.evaluationTimestamp,
    }))
}

export function collectMetaRecommenderApprovalSignals(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.metaRecommendations
    .filter((rec) => rec.policy.requiresHumanApproval)
    .slice(0, 20)
    .map((rec) => ({
      id: stableApprovalId(["meta_recommender", rec.id]),
      organizationId: input.organizationId,
      source: "meta_recommender",
      actionType:
        rec.recommendationType === "call"
          ? "place_call"
          : rec.recommendationType === "sms"
            ? "send_sms"
            : rec.recommendationType === "email"
              ? "send_email"
              : rec.recommendationType === "prepare_outreach"
                ? "send_email"
                : rec.recommendationType === "review"
                  ? "review_recommendation"
                  : "review_recommendation",
      channel:
        rec.recommendationType === "sms"
          ? "sms"
          : rec.recommendationType === "email" || rec.recommendationType === "prepare_outreach"
            ? "email"
            : rec.recommendationType === "call"
              ? "call"
              : "none",
      subjectType:
        rec.scope === "lead"
          ? "lead"
          : rec.scope === "objective"
            ? "objective"
            : rec.scope === "system"
              ? "system"
              : "lead",
      subjectId: rec.subjectId,
      title: rec.title,
      summary: rec.summary,
      riskLevel: rec.urgency >= 85 ? "high" : rec.urgency >= 60 ? "medium" : "low",
      priorityScore: rec.score,
      status: rec.policy.blockedReason ? "blocked" : "needs_review",
      evidence: rec.evidence,
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "meta_recommender_policy",
        autonomyCapability: rec.policy.autonomyCapability,
        blockedReason: rec.policy.blockedReason,
      },
      route: rec.suggestedAction?.route,
      createdAt: rec.createdAt,
    }))
}

export function collectPriorityBindingApprovalSignals(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.priorityBindings
    .filter((binding) => binding.status === "needs_approval")
    .slice(0, 20)
    .map((binding) => ({
      id: stableApprovalId(["priority_binding", binding.id]),
      organizationId: input.organizationId,
      source: "priority_binding",
      actionType: "review_blocker",
      channel:
        binding.recommendedNextStep === "prepare_outreach"
          ? "email"
          : binding.recommendedNextStep === "approve_outreach"
            ? "sms"
            : "none",
      subjectType: binding.objectiveId ? "objective" : binding.leadId ? "lead" : "system",
      subjectId: binding.objectiveId ?? binding.leadId ?? binding.missionId,
      title: binding.title,
      summary: binding.summary,
      riskLevel: binding.blockers.some((blocker) => blocker.severity === "high") ? "high" : "medium",
      priorityScore: binding.priorityScore,
      status: "needs_review",
      evidence: binding.evidence,
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "priority_engine_binding",
        blockedReason: binding.blockers.find((blocker) => blocker.type === "approval")?.label,
      },
      route: binding.route,
      createdAt: binding.createdAt,
    }))
}

export function collectAttentionApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return input.needsAttention
    .filter((item) => item.kind === "approval_required")
    .map((item) => ({
      id: stableApprovalId(["needs_attention", item.id]),
      organizationId: input.organizationId,
      source: "ai_work_order",
      actionType: "review_recommendation",
      channel: "none",
      subjectType: item.leadId ? "lead" : item.missionId ? "mission" : "system",
      subjectId: item.leadId ?? item.missionId ?? undefined,
      title: item.title,
      summary: item.summary,
      riskLevel: item.severity === "high" ? "high" : item.severity === "medium" ? "medium" : "low",
      priorityScore: item.severity === "high" ? 90 : 70,
      status: "pending",
      evidence: [
        { source: "command_center.needs_attention", label: "Kind", value: item.kind },
        { source: "command_center.needs_attention", label: "Severity", value: item.severity },
      ],
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "command_center_attention",
      },
      route: item.href ?? undefined,
      createdAt: input.generatedAt,
    }))
}

export function collectAdaptiveCalibrationApprovalItems(input: GrowthHumanApprovalCenterInput): GrowthHumanApprovalItem[] {
  return (input.adaptiveCalibrationProposals ?? [])
    .filter((row) => row.status === "proposed")
    .slice(0, 20)
    .map((proposal) => ({
      id: `adaptive-calibration-${proposal.id}`,
      organizationId: input.organizationId,
      source: "adaptive_calibration",
      actionType: "review_recommendation",
      channel: "none",
      subjectType: "system",
      subjectId: proposal.id,
      title: proposal.title,
      summary: proposal.summary,
      riskLevel: proposal.riskLevel,
      priorityScore: Math.round(proposal.impact * 100),
      status: "needs_review",
      evidence: proposal.evidence.map((row) => ({
        source: row.source,
        label: row.label,
        value: row.value,
      })),
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "adaptive_calibration_service",
      },
      route: `/growth/os/ai-operations#adaptive-calibration`,
      createdAt: proposal.createdAt,
    }))
}

export function collectAdaptiveCalibrationReadyToApplyItems(
  input: GrowthHumanApprovalCenterInput,
): GrowthHumanApprovalItem[] {
  return (input.adaptiveCalibrationProposals ?? [])
    .filter((row) => row.status === "approved")
    .slice(0, 20)
    .map((proposal) => ({
      id: `adaptive-calibration-apply-${proposal.id}`,
      organizationId: input.organizationId,
      source: "adaptive_calibration",
      actionType: "review_recommendation",
      channel: "none",
      subjectType: "system",
      subjectId: proposal.id,
      title: `Ready to apply: ${proposal.title}`,
      summary: `${proposal.summary} Operator must explicitly apply — approval alone does not mutate configuration.`,
      riskLevel: proposal.riskLevel,
      priorityScore: Math.round(proposal.impact * 100) + 10,
      status: "needs_review",
      evidence: proposal.evidence.map((row) => ({
        source: row.source,
        label: row.label,
        value: row.value,
      })),
      policy: {
        requiresHumanApproval: true,
        enforcementSource: "adaptive_calibration_apply_service",
      },
      route: `/api/platform/growth/ai-os/adaptive-calibration/${proposal.id}/apply`,
      createdAt: proposal.createdAt,
    }))
}

export function collectAutonomousOutboundScopeApprovalItems(
  input: GrowthHumanApprovalCenterInput,
): GrowthHumanApprovalItem[] {
  const outbound = input.boundedAutonomousOutbound
  if (!outbound) return []

  const rows = [
    ...outbound.activeScopes.map((row) => ({ row, status: "active" as const })),
    ...outbound.blockedScopes.map((row) => ({ row, status: "blocked" as const })),
    ...outbound.approvedScopes.map((row) => ({ row, status: "approved" as const })),
  ]

  return rows.map(({ row, status }) => ({
    id: stableApprovalId(["autonomous_outbound_scope", row.scope.id, status]),
    organizationId: input.organizationId,
    source: "autonomous_outbound_scope",
    actionType: "other",
    channel:
      row.scope.allowedChannels.includes("sms")
        ? "sms"
        : row.scope.allowedChannels.includes("email")
          ? "email"
          : "none",
    subjectType: row.scope.source === "objective" ? "objective" : "campaign",
    subjectId: row.scope.sourceId,
    title: row.scope.title,
    summary: `${status} scope — ${row.consumption.actionsToday}/${row.scope.limits.maxActionsPerDay} actions today · next: ${row.nextQueuedAction?.actionType ?? "none"}`,
    riskLevel: status === "blocked" ? "high" : status === "active" ? "medium" : "low",
    priorityScore: status === "blocked" ? 92 : status === "active" ? 78 : 55,
    status: status === "blocked" ? "blocked" : status === "active" ? "needs_review" : "approved_elsewhere",
    evidence: [
      { source: "bounded_autonomous_outbound", label: "Scope ID", value: row.scope.id },
      { source: "bounded_autonomous_outbound", label: "Status", value: row.scope.status },
      { source: "bounded_autonomous_outbound", label: "Source", value: `${row.scope.source}:${row.scope.sourceId}` },
      { source: "bounded_autonomous_outbound", label: "Channels", value: row.scope.allowedChannels.join(", ") || "none" },
      {
        source: "bounded_autonomous_outbound",
        label: "Audience size",
        value:
          (row.scope.audience.leadIds?.length ?? 0) +
          (row.scope.audience.companyIds?.length ?? 0) +
          (row.scope.audience.personIds?.length ?? 0),
      },
      { source: "bounded_autonomous_outbound", label: "Actions total", value: row.consumption.actionsTotal },
      {
        source: "bounded_autonomous_outbound",
        label: "Daily limit",
        value: row.scope.limits.maxActionsPerDay,
      },
      {
        source: "bounded_autonomous_outbound",
        label: "Stop conditions",
        value: row.activeStopConditions.join(", ") || "none",
      },
      ...(row.communicationPlanSummary
        ? [
            {
              source: "communication_engine",
              label: "Primary channel",
              value: row.communicationPlanSummary.primaryChannel ?? "none",
            },
            {
              source: "communication_engine",
              label: "Fallback channel",
              value: row.communicationPlanSummary.fallbackChannel ?? "none",
            },
            {
              source: "communication_engine",
              label: "Strategy",
              value: row.communicationPlanSummary.recommendedStrategy,
            },
            {
              source: "communication_engine",
              label: "Approval-required steps",
              value: row.communicationPlanSummary.approvalRequiredSteps.join(", ") || "none",
            },
            {
              source: "communication_engine",
              label: "Blocked channels",
              value:
                row.communicationPlanSummary.blockedChannels.map((c) => c.channel).join(", ") || "none",
            },
            {
              source: "communication_engine",
              label: "Plan confidence",
              value: row.communicationPlanSummary.confidence,
            },
          ]
        : []),
    ],
    policy: {
      requiresHumanApproval: true,
      autonomyCapability: row.scope.policy.autonomyCapability,
      enforcementSource: row.scope.policy.enforcementSource,
      blockedReason: row.scope.blockedReason ?? undefined,
    },
    route: row.configureHref,
    createdAt: row.scope.updatedAt,
    expiresAt: row.scope.expiresAt,
  }))
}

type ApprovalCollector = {
  source: string
  collect: (input: GrowthHumanApprovalCenterInput) => GrowthHumanApprovalItem[]
}

export const GROWTH_HUMAN_APPROVAL_CENTER_SOURCE_COLLECTORS: readonly ApprovalCollector[] = [
  { source: "ai_work_orders.approval_queue", collect: collectAiWorkOrderApprovalItems },
  { source: "execution_plan_review.pending", collect: collectExecutionPlanReviewItems },
  { source: "ge_v15_automation_runtime.inbox", collect: collectGeV15ApprovalItems },
  { source: "growth_automation_flow.pending", collect: collectAutomationFlowApprovalItems },
  { source: "sequence_execution_jobs.pending", collect: collectSequenceJobApprovalItems },
  { source: "voice_ai_outbound.pending", collect: collectAiVoiceApprovalItems },
  { source: "human_execution.pending", collect: collectHumanExecutionApprovalItems },
  { source: "outreach_preparation.packages", collect: collectOutreachPackageApprovalItems },
  { source: "meeting_preparation.packages", collect: collectMeetingPrepApprovalItems },
  { source: "revenue_operator.human_review", collect: collectRevenueOperatorReviewItems },
  { source: "command_center.needs_attention", collect: collectAttentionApprovalItems },
  { source: "meta_recommender.requires_approval", collect: collectMetaRecommenderApprovalSignals },
  { source: "priority_binding.needs_approval", collect: collectPriorityBindingApprovalSignals },
  { source: "bounded_autonomous_outbound.scopes", collect: collectAutonomousOutboundScopeApprovalItems },
  { source: "adaptive_calibration.proposals", collect: collectAdaptiveCalibrationApprovalItems },
  { source: "adaptive_calibration.ready_to_apply", collect: collectAdaptiveCalibrationReadyToApplyItems },
]

function dedupeKey(item: GrowthHumanApprovalItem): string {
  return `${item.source}|${item.subjectId ?? ""}|${item.actionType}|${item.channel ?? ""}|${item.title}`
}

export function rankHumanApprovalItems(
  items: GrowthHumanApprovalItem[],
  generatedAt: string,
): GrowthHumanApprovalItem[] {
  return [...items]
    .map((item) => ({
      ...item,
      priorityScore: computeHumanApprovalItemScore({
        priorityScore: item.priorityScore,
        riskLevel: item.riskLevel,
        createdAt: item.createdAt,
        generatedAt,
        urgencyBoost: item.riskLevel === "high" ? 90 : 55,
      }),
    }))
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore
      return left.id.localeCompare(right.id)
    })
}

export function buildHumanApprovalCenterSummary(items: GrowthHumanApprovalItem[]): GrowthHumanApprovalCenterSummary {
  const pending = items.filter((item) => item.status === "pending" || item.status === "needs_review")
  const smsPending = pending.filter((item) => item.channel === "sms").length
  const emailPending = pending.filter((item) => item.channel === "email").length
  const voicePending = pending.filter(
    (item) => item.channel === "voice" || item.channel === "call" || item.actionType === "start_ai_voice_session",
  ).length
  const highestRisk = pending.find((item) => item.riskLevel === "high") ?? pending[0] ?? null

  return {
    totalPending: pending.length,
    smsPending,
    emailPending,
    voicePending,
    highestRiskTitle: highestRisk?.title ?? null,
    highestRiskLevel: highestRisk?.riskLevel ?? null,
    approvalCenterHref: APPROVAL_CENTER_HREF,
  }
}

export function synthesizeGrowthHumanApprovalCenterReadModel(
  input: GrowthHumanApprovalCenterInput,
): GrowthHumanApprovalCenterReadModel {
  const topLimit = input.topLimit ?? 10
  const totalLimit = input.totalLimit ?? 100
  const sourcesIncluded: string[] = []
  const sourcesFailed: Array<{ source: string; message: string }> = []
  const collected: GrowthHumanApprovalItem[] = []

  for (const collector of GROWTH_HUMAN_APPROVAL_CENTER_SOURCE_COLLECTORS) {
    try {
      const rows = collector.collect(input)
      collected.push(...rows)
      if (rows.length > 0) sourcesIncluded.push(collector.source)
    } catch (error) {
      sourcesFailed.push({
        source: collector.source,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const deduped = new Map<string, GrowthHumanApprovalItem>()
  for (const item of collected) {
    const key = dedupeKey(item)
    const existing = deduped.get(key)
    if (!existing || existing.priorityScore < item.priorityScore) {
      deduped.set(key, item)
    }
  }

  const escalated = filterHumanApprovalItemsThroughCanonicalEscalation({
    items: [...deduped.values()],
    canonicalAuthorityByLeadId: input.canonicalAuthorityByLeadId ?? null,
  })

  const ranked = rankHumanApprovalItems(escalated, input.generatedAt)
  const items = ranked.slice(0, totalLimit)
  const topItems = items.slice(0, topLimit)
  const summary = buildHumanApprovalCenterSummary(items)

  const byChannel: GrowthHumanApprovalCenterReadModel["filterCounts"]["byChannel"] = {}
  const bySource: GrowthHumanApprovalCenterReadModel["filterCounts"]["bySource"] = {}
  const byActionType: GrowthHumanApprovalCenterReadModel["filterCounts"]["byActionType"] = {}
  const byRiskLevel: GrowthHumanApprovalCenterReadModel["filterCounts"]["byRiskLevel"] = {}

  for (const item of items) {
    if (item.channel) byChannel[item.channel] = (byChannel[item.channel] ?? 0) + 1
    bySource[item.source] = (bySource[item.source] ?? 0) + 1
    byActionType[item.actionType] = (byActionType[item.actionType] ?? 0) + 1
    byRiskLevel[item.riskLevel] = (byRiskLevel[item.riskLevel] ?? 0) + 1
  }

  return {
    readOnly: true,
    qaMarker: GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_HUMAN_APPROVAL_CENTER_RULE,
    rankingFormula: GROWTH_HUMAN_APPROVAL_CENTER_RANKING_FORMULA,
    items,
    topItems,
    summary,
    filterCounts: { byChannel, bySource, byActionType, byRiskLevel },
    sourcesIncluded,
    sourcesFailed,
  }
}
