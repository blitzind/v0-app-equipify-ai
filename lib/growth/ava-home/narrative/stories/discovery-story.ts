/** GE-AIOS-10A — Deterministic discovery story builder. */

import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaNarrativeFact, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildDiscoveryStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  if (fact.label === "growth_signals_detected") {
    const count = fact.count ?? 0
    if (count <= 0) return null
    const industry = fact.industry ? ` among ${fact.industry} companies` : ""
    return {
      id: `discovery:${fact.id}`,
      kind: "discovery",
      priority: resolveStoryPriority("discovery"),
      text: `Growth signals stood out at ${count} ${pluralize(count, "company", "companies")}${industry}.`,
    }
  }

  if (fact.label === "qualified_companies") {
    const count = fact.count ?? 0
    if (count <= 0) return null
    const industry = fact.industry ?? "your target market"
    return {
      id: `discovery:${fact.id}`,
      kind: "discovery",
      priority: resolveStoryPriority("discovery"),
      text: `${count} ${pluralize(count, "company stood", "companies stood")} out in ${industry} because they're expanding while still relying on disconnected service software.`,
    }
  }

  const researched = fact.count ?? 0
  if (researched <= 0) return null
  const industry = fact.industry ?? "companies that match your business"
  return {
    id: `discovery:${fact.id}`,
    kind: "discovery",
    priority: resolveStoryPriority("discovery"),
    text: `Today I focused on ${industry}.`,
  }
}
