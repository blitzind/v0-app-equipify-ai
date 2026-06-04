/** Channel routing for multi-channel sequences (Phase 5.4B). Client-safe. */

import {
  GROWTH_CADENCE_TASK_CHANNELS,
  type GrowthCadenceTaskChannel,
} from "@/lib/growth/cadence/cadence-types"
import {
  GROWTH_SEQUENCE_STEP_CHANNELS,
  type GrowthSequenceStepChannel,
} from "@/lib/growth/sequence-types"

export const GROWTH_SEQUENCE_TRANSPORT_CHANNELS = ["email", "sms"] as const
export type GrowthSequenceTransportChannel = (typeof GROWTH_SEQUENCE_TRANSPORT_CHANNELS)[number]

/** Normalize call alias to manual_call for cadence routing. */
export function normalizeSequenceStepChannel(channel: GrowthSequenceStepChannel): GrowthSequenceStepChannel {
  if (channel === "call") return "manual_call"
  return channel
}

export function isSequenceTransportChannel(
  channel: GrowthSequenceStepChannel,
): channel is GrowthSequenceTransportChannel {
  return (GROWTH_SEQUENCE_TRANSPORT_CHANNELS as readonly string[]).includes(channel)
}

export function isSequenceCadenceChannel(channel: GrowthSequenceStepChannel): channel is GrowthCadenceTaskChannel {
  const normalized = normalizeSequenceStepChannel(channel)
  return (GROWTH_CADENCE_TASK_CHANNELS as readonly string[]).includes(normalized)
}

export function sequenceChannelLabel(channel: GrowthSequenceStepChannel): string {
  switch (channel) {
    case "email":
      return "Email"
    case "sms":
      return "SMS"
    case "call":
    case "manual_call":
      return "Call"
    case "sms_task":
      return "SMS Task (manual)"
    default:
      return channel.replace(/_/g, " ")
  }
}

export function assertMultiChannelSequenceChannelsRegistered(): void {
  for (const channel of [...GROWTH_SEQUENCE_TRANSPORT_CHANNELS, "call", "manual_call"]) {
    if (!(GROWTH_SEQUENCE_STEP_CHANNELS as readonly string[]).includes(channel)) {
      throw new Error(`Sequence channel not registered: ${channel}`)
    }
  }
}
