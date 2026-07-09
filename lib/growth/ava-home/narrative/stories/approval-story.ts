/** GE-AIOS-10A — Deterministic approval story builder. */

import { pluralize } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaNarrativeFact, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildApprovalStory(facts: AvaNarrativeFact[]): AvaStoryBlock | null {
  if (facts.length === 0) return null

  const outreachDrafts = facts.filter((fact) => /outreach|draft/i.test(fact.label))
  const count = outreachDrafts.length > 0 ? outreachDrafts.length : facts.length

  if (outreachDrafts.length > 0 || /outreach|draft/i.test(facts[0]?.label ?? "")) {
    return {
      id: "approval:outreach-drafts",
      kind: "approval",
      priority: resolveStoryPriority("approval"),
      text: `Before I continue, I need your approval on ${count} outreach ${pluralize(count, "draft", "drafts")}.`,
      href: facts[0]?.href ?? null,
    }
  }

  const top = facts[0]
  if (top.label === "pending_approvals") {
    const pending = top.count ?? facts.length
    return {
      id: "approval:pending",
      kind: "approval",
      priority: resolveStoryPriority("approval"),
      text: `Before I continue, I need your approval on ${pending} ${pluralize(pending, "item", "items")}.`,
      href: top.href ?? null,
    }
  }

  return {
    id: `approval:${top.id}`,
    kind: "approval",
    priority: resolveStoryPriority("approval"),
    text: `Before I continue, I need your approval: ${top.label.replace(/^approve /i, "")}.`,
    href: top.href ?? null,
  }
}
