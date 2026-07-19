/** GE-AIOS-19C-4A / GE-AIOS-IDENTITY-1B — Zero-assistance adoption polish (client-safe customer copy). */

import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE } from "@/lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a"
import { GROWTH_TRAINING_COMPANY_PROFILE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import type {
  GrowthHumanApprovalActionType,
  GrowthHumanApprovalItem,
} from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  completedWorkDescription,
  completedWorkHeroEmpty,
  completedWorkNavLabel,
  completedWorkTitle,
  reviewCompletedWorkFull,
  whyTeammateStops,
  teammatePossessive,
} from "@/lib/workspace/ai-teammate-voice"

export const GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER =
  "ge-aios-19c-4a-zero-assistance-adoption-polish-v1" as const

export const GROWTH_LAUNCH_COMPLETE_BANNER_STORAGE_KEY =
  "equipify:growth:launch-complete-banner/v1" as const

export function growthCustomerApprovalsNavLabel(teammate: AiTeammatePresentation): string {
  return completedWorkNavLabel(teammate)
}

export function growthCustomerApprovalsTitle(teammate: AiTeammatePresentation): string {
  return completedWorkTitle(teammate)
}

export function growthCustomerApprovalsPageDescription(teammate: AiTeammatePresentation): string {
  return completedWorkDescription(teammate)
}

export function growthCustomerApprovalsTrustHeadline(teammate: AiTeammatePresentation): string {
  return whyTeammateStops(teammate)
}

export const GROWTH_CUSTOMER_APPROVALS_TRUST_BODY =
  "I prepare research, drafts, and outreach plans first. You authorize my completed work — or ask me to revise. Check Home daily; I'll surface urgent items there too." as const

export function growthCustomerApprovalsWhenToVisit(teammate: AiTeammatePresentation): string {
  return `Visit when Home shows ${teammate.name} completed work waiting, or once a day during your first week.`
}

export const GROWTH_CUSTOMER_APPROVALS_AFTER_APPROVE =
  "After you authorize a package, transport approval remains a separate gate before anything sends." as const

export function growthCustomerApprovalsEmptyHeadline(teammate: AiTeammatePresentation): string {
  return completedWorkHeroEmpty(teammate)
}

export const GROWTH_CUSTOMER_APPROVALS_EMPTY_BODY =
  "That's normal while I'm still learning your business or between outreach cycles. Complete Training if setup isn't finished — then check Home; I'll add completed work here when drafts are ready." as const

export const GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_LABEL = "Continue in Training" as const

export const GROWTH_CUSTOMER_APPROVALS_EMPTY_ACTION_HREF = GROWTH_TRAINING_COMPANY_PROFILE_ROUTE

export const GROWTH_CUSTOMER_APPROVALS_FILTER_EMPTY =
  "No items in this category. Try All, or check back after I prepare new drafts." as const

export const GROWTH_CUSTOMER_LAUNCH_COMPLETE_HEADLINE = "You're all set" as const

export const GROWTH_CUSTOMER_LAUNCH_COMPLETE_BODY =
  "is working in the background now — researching companies, preparing outreach drafts, and learning from your business profile." as const

export function growthCustomerLaunchCompleteNextSteps(
  teammate: AiTeammatePresentation,
): readonly [string, string, string] {
  return [
    `Review ${teammatePossessive(teammate)} completed work when I prepare outreach drafts.`,
    "Watch why I chose today's plan in Operations.",
    "Teach me more anytime in Training.",
  ] as const
}

export const GROWTH_CUSTOMER_HOME_PAGE_DESCRIPTION_SUFFIX =
  "Your AI sales teammate's daily briefing." as const

export const GROWTH_CUSTOMER_EMPTY_WORK_MESSAGE =
  "I don't have companies in today's queue yet. Finish your Company Profile in Training and add leads — then I'll start researching and preparing outreach for your review." as const

export const GROWTH_CUSTOMER_EMPTY_WORK_NEXT_LABEL = "Open Company Profile" as const

export const GROWTH_CUSTOMER_EMPTY_MEMORY_MESSAGE = GROWTH_INSTITUTIONAL_LEARNING_EMPTY_MESSAGE

export const GROWTH_CUSTOMER_EMPTY_OPERATIONS_FOCUS =
  "I'm getting oriented. Complete Training if you haven't yet — once companies enter the queue, I'll show what I'm doing and why here." as const

