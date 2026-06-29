/**
 * GE-AIOS-SDR-1A — Communication strategy display adapter (client-safe).
 */

import type {
  CommunicationStrategy,
  CommunicationStrategyDisplaySummary,
} from "@/lib/growth/contact-verification/communication-strategy-types"
import { GROWTH_COMMUNICATION_STRATEGY_QA_MARKER } from "@/lib/growth/contact-verification/communication-strategy-types"

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone call",
  sms: "SMS",
  voice_drop: "Voice drop",
  linkedin: "LinkedIn",
  video: "Personalized video",
  wait: "Wait",
  stop: "Stop",
  human: "Human review",
}

const ACTION_LABELS: Record<string, string> = {
  send_email: "Send email",
  place_call: "Place call",
  launch_voice_drop: "Launch voice drop",
  send_sms: "Send SMS",
  create_linkedin_task: "LinkedIn task",
  send_video: "Send video",
  schedule_meeting: "Schedule meeting",
  wait: "Wait",
  stop: "Stop outreach",
  request_human_review: "Human review",
}

export function formatCommunicationStrategyChannelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel.replace(/_/g, " ")
}

export function formatCommunicationStrategyActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ")
}

export function adaptCommunicationStrategyToDisplaySummary(
  strategy: CommunicationStrategy,
): CommunicationStrategyDisplaySummary {
  const nextStep = strategy.escalationPlan[0]
  const escalationSummary =
    strategy.escalationPlan.length > 0
      ? strategy.escalationPlan
          .slice(0, 4)
          .map((step) => `${formatCommunicationStrategyChannelLabel(step.channel)} (${step.trigger})`)
          .join(" → ")
      : "No escalation plan"

  return {
    qa_marker: GROWTH_COMMUNICATION_STRATEGY_QA_MARKER,
    primary_channel: strategy.primaryChannel,
    primary_channel_label: formatCommunicationStrategyChannelLabel(strategy.primaryChannel),
    recommended_action: strategy.recommendedAction,
    recommended_action_label: formatCommunicationStrategyActionLabel(strategy.recommendedAction),
    fallback_channels: strategy.fallbackChannels.map(formatCommunicationStrategyChannelLabel),
    confidence: strategy.confidence,
    reasoning: strategy.reasoning.slice(0, 5),
    escalation_summary: escalationSummary,
    requires_human_approval: strategy.requiresHumanApproval,
    source: "communication_strategy_engine",
  }
}

export function buildCommunicationStrategyOperatorHeadline(
  strategy: CommunicationStrategy,
): string {
  const primary = formatCommunicationStrategyChannelLabel(strategy.primaryChannel)
  const action = formatCommunicationStrategyActionLabel(strategy.recommendedAction)
  if (strategy.primaryChannel === "stop") return "Stop outreach — account not eligible"
  if (strategy.primaryChannel === "wait") return "Wait before next outreach touch"
  if (strategy.primaryChannel === "human") return action
  return `Recommend ${primary}: ${action}`
}
