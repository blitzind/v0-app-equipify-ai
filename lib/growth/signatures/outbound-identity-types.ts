/** GS-GROWTH-SENDER-AI-1D — Outbound sender identity for AI generation (client-safe). */

export const GROWTH_OUTBOUND_IDENTITY_AI_QA_MARKER = "growth-outbound-identity-ai-1d-v1" as const

export const GROWTH_OUTBOUND_SENDER_PERSONA_KEYS = [
  "founder",
  "solutions_advisor",
  "customer_success_manager",
  "solutions_consultant",
  "general",
] as const

export type GrowthOutboundSenderPersonaKey = (typeof GROWTH_OUTBOUND_SENDER_PERSONA_KEYS)[number]

/** Identity context injected into AI prompt builders before generation. */
export type GrowthOutboundIdentityContext = {
  senderAccountId: string | null
  senderProfileId: string | null
  displayName: string
  title: string | null
  company: string
  website: string | null
  email: string | null
  personaKey: GrowthOutboundSenderPersonaKey
  personaInstructions: string
}

export function formatOutboundIdentityPreviewLabel(
  identity: Pick<GrowthOutboundIdentityContext, "displayName" | "title"> | null | undefined,
): string | null {
  if (!identity?.displayName?.trim()) return null
  const name = identity.displayName.trim()
  const title = identity.title?.trim()
  return title ? `As: ${name} — ${title}` : `As: ${name}`
}
