/** AVA-HOME-PROJECTION-CUTOVER-1A — Supervised Ava Home operator attention (client-safe). */

import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export const AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER =
  "ava-home-projection-cutover-1a-v1" as const

export type GrowthSupervisedAvaHomeReadyItem = {
  generationId: string
  leadId: string
  companyName: string
  contactName: string | null
  subject: string
  rationale: string | null
  reviewHref: string
  preparedAt: string
  /** True when message approval binding exists and send is authorized. */
  outboundSendAuthorized: boolean
  messageStatusLabel?: string
  showApproveEmailAction?: boolean
  showSendEmailAction?: boolean
  senderEmail?: string | null
}

export type GrowthSupervisedAvaHomeNeedsInformationItem = {
  leadId: string
  companyName: string
  decision: "hold" | "pursue"
  rationale: string | null
  missingInformation: string[]
  reviewHref: string
}

export type GrowthSupervisedAvaHomeOperatorAttention = {
  qaMarker: typeof AVA_HOME_PROJECTION_CUTOVER_1A_QA_MARKER
  readyForReview: GrowthSupervisedAvaHomeReadyItem[]
  /** Approved supervised drafts with valid binding — send-eligible on Home. */
  approvedReadyToSend: GrowthSupervisedAvaHomeReadyItem[]
  needsInformation: GrowthSupervisedAvaHomeNeedsInformationItem[]
  /** Lead IDs with a completed supervised outbound send — excluded from review queues. */
  sentLeadIds: string[]
  /** Lead IDs with completed first-touch outbound (transport or reconciled) — excluded from initial outreach. */
  firstTouchCompleteLeadIds: string[]
  rejectedCount: number
}

export function supervisedNeedsInformationToWaitingOnYou(
  items: GrowthSupervisedAvaHomeNeedsInformationItem[],
): GrowthHomeWaitingOnYouItem[] {
  return items.map((item) => {
    const missing = item.missingInformation[0]?.trim()
    const detail =
      missing ??
      item.rationale?.trim() ??
      (item.decision === "pursue"
        ? "Need a decision maker before I can recommend outreach."
        : "Need additional information before I can recommend outreach.")

    let label = `Needs additional information — ${item.companyName}`
    if (item.decision === "pursue") {
      label = `Need decision maker — ${item.companyName}`
    } else if (item.missingInformation.some((row) => /website unavailable/i.test(row))) {
      label = `Website unavailable — ${item.companyName}`
    } else if (item.missingInformation.some((row) => /identity unresolved/i.test(row))) {
      label = `Identity unresolved — ${item.companyName}`
    }

    return {
      id: `supervised-needs-info:${item.leadId}`,
      label,
      detail,
      href: item.reviewHref,
      category: "research",
    }
  })
}
