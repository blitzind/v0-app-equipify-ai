/**
 * GE-AIOS-CHANNELS-1A — Canonical channel parity helpers (client-safe).
 * Reuses Send Plane 1A constitution and materialization — no parallel engines.
 */

import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  CANONICAL_CHANNELS_1A,
  CUSTOMER_FACING_CHANNEL_LABELS,
  FORBIDDEN_FOLLOW_UP_PHRASES,
  GROWTH_AIOS_CHANNELS_1A_QA_MARKER,
  type CanonicalChannels1AChannel,
} from "@/lib/growth/aios/growth/growth-channels-1a-types"
import {
  finalizeProductionCustomerFacingCopy,
  reviewProductionHumanCommunicationConstitution,
  stripAiGeneratedSignatureContent,
  type GrowthCanonicalDisplayIdentity,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-constitution"
import {
  materializeCanonicalOutreachChannelContent,
  type CanonicalOutreachMaterializedContent,
  type CanonicalOutreachTransportChannel,
} from "@/lib/growth/aios/growth/growth-send-plane-1a-materialization"

export {
  CANONICAL_CHANNELS_1A,
  CUSTOMER_FACING_CHANNEL_LABELS,
  FORBIDDEN_FOLLOW_UP_PHRASES,
  GROWTH_AIOS_CHANNELS_1A_QA_MARKER,
}
export type { CanonicalChannels1AChannel }

export function resolveCustomerFacingChannelLabel(
  channel: CanonicalChannels1AChannel | CanonicalOutreachTransportChannel,
): string {
  return CUSTOMER_FACING_CHANNEL_LABELS[channel as CanonicalChannels1AChannel] ?? channel
}

export function applyChannelParityConstitution(
  body: string,
  companyName: string,
  canonicalIdentity?: GrowthCanonicalDisplayIdentity | null,
): { body: string; constitutionFailures: string[] } {
  const stripped = stripAiGeneratedSignatureContent(body)
  const normalized = finalizeProductionCustomerFacingCopy(stripped, canonicalIdentity)
  const constitutionFailures = reviewProductionHumanCommunicationConstitution(
    normalized,
    companyName,
    canonicalIdentity,
  )
  return { body: normalized, constitutionFailures }
}

export function validateFollowUpSequenceCopy(text: string): string[] {
  const failures: string[] = []
  const lower = text.toLowerCase()
  for (const phrase of FORBIDDEN_FOLLOW_UP_PHRASES) {
    if (lower.includes(phrase)) failures.push(`forbidden_follow_up_phrase:${phrase}`)
  }
  if (text.includes("—")) failures.push("forbidden_em_dash")
  return failures
}

export function assertChannelParityCopy(input: {
  body: string
  companyName: string
  channel: CanonicalOutreachTransportChannel
}): {
  constitutionFailures: string[]
  followUpFailures: string[]
  hasSendrReference: boolean
  transportReady: boolean
} {
  const { body, constitutionFailures } = applyChannelParityConstitution(input.body, input.companyName)
  const followUpFailures =
    input.channel === "follow_up" ? validateFollowUpSequenceCopy(body) : []
  const hasSendrReference = /\bsendr\b/i.test(body)
  const transportReady =
    constitutionFailures.length === 0 &&
    followUpFailures.length === 0 &&
    !hasSendrReference &&
    body.length > 0

  return { constitutionFailures, followUpFailures, hasSendrReference, transportReady }
}

export function materializeAllCanonicalChannelContents(input: {
  brief: GrowthOutreachSalesStrategyBrief
  package?: GrowthAutonomousOutreachApprovalPackage | null
  senderName?: string | null
}): Record<CanonicalOutreachTransportChannel, CanonicalOutreachMaterializedContent> {
  const channels: CanonicalOutreachTransportChannel[] = [
    "email",
    "linkedin",
    "sms",
    "call",
    "voicemail",
    "sendr",
    "follow_up",
    "meeting_request",
  ]
  const out = {} as Record<CanonicalOutreachTransportChannel, CanonicalOutreachMaterializedContent>
  for (const channel of channels) {
    out[channel] = materializeCanonicalOutreachChannelContent({
      brief: input.brief,
      channel,
      package: input.package,
      senderName: input.senderName,
    })
  }
  return out
}
