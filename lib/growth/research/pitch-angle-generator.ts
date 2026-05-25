import type {
  GrowthResearchIndustry,
  GrowthResearchPainSignal,
  GrowthResearchRecommendedAction,
} from "@/lib/growth/research/research-types"

export function generateSuggestedPitchAngle(input: {
  companyName: string
  industry: GrowthResearchIndustry | string
  painSignals: GrowthResearchPainSignal[]
  maturityScore: number
}): string {
  const topPain = input.painSignals[0]?.replace(/_/g, " ") ?? "operational gaps"
  if (input.maturityScore < 45) {
    return `${input.companyName} appears ready for a modern customer experience upgrade — lead with how Equipify closes ${topPain} while improving dispatch and service visibility.`
  }
  return `Position Equipify as the ${input.industry} growth layer that turns ${topPain} into faster response, cleaner scheduling, and stronger customer retention.`
}

export function generateSuggestedSequence(input: {
  painSignals: GrowthResearchPainSignal[]
  recommendedAction: GrowthResearchRecommendedAction | string
}): string {
  if (input.recommendedAction === "Enroll Sequence") {
    return "Use a 4-touch awareness sequence: website gap insight → customer portal value → dispatch efficiency → soft demo invite."
  }
  if (input.painSignals.includes("missing_online_booking")) {
    return "Start with booking friction messaging, then follow with portal + dispatch efficiency proof points."
  }
  return "Standard nurture sequence: problem insight → social proof → operational ROI → meeting ask."
}

export function generateSuggestedCallOpening(input: {
  companyName: string
  industry: GrowthResearchIndustry | string
  painSignals: GrowthResearchPainSignal[]
}): string {
  const pain = input.painSignals[0]?.replace(/_/g, " ") ?? "service operations"
  return `Hi — I was reviewing ${input.companyName}'s ${input.industry} presence and noticed opportunities around ${pain}. Are you open to a quick conversation on how teams like yours streamline scheduling and customer communication?`
}

export function recommendProspectNextAction(input: {
  painSignals: GrowthResearchPainSignal[]
  maturityScore: number
  fetchStatus: string
  hasPhone: boolean
}): GrowthResearchRecommendedAction {
  if (input.fetchStatus !== "ok" && input.fetchStatus !== "skipped") return "Review Website"
  if (input.maturityScore < 35) return "Review Website"
  if (input.painSignals.length >= 4) return "Enroll Sequence"
  if (input.hasPhone) return "Call Prospect"
  if (input.maturityScore >= 60) return "Schedule Demo"
  return "Follow Up"
}
