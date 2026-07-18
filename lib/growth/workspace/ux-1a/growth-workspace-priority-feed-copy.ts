/** GE-AIOS-UX-1A Phase 2 — operator-facing copy helpers (client-safe). */

import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  extractGrowthInboxOperatorFirstName,
  formatGrowthInboxBriefingHeadline,
} from "@/lib/growth/hubs/growth-inbox-hub-briefing-utils"

export const GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_TITLE = "You're caught up." as const

export const GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_MESSAGE =
  "There is nothing waiting for your attention right now." as const

/** Labels that must not appear in UX-1A workspace operator copy. */
export const GROWTH_WORKSPACE_PRIORITY_FEED_FORBIDDEN_TERMS = [
  "AI OS",
  "enrollment",
  "transport",
  "scheduler",
  "canonical decision",
  "execution job",
  "Apollo",
  "Sequence Execution",
  "Human Approval Center",
] as const

export function buildUx1aWorkspaceHeroGreeting(operatorDisplayName?: string | null): string {
  const firstName = extractGrowthInboxOperatorFirstName(operatorDisplayName ?? null)
  return formatGrowthInboxBriefingHeadline(firstName)
}

export function buildUx1aWorkspaceHeroSubline(input: {
  readyCount: number
  teammate: AiTeammatePresentation
  teammateIdentityAvailable: boolean
}): { subline: string; teammateNamedInSubline: boolean } {
  const count = Math.max(0, input.readyCount)
  const itemPhrase = count === 1 ? "1 item" : `${count} items`

  if (input.teammateIdentityAvailable && input.teammate.name.trim()) {
    return {
      subline: `${input.teammate.name} has ${itemPhrase} ready for you.`,
      teammateNamedInSubline: true,
    }
  }

  return {
    subline: `You have ${itemPhrase} ready for review.`,
    teammateNamedInSubline: false,
  }
}

export function containsUx1aForbiddenOperatorTerm(text: string): boolean {
  const haystack = text.toLowerCase()
  return GROWTH_WORKSPACE_PRIORITY_FEED_FORBIDDEN_TERMS.some((term) =>
    haystack.includes(term.toLowerCase()),
  )
}
