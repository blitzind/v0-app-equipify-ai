/** GE-AIOS-10B — Home hero primary decision from decision engine output. */

import type { NextBestAction } from "@/lib/growth/decision-engine/types"
import type { GrowthHomeAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { capitalizeSentence } from "@/lib/growth/ava-home/narrative/copy/narrative-copy"

export type PrimaryDecisionResult = {
  primaryDecision: {
    id: string
    label: string
    detail: string | null
    href: string | null
  } | null
  additionalDecisionCount: number
  reviewAllHref: string | null
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function formatPrimaryDecisionLabel(label: string): string {
  const trimmed = label.trim()
  if (/^approve /i.test(trimmed)) return capitalizeSentence(trimmed)
  if (/waiting|blocked/i.test(trimmed)) return capitalizeSentence(trimmed)
  return capitalizeSentence(trimmed)
}

export function buildPrimaryDecisionFromDecisionEngine(
  decisionResult: { top_action: NextBestAction | null; next_best_actions: NextBestAction[] },
  aiOsUx: GrowthHomeAiOsUxViewModel,
): PrimaryDecisionResult {
  const operatorActions = decisionResult.next_best_actions.filter(
    (action) => action.requires_operator && action.kind !== "wait",
  )
  const totalWaiting = Math.max(
    aiOsUx.approveItemsCount,
    aiOsUx.waitingOnYou.length,
    operatorActions.length,
  )

  const top = decisionResult.top_action

  if (!top && totalWaiting === 0) {
    return { primaryDecision: null, additionalDecisionCount: 0, reviewAllHref: null }
  }

  const primaryDecision: PrimaryDecisionResult["primaryDecision"] = top
    ? {
        id: top.id,
        label: formatPrimaryDecisionLabel(top.title),
        detail: top.reason.map((row) => row.label).join(" · ") || null,
        href: top.href ?? aiOsUx.approveItemsHref,
      }
    : {
        id: "approvals",
        label: `${totalWaiting} ${pluralize(totalWaiting, "decision", "decisions")} waiting for your review`,
        detail: null,
        href: aiOsUx.approveItemsHref,
      }

  const additionalDecisionCount = Math.max(0, operatorActions.length - 1)

  return { primaryDecision, additionalDecisionCount, reviewAllHref: aiOsUx.approveItemsHref }
}

/** @deprecated GE-AIOS-10B — queue-order fallback only */
export function buildAvaPrimaryDecisionLegacy(aiOsUx: GrowthHomeAiOsUxViewModel): PrimaryDecisionResult {
  const top = aiOsUx.waitingOnYou[0] ?? null
  const totalWaiting = Math.max(aiOsUx.approveItemsCount, aiOsUx.waitingOnYou.length)

  if (!top && totalWaiting === 0) {
    return { primaryDecision: null, additionalDecisionCount: 0, reviewAllHref: null }
  }

  return {
    primaryDecision: top
      ? {
          id: top.id,
          label: formatPrimaryDecisionLabel(top.label),
          detail: top.detail ?? null,
          href: top.href ?? aiOsUx.approveItemsHref,
        }
      : {
          id: "approvals",
          label: `${totalWaiting} ${pluralize(totalWaiting, "decision", "decisions")} waiting for your review`,
          detail: null,
          href: aiOsUx.approveItemsHref,
        },
    additionalDecisionCount: Math.max(0, totalWaiting - 1),
    reviewAllHref: aiOsUx.approveItemsHref,
  }
}
