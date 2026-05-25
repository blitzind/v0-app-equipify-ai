import type {
  GrowthIndustryClassificationResult,
  GrowthResearchIndustry,
  GrowthResearchPainSignal,
  GrowthResearchRecommendedAction,
  GrowthWebsiteScrapeResult,
} from "@/lib/growth/research/research-types"

export function buildProspectResearchSummary(input: {
  companyName: string
  industry: GrowthIndustryClassificationResult
  scrape: GrowthWebsiteScrapeResult
  maturityScore: number
  painSignals: GrowthResearchPainSignal[]
  technologies: string[]
  recommendedAction: GrowthResearchRecommendedAction | string
}): string {
  const serviceHint = input.scrape.services.slice(0, 3).join(", ")
  const techHint = input.technologies.slice(0, 3).join(", ") || "no major stack signals"
  const painHint = input.painSignals.slice(0, 4).map((signal) => signal.replace(/_/g, " ")).join(", ") || "limited pain signals"

  return [
    `${input.companyName} looks like ${input.industry.industry} (${input.industry.confidence}% confidence).`,
    `Website maturity ${input.maturityScore}/100${serviceHint ? ` with services such as ${serviceHint}` : ""}.`,
    `Detected technologies: ${techHint}.`,
    `Top opportunities: ${painHint}.`,
    `Suggested operator action: ${input.recommendedAction}.`,
  ].join(" ")
}

export function computeResearchConfidence(input: {
  fetchStatus: string
  industryConfidence: number
  maturityScore: number
  painSignalCount: number
  technologyCount: number
}): number {
  let score = 30
  if (input.fetchStatus === "ok") score += 25
  else if (input.fetchStatus === "skipped") score += 10
  score += Math.round(input.industryConfidence * 0.2)
  score += Math.min(15, input.painSignalCount * 2)
  score += Math.min(10, input.technologyCount * 2)
  if (input.maturityScore > 0) score += 5
  return Math.max(0, Math.min(100, score))
}
