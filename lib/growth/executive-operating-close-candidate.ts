import type { GrowthLeadExecutiveOperatingInput } from "@/lib/growth/executive-operating-types"

export function isExecutiveCloseCandidate(input: {
  fit: number | null
  opportunityReadinessTier: GrowthLeadExecutiveOperatingInput["opportunityReadinessTier"]
  relationshipStrengthTier: GrowthLeadExecutiveOperatingInput["relationshipStrengthTier"]
  opportunityBuyingSignalStrength: GrowthLeadExecutiveOperatingInput["opportunityBuyingSignalStrength"]
  revenueProbabilityTier: GrowthLeadExecutiveOperatingInput["revenueProbabilityTier"]
  decisionMakerStatus: GrowthLeadExecutiveOperatingInput["decisionMakerStatus"]
}): boolean {
  const fit = input.fit ?? 0
  const dmConfirmed =
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"

  const opportunityComposite =
    (input.opportunityReadinessTier === "sales_ready" ||
      input.opportunityReadinessTier === "priority_opportunity") &&
    fit > 80 &&
    (input.relationshipStrengthTier === "trusted" ||
      input.relationshipStrengthTier === "strategic") &&
    (input.opportunityBuyingSignalStrength === "moderate" ||
      input.opportunityBuyingSignalStrength === "strong")

  const revenueComposite =
    input.revenueProbabilityTier === "commit_candidate" && fit > 80 && dmConfirmed

  return opportunityComposite || revenueComposite
}
