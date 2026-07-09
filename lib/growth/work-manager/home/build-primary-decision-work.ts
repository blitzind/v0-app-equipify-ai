/** GE-AIOS-11A — Home hero primary decision from Work Manager output. */

import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { capitalizeSentence } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"
import type { PrimaryDecisionResult } from "@/lib/growth/decision-engine/home/build-primary-decision"

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function buildPrimaryDecisionFromWorkManager(
  workResult: AvaWorkManagerResult,
  aiOsUx: GrowthHomeAiOsUxViewModel,
): PrimaryDecisionResult {
  const top = workResult.operator_queue[0] ?? null
  const totalWaiting = Math.max(
    aiOsUx.approveItemsCount,
    aiOsUx.waitingOnYou.length,
    workResult.operator_queue.length,
  )

  if (!top && totalWaiting === 0) {
    return { primaryDecision: null, additionalDecisionCount: 0, reviewAllHref: null }
  }

  const primaryDecision: PrimaryDecisionResult["primaryDecision"] = top
    ? {
        id: top.id,
        label: capitalizeSentence(top.title),
        detail: top.description,
        href: top.href ?? aiOsUx.approveItemsHref,
      }
    : {
        id: "approvals",
        label: `${totalWaiting} ${pluralize(totalWaiting, "decision", "decisions")} waiting for your review`,
        detail: null,
        href: aiOsUx.approveItemsHref,
      }

  return {
    primaryDecision,
    additionalDecisionCount: Math.max(0, workResult.operator_queue.length - 1),
    reviewAllHref: aiOsUx.approveItemsHref,
  }
}
