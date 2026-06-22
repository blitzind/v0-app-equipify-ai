/**
 * AI / campaign sender identity chain (GS-GROWTH-SIGNATURES-1A architecture prep).
 * No runtime behavior — documents how campaigns will resolve sender persona later.
 */

import type { GrowthSignatureTemplateId } from "@/lib/growth/signatures/signature-types"

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
