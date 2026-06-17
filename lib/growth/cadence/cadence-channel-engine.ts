/** Client-safe cadence channel routing helpers. */

import {
  GROWTH_CADENCE_EMAIL_CHANNEL,
  GROWTH_CADENCE_TASK_CHANNELS,
  type GrowthCadenceTaskChannel,
} from "@/lib/growth/cadence/cadence-types"
import {
  GROWTH_SEQUENCE_TRANSPORT_CHANNELS,
  type GrowthSequenceTransportChannel,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  GROWTH_SEQUENCE_STEP_CHANNELS,
  type GrowthSequenceStepChannel,
} from "@/lib/growth/sequence-types"
import { growthWorkspaceLeadQueueHref } from "@/lib/growth/navigation/growth-call-notification-links"

export function isCadenceEmailChannel(channel: GrowthSequenceStepChannel): boolean {
  return channel === GROWTH_CADENCE_EMAIL_CHANNEL
}

export function isSequenceTransportChannel(
  channel: GrowthSequenceStepChannel,
): channel is GrowthSequenceTransportChannel {
  return (GROWTH_SEQUENCE_TRANSPORT_CHANNELS as readonly string[]).includes(channel)
}

export function isCadenceTaskChannel(channel: GrowthSequenceStepChannel): channel is GrowthCadenceTaskChannel {
  return (GROWTH_CADENCE_TASK_CHANNELS as readonly string[]).includes(channel)
}

export function assertCadenceChannelsMatchSequenceChannels(): void {
  for (const channel of GROWTH_CADENCE_TASK_CHANNELS) {
    if (!(GROWTH_SEQUENCE_STEP_CHANNELS as readonly string[]).includes(channel)) {
      throw new Error(`Cadence channel missing from sequence channels: ${channel}`)
    }
  }
}

export function buildCadenceTaskTitle(input: {
  channel: GrowthCadenceTaskChannel
  companyName: string
  stepOrder: number
}): string {
  switch (input.channel) {
    case "manual_call":
      return `Call ${input.companyName} (step ${input.stepOrder})`
    case "voicemail":
      return `Leave voicemail for ${input.companyName}`
    case "linkedin_view_profile":
      return `View LinkedIn profile — ${input.companyName}`
    case "linkedin_connect":
      return `Send LinkedIn connection — ${input.companyName}`
    case "linkedin_message":
      return `LinkedIn message — ${input.companyName}`
    case "sms_task":
      return `SMS follow-up — ${input.companyName}`
    case "meeting_followup":
      return `Meeting follow-up — ${input.companyName}`
    case "manual_follow_up":
      return `Manual follow-up — ${input.companyName}`
    default:
      return `Cadence task — ${input.companyName}`
  }
}

export function buildCadenceTaskInstructions(input: {
  channel: GrowthCadenceTaskChannel
  companyName: string
  contactName?: string | null
}): string {
  const contact = input.contactName?.trim() || "the primary contact"
  switch (input.channel) {
    case "manual_call":
      return `Place a manual call to ${contact} at ${input.companyName}. Log outcome when finished. No auto-dial.`
    case "voicemail":
      return `Leave a concise voicemail for ${contact}. Mark left_voicemail or no_answer when done.`
    case "linkedin_view_profile":
      return `Review ${contact}'s LinkedIn profile manually. No automation or scraping — mark complete when done.`
    case "linkedin_connect":
      return `Send a LinkedIn connection request to ${contact} manually. No LinkedIn API or automation.`
    case "linkedin_message":
      return `Send a LinkedIn message to ${contact} manually using the draft below if helpful.`
    case "sms_task":
      return `Copy the suggested SMS text and send from your phone manually. Equipify does not send SMS.`
    case "meeting_followup":
      return `Follow up after the scheduled meeting with ${input.companyName}. Confirm next steps — no auto CRM writes.`
    case "manual_follow_up":
      return `Complete the manual follow-up touch for ${input.companyName}.`
    default:
      return `Complete the cadence task for ${input.companyName}. Human action required.`
  }
}

export function buildCadenceSuggestedSmsText(input: {
  companyName: string
  contactName?: string | null
}): string {
  const name = input.contactName?.trim() || "there"
  return `Hi ${name}, following up from ${input.companyName}'s conversation with Equipify. Do you have 10 minutes this week?`
}

export function buildCadenceLinkedInDraft(input: {
  companyName: string
  contactName?: string | null
}): string {
  const name = input.contactName?.trim() || "there"
  return `Hi ${name} — wanted to connect regarding how teams like ${input.companyName} streamline field operations. Open to a quick chat?`
}

export function cadenceCallQueueHref(leadId: string): string {
  return growthWorkspaceLeadQueueHref(leadId)
}

export function cadenceLeadDrawerHref(leadId: string, focus?: string): string {
  const params = new URLSearchParams({ open: leadId })
  if (focus) params.set("focus", focus)
  return `/admin/growth/leads?${params.toString()}`
}