export const GROWTH_CUSTOMER_EMPTY_OPERATIONS_DECISION =
  "I'll explain my choices here once today's work queue has items. Until then, teach me your business in Training." as const

export const GROWTH_CUSTOMER_EMPTY_OPERATIONS_NEXT =
  "Next steps appear as I plan research and outreach. You can leave this page — I'll keep working." as const

export const GROWTH_CUSTOMER_EMPTY_OPERATIONS_COMPLETED =
  "Completed work appears here after I finish research or prepare drafts you approve." as const

export const GROWTH_CUSTOMER_EMPTY_OPERATIONS_TIMELINE =
  "Recent activity appears here as I work through your queue." as const

export function growthCustomerCrossLinkApprovalsLabel(teammate: AiTeammatePresentation): string {
  return completedWorkNavLabel(teammate)
}

export function growthCustomerCrossLinkApprovalsDescription(
  teammate: AiTeammatePresentation,
): string {
  return `Review work ${teammate.name} completed before anything sends`
}

export type GrowthCustomerApprovalPrimaryAction = {
  approveLabel: string
  rejectLabel: string
  approveHref: string | null
  rejectHref: string | null
  helperText: string
}

export function formatGrowthCustomerApprovalChannelLabel(channel: string | undefined): string | null {
  if (!channel || channel === "none") return null
  if (channel === "sms") return "Text message"
  if (channel === "email") return "Email"
  if (channel === "voice") return "Voice message"
  if (channel === "call") return "Phone call"
  return channel.charAt(0).toUpperCase() + channel.slice(1)
}

export function formatGrowthCustomerApprovalActionLabel(actionType: GrowthHumanApprovalActionType): string {
  if (actionType === "send_email") return "Email ready to send"
  if (actionType === "send_sms") return "Text ready to send"
  if (actionType === "approve_outreach_package") return "Outreach draft"
  if (actionType === "approve_execution_plan") return "Plan ready for review"
  if (actionType === "approve_meeting_prep") return "Meeting prep"
  if (actionType === "review_recommendation") return "Recommendation"
  if (actionType === "review_blocker") return "Needs your input"
  return "Prepared for your review"
}

export function formatGrowthCustomerApprovalStatusLabel(status: GrowthHumanApprovalItem["status"]): string {
  if (status === "pending") return "Waiting for you"
  if (status === "needs_review") return "Needs review"
  if (status === "blocked") return "Blocked"
  if (status === "approved_elsewhere") return "Approved — finish activation"
  if (status === "expired") return "Expired"
  return status
}

export function resolveGrowthCustomerApprovalPrimaryAction(
  item: Pick<GrowthHumanApprovalItem, "route" | "status" | "actionType">,
  teammate?: AiTeammatePresentation,
): GrowthCustomerApprovalPrimaryAction {
  const href = item.route?.trim() || null
  if (!href) {
    return {
      approveLabel: "Waiting on setup",
      rejectLabel: "Not available",
      approveHref: null,
      rejectHref: null,
      helperText: "Finish Training and connected tools first — then I'll bring drafts here for approval.",
    }
  }
  return {
    approveLabel: "Authorize",
    rejectLabel: "Reject",
    approveHref: href,
    rejectHref: href,
    helperText: teammate
      ? `${reviewCompletedWorkFull(teammate)} to authorize or reject. Nothing sends until you authorize — and package authorization is not permission to send.`
      : "Review completed work to authorize or reject. Nothing sends until you authorize — and package authorization is not permission to send.",
  }
}

export function readGrowthLaunchCompleteBannerDismissed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(GROWTH_LAUNCH_COMPLETE_BANNER_STORAGE_KEY) === "dismissed"
  } catch {
    return false
  }
}

export function dismissGrowthLaunchCompleteBanner(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_LAUNCH_COMPLETE_BANNER_STORAGE_KEY, "dismissed")
  } catch {
    // ignore
  }
}

/** @deprecated Prefer growthCustomerCrossLinkApprovalsLabel(teammate) */
export const GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_LABEL = "Completed Work" as const
/** @deprecated Prefer growthCustomerCrossLinkApprovalsDescription(teammate) */
export const GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_DESCRIPTION =
  "Review work your AI teammate completed before anything sends" as const
