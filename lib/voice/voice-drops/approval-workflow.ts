/** Voice drop approval workflow — Phase 4B. No auto-start from draft. */

import type {
  VoiceDropApprovalStatus,
  VoiceDropCampaignStatus,
} from "@/lib/voice/voice-drops/types"
import { VOICE_DROP_APPROVAL_REQUIRED } from "@/lib/voice/voice-drops/types"

export type ApprovalTransition =
  | "submit_for_approval"
  | "approve"
  | "reject"
  | "schedule"
  | "pause"
  | "cancel"
  | "start_running"

const VALID_TRANSITIONS: Record<
  ApprovalTransition,
  { fromApproval: VoiceDropApprovalStatus[]; fromStatus: VoiceDropCampaignStatus[] }
> = {
  submit_for_approval: {
    fromApproval: ["draft"],
    fromStatus: ["draft"],
  },
  approve: {
    fromApproval: ["pending_approval"],
    fromStatus: ["draft", "pending_approval"],
  },
  reject: {
    fromApproval: ["pending_approval"],
    fromStatus: ["draft", "pending_approval"],
  },
  schedule: {
    fromApproval: ["approved"],
    fromStatus: ["approved"],
  },
  pause: {
    fromApproval: ["approved"],
    fromStatus: ["running", "scheduled"],
  },
  cancel: {
    fromApproval: ["approved", "pending_approval", "draft"],
    fromStatus: ["draft", "pending_approval", "approved", "scheduled", "running", "paused"],
  },
  start_running: {
    fromApproval: ["approved"],
    fromStatus: ["scheduled", "approved"],
  },
}

export function canTransitionCampaign(
  transition: ApprovalTransition,
  approvalStatus: VoiceDropApprovalStatus,
  campaignStatus: VoiceDropCampaignStatus,
): boolean {
  if (!VOICE_DROP_APPROVAL_REQUIRED && transition === "start_running") return false
  const rule = VALID_TRANSITIONS[transition]
  return rule.fromApproval.includes(approvalStatus) && rule.fromStatus.includes(campaignStatus)
}

export function applyApprovalTransition(
  transition: ApprovalTransition,
): { approvalStatus: VoiceDropApprovalStatus; campaignStatus: VoiceDropCampaignStatus } | null {
  switch (transition) {
    case "submit_for_approval":
      return { approvalStatus: "pending_approval", campaignStatus: "pending_approval" }
    case "approve":
      return { approvalStatus: "approved", campaignStatus: "approved" }
    case "reject":
      return { approvalStatus: "rejected", campaignStatus: "draft" }
    case "schedule":
      return { approvalStatus: "approved", campaignStatus: "scheduled" }
    case "pause":
      return { approvalStatus: "approved", campaignStatus: "paused" }
    case "cancel":
      return { approvalStatus: "rejected", campaignStatus: "canceled" }
    case "start_running":
      return { approvalStatus: "approved", campaignStatus: "running" }
    default:
      return null
  }
}

export function approvalRequiredMessage(): string {
  return "Voice drop campaigns require operator approval before scheduling or delivery."
}
