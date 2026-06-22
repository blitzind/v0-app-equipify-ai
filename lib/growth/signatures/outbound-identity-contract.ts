/**
 * AI / campaign sender identity chain (GS-GROWTH-SIGNATURES-1A architecture prep).
 * GS-GROWTH-SENDER-AI-1D extends with runtime AI prompt identity context.
 */

import type { GrowthSignatureTemplateId } from "@/lib/growth/signatures/signature-types"

export {
  GROWTH_OUTBOUND_IDENTITY_AI_QA_MARKER,
  type GrowthOutboundIdentityContext,
  type GrowthOutboundSenderPersonaKey,
  formatOutboundIdentityPreviewLabel,
} from "@/lib/growth/signatures/outbound-identity-types"

export const GROWTH_OUTBOUND_IDENTITY_CHAIN_QA_MARKER = "growth-outbound-identity-chain-1a-v1" as const

/** Future: campaign → persona → mailbox → signature */
export type GrowthOutboundIdentityChain = {
  campaignId?: string | null
  sequenceId?: string | null
  senderProfileId: string
  senderAccountId: string
  mailboxConnectionId: string | null
  signatureTemplate: GrowthSignatureTemplateId
  personaDisplayName: string
  personaTitle: string | null
}

export type GrowthOutboundIdentityResolutionRequest = {
  senderAccountId?: string | null
  senderProfileId?: string | null
  campaignId?: string | null
  sequenceId?: string | null
}
