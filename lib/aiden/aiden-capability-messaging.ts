/**
 * Client- and server-safe copy for AIden capability-aware UX (plan, prepared actions, chat limits).
 * Keep claims aligned with `lib/aiden/tier-capabilities.ts` and productivity / safe-action routes.
 */

import type { AidenModuleId } from "@/lib/aiden/module-context"

/** When true, welcome / prompts may describe on-behalf execution after human approval (not shipped yet). */
export const AIDEN_FUTURE_APPROVED_EXECUTION_MESSAGING = false

export type AidenEligibilityForMessaging = {
  safeActionsEnabled: boolean
  safeActionsGrowthHint: boolean
  productivityEnabled?: boolean
  operationalCopilotEnabled?: boolean
}

export type AidenCapabilityBadgeId = "guidance" | "action_assist" | "operational_assistant"

export function resolveAidenCapabilityBadge(eligibility: AidenEligibilityForMessaging | null): AidenCapabilityBadgeId {
  if (!eligibility) return "guidance"
  if (eligibility.safeActionsEnabled) return "operational_assistant"
  if (eligibility.productivityEnabled) return "action_assist"
  return "guidance"
}

const BADGE_LABEL: Record<AidenCapabilityBadgeId, string> = {
  guidance: "Guidance mode",
  action_assist: "Action assist enabled",
  operational_assistant: "Operational assistant",
}

export function aidenCapabilityBadgeLabel(id: AidenCapabilityBadgeId): string {
  return BADGE_LABEL[id]
}

/** Copy under "Prepared workspace action" (Scale). */
export const PREPARED_WORKSPACE_ACTION_INTRO =
  "AIden can prepare workspace actions for your review before anything is saved. Describe what you want to capture (task, internal note, reminder, or unsent communications draft)."

/**
 * Short contextual focus for the current module (shown beside generic in-panel help hints).
 */
export function getAidenPageFocusHint(moduleId: AidenModuleId): string | null {
  switch (moduleId) {
    case "inventory":
      return "Here I can help with inventory operations, stock transfers, and restock requests."
    case "catalog":
    case "purchase_orders":
    case "vendors":
      return "Here I can help with purchasing, vendors, and how parts and stock tie back to inventory and jobs."
    case "invoices":
      return "Here I can help with billing, collections, and payment reminders."
    case "work_orders":
    case "service_schedule":
    case "technicians":
      return "Here I can help with scheduling, dispatch, follow-ups, and technician workflows."
    default:
      return null
  }
}

export type AidenWelcomeArgs = {
  moduleId: AidenModuleId
  eligibility: AidenEligibilityForMessaging | null
}

function joinSentences(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p?.trim())).join(" ")
}

/**
 * Opening assistant message when the chat session has no user turns yet.
 */
export function buildAidenWelcomeContent(args: AidenWelcomeArgs): string {
  const focus = getAidenPageFocusHint(args.moduleId)
  const e = args.eligibility

  const fr = "If something isn't built yet, you can submit a feature request from here."

  if (!e) {
    return joinSentences(
      "Hi — I'm AIden. I help you use Equipify with clear, accurate guidance for where you are in the app.",
      focus,
      "This chat does not change your workspace by itself.",
      "When your plan supports it, you can also use Prepared workspace actions in this panel to draft certain items for your confirmation before they save.",
      fr,
    )
  }

  if (e.safeActionsEnabled) {
    let body = joinSentences(
      "Hi — I'm AIden. I help you operate Equipify with guidance tailored to the screen you're on.",
      focus,
      "I can walk you through workflows, explain permissions, and help you decide what to do next.",
      "On your workspace, you can also use Prepared workspace actions below: I draft bounded items such as follow-up tasks, internal notes, reminders, and unsent communication drafts for you to review - nothing saves until you confirm.",
      "This chat stream stays read-only; structured captures run through Prepare action and your confirmation.",
    )
    if (AIDEN_FUTURE_APPROVED_EXECUTION_MESSAGING) {
      body = joinSentences(
        body,
        "Approved operational execution from AIden may expand in a later phase; today everything still requires your explicit confirmation where offered.",
      )
    }
    return joinSentences(body, fr)
  }

  if (e.productivityEnabled) {
    return joinSentences(
      "Hi — I'm AIden. I help you navigate Equipify with step-by-step guidance.",
      focus,
      "Your plan includes AI productivity helpers elsewhere in the app (for example summaries and drafts where you see AIden or AI controls) - those stay under your review in their own surfaces.",
      "This chat explains how to use the product; it does not change records by itself.",
      e.safeActionsGrowthHint
        ? "Prepared workspace actions (reviewable drafts that save only after you confirm) are available on Scale."
        : null,
      fr,
    )
  }

  return joinSentences(
    "Hi — I'm AIden. I help you navigate Equipify with step-by-step guidance for your workspace.",
    focus,
    "This chat is for how-to help only - it does not change your data or run operations for you.",
    fr,
  )
}

/** Compact hint under the header when only the welcome message is showing. */
export function buildAidenIdlePanelHint(args: AidenWelcomeArgs): string {
  const focus = getAidenPageFocusHint(args.moduleId)
  const e = args.eligibility
  if (!e) {
    return joinSentences(
      "I answer questions about using Equipify (not open-ended general chat).",
      focus,
      "Capabilities for your plan load in a moment.",
    )
  }
  if (e.safeActionsEnabled) {
    return joinSentences(
      "Ask how to complete work in Equipify, or use Prepared workspace actions below for reviewable drafts.",
      focus,
    )
  }
  if (e.productivityEnabled) {
    return joinSentences(
      "Ask how to use Equipify; use AI helpers in their own screens where available.",
      focus,
    )
  }
  return joinSentences("I answer how to use Equipify — not general chat.", focus, "Try a suggested prompt or ask your own question.")
}
