/**
 * AVA-GROWTH-OPERATOR-1D — Executive approval package (client-safe).
 * Default operator view: executive-level fields only; engineering detail lives in Show Ava's Work.
 */

import type { Approvals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  formatExecutiveConfidenceLabel,
  GROWTH_AIOS_GROWTH_OPERATOR_1D_QA_MARKER,
  GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL,
  humanizeExecutiveCopy,
} from "@/lib/growth/aios/operator-experience/growth-executive-experience-1d"
import type { OperatorPackageRecommendation } from "@/lib/growth/workspace/ux-2d/review/growth-operator-package-recommendation-2d"
import type { OperatorPackageDecisionSummary } from "@/lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a"

export const GROWTH_EXECUTIVE_APPROVAL_PACKAGE_1D_QA_MARKER =
  GROWTH_AIOS_GROWTH_OPERATOR_1D_QA_MARKER

export type ExecutiveApprovalPackageAction = "approve" | "edit" | "reject"

export type ExecutiveApprovalPreparedMessage = {
  channel: string
  label: string
  preview: string | null
  prepared: boolean
}

export type ExecutiveApprovalPackage = {
  qaMarker: typeof GROWTH_EXECUTIVE_APPROVAL_PACKAGE_1D_QA_MARKER
  showAvaWorkLabel: typeof GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL
  company: {
    name: string
    context: string | null
    icpFitSummary: string[]
  }
  decisionMaker: {
    name: string | null
    title: string | null
    contactSummary: string
    email: string | null
    phone: string | null
  }
  confidenceLabel: string
  recommendedStrategy: string
  outreachStrategyDetail: {
    angle: string
    angleRationale: string
    openingPremise: string
    discoveryQuestion: string
    desiredNextStep: string
  }
  preparedMessages: ExecutiveApprovalPreparedMessage[]
  recommendedAction: string
  executiveRecommendation: string
  qualityLabel: string
  weakEvidenceIntro: string | null
  availableActions: ExecutiveApprovalPackageAction[]
}

function buildContactSummary(dm: Approvals2AOperatorReviewPacket["decisionMaker"]): string {
  const parts: string[] = []
  if (dm.email?.trim()) parts.push(dm.email.trim())
  if (dm.phone?.trim()) parts.push(dm.phone.trim())
  if (dm.linkedIn?.trim()) parts.push("LinkedIn on file")
  if (!parts.length) return "Contact details not yet verified."
  return parts.join(" · ")
}

function buildPreparedMessages(
  packet: Approvals2AOperatorReviewPacket,
  summary: OperatorPackageDecisionSummary,
): ExecutiveApprovalPreparedMessage[] {
  const rows: ExecutiveApprovalPreparedMessage[] = []

  if (summary.primaryEmailDraft?.prepared) {
    rows.push({
      channel: summary.primaryEmailDraft.channel,
      label: "Email",
      preview: summary.primaryEmailDraft.preview ?? null,
      prepared: true,
    })
  }

  for (const draft of summary.secondaryPreparedDrafts) {
    if (!draft.prepared) continue
    rows.push({
      channel: draft.channel,
      label: draft.label,
      preview: draft.preview ?? null,
      prepared: true,
    })
  }

  if (!rows.length) {
    for (const draft of packet.drafts) {
      if (!draft.prepared) continue
      rows.push({
        channel: draft.channel,
        label: draft.label,
        preview: draft.preview ?? null,
        prepared: true,
      })
    }
  }

  return rows
}

function qualityExecutiveLabel(state: OperatorPackageRecommendation["qualityState"]): string {
  if (state === "ready") return "Ready for your decision"
  if (state === "needs_attention") return "Review assumptions before approving"
  return "Limited evidence — proceed carefully"
}

export function projectExecutiveApprovalPackage1D(input: {
  packet: Approvals2AOperatorReviewPacket
  summary: OperatorPackageDecisionSummary
  recommendation: OperatorPackageRecommendation
}): ExecutiveApprovalPackage {
  const { packet, summary, recommendation } = input
  const dm = packet.decisionMaker

  const icpFitSummary = recommendation.whyThisAccount.slice(0, 3).map((line) => humanizeExecutiveCopy(line))

  const recommendedStrategy = humanizeExecutiveCopy(
    [
      recommendation.primaryAngle.label,
      recommendation.firstConversation.openingPremise,
    ].join(" — "),
  )

  const recommendedAction = humanizeExecutiveCopy(
    recommendation.executiveRecommendation.includes("recommend")
      ? "Approve outreach for this account"
      : "Review and decide on this opportunity",
  )

  return {
    qaMarker: GROWTH_EXECUTIVE_APPROVAL_PACKAGE_1D_QA_MARKER,
    showAvaWorkLabel: GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL,
    company: {
      name: summary.companyName,
      context: summary.companyContext ? humanizeExecutiveCopy(summary.companyContext) : null,
      icpFitSummary,
    },
    decisionMaker: {
      name: dm.name,
      title: dm.title,
      contactSummary: buildContactSummary(dm),
      email: dm.email ?? null,
      phone: dm.phone ?? null,
    },
    confidenceLabel: formatExecutiveConfidenceLabel(packet.risk.overallConfidence),
    recommendedStrategy,
    outreachStrategyDetail: {
      angle: recommendation.primaryAngle.label,
      angleRationale: humanizeExecutiveCopy(recommendation.primaryAngle.rationale),
      openingPremise: humanizeExecutiveCopy(recommendation.firstConversation.openingPremise),
      discoveryQuestion: humanizeExecutiveCopy(recommendation.firstConversation.discoveryQuestion),
      desiredNextStep: humanizeExecutiveCopy(recommendation.firstConversation.desiredNextStep),
    },
    preparedMessages: buildPreparedMessages(packet, summary),
    recommendedAction,
    executiveRecommendation: humanizeExecutiveCopy(recommendation.executiveRecommendation),
    qualityLabel: qualityExecutiveLabel(recommendation.qualityState),
    weakEvidenceIntro: recommendation.weakEvidenceIntro
      ? humanizeExecutiveCopy(recommendation.weakEvidenceIntro)
      : null,
    availableActions: ["approve", "edit", "reject"],
  }
}
