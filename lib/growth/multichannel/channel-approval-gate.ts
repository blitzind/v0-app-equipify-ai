import type { GrowthSequenceChannelTask } from "@/lib/growth/multichannel/multichannel-types"
import { isFuturePlaceholderChannel } from "@/lib/growth/multichannel/multichannel-types"

export type ChannelApprovalGateResult = {
  allowed: boolean
  code?: string
  message?: string
}

export function evaluateChannelTaskApprovalGate(input: {
  task: Pick<GrowthSequenceChannelTask, "status" | "channel" | "requiresHumanApproval">
  humanApprovalConfirmed?: boolean
}): ChannelApprovalGateResult {
  if (isFuturePlaceholderChannel(input.task.channel)) {
    return {
      allowed: false,
      code: "future_channel_blocked",
      message: "Future channel placeholder — blocked until compliance/provider phase.",
    }
  }
  if (input.task.status !== "pending" && input.task.status !== "blocked") {
    return { allowed: false, code: "invalid_status", message: "Task is not pending approval." }
  }
  if (input.task.requiresHumanApproval && input.humanApprovalConfirmed !== true) {
    return {
      allowed: false,
      code: "human_approval_confirmed_required",
      message: "Human approval confirmation required.",
    }
  }
  return { allowed: true }
}

export function evaluateChannelTaskCompleteGate(input: {
  task: Pick<GrowthSequenceChannelTask, "status" | "channel">
  humanApprovalConfirmed?: boolean
}): ChannelApprovalGateResult {
  if (isFuturePlaceholderChannel(input.task.channel)) {
    return { allowed: false, code: "future_channel_blocked", message: "Future channel cannot be completed." }
  }
  if (input.task.status !== "approved" && input.task.status !== "in_progress") {
    return { allowed: false, code: "invalid_status", message: "Task must be approved before completion." }
  }
  if (input.humanApprovalConfirmed !== true) {
    return {
      allowed: false,
      code: "human_approval_confirmed_required",
      message: "Human confirmation required to record completion.",
    }
  }
  return { allowed: true }
}

export function evaluateChannelTaskSkipGate(input: {
  task: Pick<GrowthSequenceChannelTask, "status">
}): ChannelApprovalGateResult {
  if (["completed", "skipped", "failed"].includes(input.task.status)) {
    return { allowed: false, code: "invalid_status", message: "Task already resolved." }
  }
  return { allowed: true }
}

export function assertNoAutonomousExternalAction(channel: GrowthSequenceChannelTask["channel"]): void {
  if (channel === "manual_call" || channel === "linkedin_manual" || channel === "sms_future" || channel === "voicemail_future") {
    return
  }
}
