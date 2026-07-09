/** GE-AIOS-10A — Deterministic accomplishment / win story builder. */

import { capitalizeSentence, pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaNarrativeContext, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildAccomplishmentStories(context: AvaNarrativeContext): AvaStoryBlock[] {
  const wins: AvaStoryBlock[] = []
  const { metrics } = context

  if (metrics.researched > 0) {
    wins.push({
      id: "win:researched",
      kind: "accomplishment",
      priority: resolveStoryPriority("accomplishment"),
      text: capitalizeSentence(
        `researched ${metrics.researched} ${pluralize(metrics.researched, "company", "companies")}`,
      ),
    })
  }
  if (metrics.qualified > 0) {
    wins.push({
      id: "win:qualified",
      kind: "accomplishment",
      priority: resolveStoryPriority("accomplishment"),
      text: capitalizeSentence(`qualified ${metrics.qualified} companies`),
    })
  }
  if (metrics.readyForReview > 0) {
    wins.push({
      id: "win:prepared",
      kind: "accomplishment",
      priority: resolveStoryPriority("accomplishment"),
      text: capitalizeSentence(
        `prepared ${metrics.readyForReview} ${pluralize(metrics.readyForReview, "opportunity", "opportunities")}`,
      ),
    })
  }

  for (const fact of context.accomplishments.slice(0, 4)) {
    const trimmed = fact.label.trim()
    if (!trimmed) continue
    if (wins.some((row) => row.text.toLowerCase() === trimmed.toLowerCase())) continue
    wins.push({
      id: `win:${fact.id}`,
      kind: "accomplishment",
      priority: resolveStoryPriority("accomplishment"),
      text: capitalizeSentence(trimmed.replace(/^I /, "")),
    })
  }

  return wins.slice(0, 6)
}

export function buildTodayPriorities(context: AvaNarrativeContext): string[] {
  const priorities: string[] = []

  for (const opportunity of context.opportunities.slice(0, 3)) {
    const company = opportunity.companyName?.trim()
    const action = opportunity.label.trim()
    if (!company) continue
    if (/qualif/i.test(action)) {
      priorities.push(`Finish qualifying ${company}`)
    } else if (/outreach|prepare|draft/i.test(action)) {
      priorities.push(`Prepare outreach for ${company}`)
    } else if (/research/i.test(action)) {
      priorities.push(`Continue researching ${company}`)
    } else {
      priorities.push(`${action} for ${company}`)
    }
  }

  if (priorities.length === 0 && context.metrics.researched > 0) {
    const industry = context.discoveries.find((row) => row.industry)?.industry
    priorities.push(
      industry
        ? `Continue researching ${industry} companies`
        : "Continue researching companies that match your business",
    )
  }

  return priorities.slice(0, 4)
}

export function buildTodayFocus(context: AvaNarrativeContext): string[] {
  return buildTodayPriorities(context)
}
