/** GE-AIOS-10A — Deterministic opportunity story builder. */

import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaNarrativeFact, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildOpportunityStory(fact: AvaNarrativeFact): AvaStoryBlock | null {
  if (fact.label === "ready_for_outreach") {
    const count = fact.count ?? 0
    if (count <= 0) return null
    if (fact.companyName) {
      return {
        id: `opportunity:${fact.id}`,
        kind: "opportunity",
        priority: resolveStoryPriority("opportunity"),
        text: `I prepared outreach for ${fact.companyName} because their recent expansion makes them a strong fit for Equipify.`,
        href: fact.href ?? null,
      }
    }
    return {
      id: `opportunity:${fact.id}`,
      kind: "opportunity",
      priority: resolveStoryPriority("opportunity"),
      text: `I've already prepared outreach for ${count} ${pluralize(count, "company", "companies")}.`,
      href: fact.href ?? null,
    }
  }

  const company = fact.companyName?.trim()
  if (!company) return null

  const reason = fact.detail?.trim()
  const reasonClause = reason
    ? ` because ${reason.charAt(0).toLowerCase()}${reason.slice(1).replace(/\.$/, "")}`
    : " because they're a strong fit for your business"

  return {
    id: `opportunity:${fact.id}`,
    kind: "opportunity",
    priority: resolveStoryPriority("opportunity"),
    text: `I prepared outreach for ${company}${reasonClause}.`,
    href: fact.href ?? null,
  }
}
