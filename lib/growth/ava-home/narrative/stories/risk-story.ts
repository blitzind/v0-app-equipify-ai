/** GE-AIOS-10A — Deterministic risk story builder. */

import type { AvaNarrativeFact, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildRiskStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  if (fact.label === "business_understanding_incomplete") {
    return {
      id: `risk:${fact.id}`,
      kind: "risk",
      priority: resolveStoryPriority("risk"),
      text: "I still don't fully understand your pricing structure. Researching your business would improve future recommendations.",
    }
  }

  if (fact.label === "mailbox_health") {
    return {
      id: `risk:${fact.id}`,
      kind: "risk",
      priority: resolveStoryPriority("risk"),
      text: fact.detail
        ? `Delivery health needs attention: ${fact.detail}`
        : "Mailbox health needs attention before I scale outreach.",
    }
  }

  return null
}
