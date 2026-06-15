/** Phase GS-5D — Campaign builder wizard prioritization (client-safe). */

import type {
  CampaignBuilderFilter,
  CampaignBuilderWizard,
  CampaignBuilderWizardStatus,
} from "@/lib/growth/campaign-builder/campaign-builder-types"

const STATUS_RANK: Record<CampaignBuilderWizardStatus, number> = {
  blocked: 4,
  needs_review: 3,
  ready_for_human_approval: 2,
  draft: 1,
}

const REVIEW_PENALTY: Record<CampaignBuilderWizard["review_status"], number> = {
  pending: 0,
  reviewed: -20,
  dismissed: -100,
}

export function scoreCampaignBuilderWizard(wizard: CampaignBuilderWizard): number {
  const statusScore = STATUS_RANK[wizard.wizard_status] * 20
  const configScore = wizard.configuration_score * 0.5
  const stepComplete = wizard.steps.filter((s) => s.status === "complete").length * 4
  const riskPenalty = wizard.risks.filter((r) => r.severity === "critical").length * 15
  const reviewPenalty = REVIEW_PENALTY[wizard.review_status] ?? 0
  return Math.round(statusScore + configScore + stepComplete - riskPenalty + reviewPenalty)
}

export function rankCampaignBuilderWizards(wizards: CampaignBuilderWizard[]): CampaignBuilderWizard[] {
  return [...wizards].sort((left, right) => {
    const scoreDiff = scoreCampaignBuilderWizard(right) - scoreCampaignBuilderWizard(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.generated_at.localeCompare(left.generated_at)
  })
}

export function filterCampaignBuilderWizards(
  wizards: CampaignBuilderWizard[],
  filter: CampaignBuilderFilter,
): CampaignBuilderWizard[] {
  switch (filter) {
    case "blocked":
      return wizards.filter((w) => w.wizard_status === "blocked")
    case "needs_review":
      return wizards.filter((w) => w.wizard_status === "needs_review")
    case "ready":
      return wizards.filter((w) => w.wizard_status === "ready_for_human_approval")
    default:
      return wizards.filter((w) => w.review_status !== "dismissed")
  }
}
