/** GE-AIOS-HOME-UX-CLOSURE-1A — Approved operator Home surface rules (client-safe). */

import type { GrowthHomeRuntimeTrustOperatorState } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"

export const GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER =
  "ge-aios-home-ux-closure-1a-operator-surface-v1" as const

export const GROWTH_HOME_OPERATOR_CLOSURE_WORK_DETAILS_TITLE = "Work details" as const
export const GROWTH_HOME_OPERATOR_CLOSURE_WORK_DETAILS_SUBTITLE =
  "Timeline, memory, and secondary progress — expand when you want more context." as const

export const GROWTH_HOME_OPERATOR_CLOSURE_WHAT_HAPPENS_NEXT_TITLE = "What happens next" as const

export const GROWTH_HOME_OPERATOR_CLOSURE_NO_ACTION_MESSAGE =
  "I don't need anything from you right now. I'll return when a package is ready for review." as const

export function resolvePrimaryOperatorCompanyName(input: {
  canonicalFocusCompanyName?: string | null
  activeWorkCompanyName?: string | null
}): string | null {
  const focus = input.canonicalFocusCompanyName?.trim()
  if (focus && focus !== "Account") return focus
  const active = input.activeWorkCompanyName?.trim()
  if (active && active !== "Account") return active
  return focus ?? active ?? null
}

export function buildOperatorWhatHappensNextLines(input: {
  operatorState: GrowthHomeRuntimeTrustOperatorState
  pendingApprovals: number
  nextMilestoneLabel: string | null
  nextSchedulerLabel: string | null
  autonomyEnabled: boolean
}): string[] {
  const lines: string[] = []

  if (input.pendingApprovals > 0) {
    lines.push(
      `Review ${input.pendingApprovals} outreach ${input.pendingApprovals === 1 ? "package" : "packages"} when you're ready.`,
    )
    return lines
  }

  if (input.operatorState === "working" && input.nextMilestoneLabel) {
    lines.push(`Continue ${input.nextMilestoneLabel.toLowerCase()} for the current company.`)
  } else if (input.operatorState === "working") {
    lines.push("Finish the current pipeline step, then move to the next company in my queue.")
  } else if (input.operatorState === "scheduled" && input.nextSchedulerLabel) {
    lines.push(`Pick up my work queue on the next scheduled cycle (${input.nextSchedulerLabel}).`)
  } else if (input.autonomyEnabled) {
    lines.push("Keep discovering and researching companies that match your Growth Profile.")
    if (input.nextSchedulerLabel) {
      lines.push(`Next background cycle ${input.nextSchedulerLabel}.`)
    }
  } else {
    lines.push("Activate autonomous mode so I can continue in the background.")
  }

  return lines.slice(0, 2)
}

export function buildOperatorCanCloseBrowserLine(input: {
  operatorState: GrowthHomeRuntimeTrustOperatorState
  pendingApprovals: number
  autonomyEnabled: boolean
  setupIncomplete: boolean
}): string | null {
  if (input.setupIncomplete) {
    return "Finish setup first — I can't run autonomously until Training and your mailbox are ready."
  }
  if (!input.autonomyEnabled) {
    return "Activate me first — then you can close the browser and I'll keep working in the background."
  }
  if (input.pendingApprovals > 0) {
    return "You can close the browser, but I need your approval before I prepare or send the next outreach step."
  }
  if (input.operatorState === "blocked") {
    return "I'm blocked right now — check the status above before leaving this unresolved."
  }
  return "Yes — you can close the browser. I'll keep working and update Home when something needs your review."
}
