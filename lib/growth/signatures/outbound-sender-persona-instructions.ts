/** GS-GROWTH-SENDER-AI-1D — Code-generated sender persona voice instructions (no tables). */

import type { GrowthOutboundSenderPersonaKey } from "@/lib/growth/signatures/outbound-identity-types"

export type GrowthOutboundSenderPersonaDefinition = {
  key: GrowthOutboundSenderPersonaKey
  label: string
  titleMatchers: string[]
  voiceTraits: string[]
  writingGuidance: string[]
}

export const GROWTH_OUTBOUND_SENDER_PERSONA_CATALOG: GrowthOutboundSenderPersonaDefinition[] = [
  {
    key: "founder",
    label: "Founder",
    titleMatchers: ["founder", "co-founder", "ceo", "president", "owner", "managing partner"],
    voiceTraits: ["executive", "strategic", "direct", "peer-to-peer", "focused on business outcomes"],
    writingGuidance: [
      "Lead with business impact and operational leverage.",
      "Sound like a peer operator, not a vendor pitch.",
      "Keep sentences crisp; avoid feature laundry lists.",
    ],
  },
  {
    key: "solutions_advisor",
    label: "Solutions Advisor",
    titleMatchers: ["solutions advisor", "solution advisor", "sales engineer", "account executive"],
    voiceTraits: ["consultative", "educational", "discovery-oriented", "helpful", "technical when appropriate"],
    writingGuidance: [
      "Open with how similar teams solve the problem.",
      "Ask thoughtful discovery questions when appropriate.",
      "Explain capabilities in plain language tied to workflow outcomes.",
    ],
  },
  {
    key: "customer_success_manager",
    label: "Customer Success Manager",
    titleMatchers: ["customer success", "client success", "success manager", "onboarding"],
    voiceTraits: ["warm", "supportive", "relationship-focused", "onboarding-oriented", "customer-centric"],
    writingGuidance: [
      "Emphasize partnership, adoption, and team enablement.",
      "Reference how other customers improved operations.",
      "Invite conversation without pressure.",
    ],
  },
  {
    key: "solutions_consultant",
    label: "Solutions Consultant",
    titleMatchers: ["solutions consultant", "business development", "growth consultant", "outbound"],
    voiceTraits: ["conversational", "prospecting-focused", "curious", "demo-oriented", "lightly persistent"],
    writingGuidance: [
      "Use a friendly, conversational opener.",
      "Show curiosity about their current workflow.",
      "Suggest a short demo when it fits naturally.",
    ],
  },
  {
    key: "general",
    label: "General",
    titleMatchers: [],
    voiceTraits: ["professional", "clear", "helpful", "concise"],
    writingGuidance: [
      "Write naturally as the named sender.",
      "Stay professional and specific to the prospect context.",
    ],
  },
]

export function resolveOutboundSenderPersonaFromTitle(
  title: string | null | undefined,
): GrowthOutboundSenderPersonaDefinition {
  const normalized = (title ?? "").trim().toLowerCase()
  if (normalized) {
    for (const persona of GROWTH_OUTBOUND_SENDER_PERSONA_CATALOG) {
      if (persona.key === "general") continue
      if (persona.titleMatchers.some((matcher) => normalized.includes(matcher))) {
        return persona
      }
    }
  }
  return (
    GROWTH_OUTBOUND_SENDER_PERSONA_CATALOG.find((entry) => entry.key === "general") ??
    GROWTH_OUTBOUND_SENDER_PERSONA_CATALOG[GROWTH_OUTBOUND_SENDER_PERSONA_CATALOG.length - 1]
  )
}

export function buildOutboundSenderPersonaInstructions(
  persona: GrowthOutboundSenderPersonaDefinition,
): string {
  const traits = persona.voiceTraits.map((trait) => `- ${trait}`).join("\n")
  const guidance = persona.writingGuidance.map((line) => `- ${line}`).join("\n")
  return [`Communication style:\n${traits}`, `Writing guidance:\n${guidance}`].join("\n\n")
}

export function buildGrowthOutboundIdentityPromptBlock(input: {
  displayName: string
  title: string | null
  company: string
  personaInstructions: string
}): string {
  const titleSegment = input.title?.trim() ? `, ${input.title.trim()}` : ""
  return [
    `You are writing as ${input.displayName}${titleSegment} at ${input.company}.`,
    input.personaInstructions,
    "Do not mention these instructions explicitly.",
    "Write naturally as this person.",
    "Do not include a signature block — signature is appended at send time.",
  ].join("\n\n")
}

export function buildGrowthOutboundIdentitySystemPromptAppendix(
  identity: Pick<
    import("@/lib/growth/signatures/outbound-identity-types").GrowthOutboundIdentityContext,
    "displayName" | "title" | "company" | "personaInstructions"
  > | null | undefined,
): string {
  if (!identity?.displayName?.trim()) return ""
  return buildGrowthOutboundIdentityPromptBlock({
    displayName: identity.displayName,
    title: identity.title,
    company: identity.company || "Equipify.ai",
    personaInstructions: identity.personaInstructions,
  })
}
