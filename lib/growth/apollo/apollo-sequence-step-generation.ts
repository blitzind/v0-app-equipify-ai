/** Apollo Sequence Execution step generation — client-safe. */

import type { ApolloOrchestrationChannelId } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import type {
  ApolloSequenceExecutionDraftApprovalStatus,
  ApolloSequenceExecutionMultichannelHandoffInput,
  ApolloSequenceExecutionStepPlan,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import type { GrowthSequenceStepChannel } from "@/lib/growth/sequence-types"

export const APOLLO_SEQUENCE_STEP_GENERATION_QA_MARKER =
  "apollo-sequence-step-generation-v1" as const

export function mapOrchestrationChannelToSequenceChannel(
  channel: ApolloOrchestrationChannelId,
): GrowthSequenceStepChannel | null {
  switch (channel) {
    case "email":
      return "email"
    case "sms":
      return "sms"
    case "voice_drop":
      return "voice_drop"
    case "calling":
      return "call"
    default:
      return null
  }
}

function generationTypeForChannel(channel: GrowthSequenceStepChannel): string | null {
  if (channel === "email") return "follow_up_email"
  return null
}

export function buildApolloSequenceExecutionStepPlans(
  input: ApolloSequenceExecutionMultichannelHandoffInput,
): ApolloSequenceExecutionStepPlan[] {
  const steps: ApolloSequenceExecutionStepPlan[] = []
  const approvalStatus: ApolloSequenceExecutionDraftApprovalStatus = "pending_draft_approval"

  for (let index = 0; index < input.scheduling_plan.touches.length; index += 1) {
    const touch = input.scheduling_plan.touches[index]!
    const channel = mapOrchestrationChannelToSequenceChannel(touch.channel)
    if (!channel) continue

    steps.push({
      step_number: steps.length + 1,
      channel,
      orchestration_channel: touch.channel,
      scheduled_offset_days: touch.day_offset,
      scheduled_for_label: `Day ${touch.day_offset}`,
      generation_type: generationTypeForChannel(channel),
      approval_status: approvalStatus,
      pattern_step_key: `${channel}_${steps.length + 1}`,
    })
  }

  return steps
}

export function summarizeApolloSequenceExecutionSteps(
  steps: ApolloSequenceExecutionStepPlan[],
): string {
  return steps
    .map((step) => `Step ${step.step_number}: ${step.scheduled_for_label} ${step.channel}`)
    .join(" · ")
}
