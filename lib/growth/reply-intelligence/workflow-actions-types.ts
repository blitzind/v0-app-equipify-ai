/** Client-safe types for reply workflow action center (Sprint 2). */

import type { GrowthReplyWorkflowActionType } from "@/lib/growth/reply-intelligence/reply-intent-types"

export const GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER = "growth-reply-workflow-center-v1" as const

export const GROWTH_REPLY_WORKFLOW_ACTION_CATEGORIES = [
  "interested",
  "call_task",
  "follow_up",
  "opportunity",
  "sequence_exit",
  "other",
] as const

export type GrowthReplyWorkflowActionCategory = (typeof GROWTH_REPLY_WORKFLOW_ACTION_CATEGORIES)[number]

export type GrowthReplyWorkflowActionRecord = {
  id: string
  replyId: string | null
  leadId: string
  actionType: GrowthReplyWorkflowActionType
  actionStatus: string
  severity: string
  title: string
  summary: string
  createdAt: string
  companyName: string | null
  replyIntent: string | null
  replyNextAction: string | null
  replyBodyPreview: string | null
  replyReceivedAt: string | null
  category: GrowthReplyWorkflowActionCategory
}

export type GrowthReplyWorkflowActionDashboard = {
  qaMarker: typeof GROWTH_REPLY_WORKFLOW_CENTER_QA_MARKER
  pendingReviewCount: number
  interestedCount: number
  callTaskCount: number
  followUpCount: number
  opportunityCount: number
  sequenceExitCount: number
}

export type GrowthSequenceExitCandidateRecord = {
  id: string
  threadId: string
  leadId: string
  companyName: string | null
  sequenceEnrollmentId: string | null
  sequenceName: string | null
  enrollmentStatus: string | null
  reason: string
  replySummary: string | null
  createdAt: string
  operatorResolution: string | null
}

export type GrowthReplyOpportunityDraft = {
  leadId: string
  replyId: string | null
  companyName: string
  title: string
  stageKey: string
  amount: number
  forecastCategory: string
  priority: string
  source: string
  summary: string
  recommendedOperatorAction: string | null
  intent: string | null
  existingOpportunityId?: string
}

export function categorizeReplyWorkflowAction(actionType: string): GrowthReplyWorkflowActionCategory {
  if (actionType === "mark_interested") return "interested"
  if (actionType === "create_call_task") return "call_task"
  if (actionType === "create_follow_up_task") return "follow_up"
  if (actionType === "stop_sequence") return "sequence_exit"
  if (
    actionType === "route_demo_scheduling" ||
    actionType === "route_pricing_response" ||
    actionType === "route_meeting_request"
  ) {
    return "opportunity"
  }
  return "other"
}
