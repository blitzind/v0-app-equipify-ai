/** GE-AIOS-10A — Deterministic approval story builder. */

import { formatOperatorApprovalStoryLine } from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import type { AvaNarrativeFact, AvaStoryBlock } from "@/lib/growth/ava-home/narrative/narrative-types"
import { resolveStoryPriority } from "@/lib/growth/ava-home/narrative/priorities/prioritize-ava-story"

export function buildApprovalStory(facts: AvaNarrativeFact[]): AvaStoryBlock | null {
  if (facts.length === 0) return null

  const outreachPackages = facts.filter((fact) => /outreach|draft|package|approval|review/i.test(fact.label))
  const packageCount =
    topPendingCount(facts) ?? (outreachPackages.length > 0 ? outreachPackages.length : facts.length)
  const packageLine = formatOperatorApprovalStoryLine(packageCount)
  if (packageLine) {
    return {
      id: "approval:packages",
      kind: "approval",
      priority: resolveStoryPriority("approval"),
      text: packageLine,
      href: facts[0]?.href ?? null,
    }
  }

  const top = facts[0]
  return {
    id: `approval:${top.id}`,
    kind: "approval",
    priority: resolveStoryPriority("approval"),
    text: `Ready for your review: ${top.label.replace(/^approve /i, "").replace(/outreach draft/i, "opportunity package")}.`,
    href: top.href ?? null,
  }
}

function topPendingCount(facts: AvaNarrativeFact[]): number | null {
  const pending = facts.find((fact) => fact.label === "pending_approvals")
  if (!pending) return null
  return pending.count ?? facts.length
}
