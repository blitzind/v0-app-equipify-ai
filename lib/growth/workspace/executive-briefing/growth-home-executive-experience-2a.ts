/**
 * AVA-GROWTH-OPERATOR-2A — Executive Home experience simplification (presentation-only).
 * Does not change intelligence, autonomy, canonical authorities, or data models.
 */

import type { GrowthPortfolioManagerOperatorProjection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { humanizeOperatorFacingCopy } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import type { GrowthHomeWorkspaceHealthPresentation } from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

export const AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER =
  "ava-growth-operator-2a-executive-experience-v1" as const

export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_BRIEFING = "Executive Briefing" as const
export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_WAITING = "What I Need From You" as const
export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_RECOMMENDATION = "Current Recommendation" as const
export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_OBJECTIVE = "Current Objective" as const
export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_PORTFOLIO = "Portfolio Health" as const
export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_SECTION_MISSIONS = "Active Missions" as const

export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_DETAILS_TITLE = "Show details" as const
export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_DETAILS_SUBTITLE =
  "Live activity, reasoning, progress metrics, and diagnostics." as const

export const GROWTH_HOME_EXECUTIVE_EXPERIENCE_2A_REASONING_TOGGLE = "Show Ava's reasoning" as const

const EXECUTIVE_TECHNICAL_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Autonomous preparation capacity currently exceeds review capacity\s*\((\d+) packages awaiting decision\)\.?/i,
    (_match, count: string) => {
      const n = Number(count)
      if (n === 1) {
        return "I've prepared one qualified opportunity. Reviewing it now will allow me to continue building the pipeline."
      }
      return `I've prepared ${n} qualified opportunities. Reviewing them now will allow me to continue building the pipeline.`
    },
  ],
  [
    /Clear the approval queue before prioritizing additional discovery or research expansion\.?/i,
    "Review what's ready first — then I'll keep building the pipeline.",
  ],
  [
    /Prioritize decision-maker verification throughput before adding net-new discovery volume\.?/i,
    "Let's finish verifying decision makers on current accounts before expanding discovery.",
  ],
  [
    /draft-factory authority/gi,
    "prepared outreach",
  ],
  [
    /operator acknowledgment/gi,
    "your review",
  ],
  [
    /review-ready state/gi,
    "ready for your review",
  ],
]

export function shortenExecutiveParagraph(text: string, maxSentences = 2): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [trimmed]
  return sentences.slice(0, maxSentences).join(" ").trim()
}

export function humanizeExecutivePresentationCopy(text: string | null | undefined): string {
  if (!text?.trim()) return ""
  let output = humanizeOperatorFacingCopy(text)
  for (const [pattern, replacement] of EXECUTIVE_TECHNICAL_PHRASE_REPLACEMENTS) {
    if (typeof replacement === "string") {
      output = output.replace(pattern, replacement)
    } else {
      output = output.replace(pattern, replacement as (substring: string, ...args: string[]) => string)
    }
  }
  return output.replace(/\s{2,}/g, " ").trim()
}

export type GrowthHomeExecutivePortfolioHealthPresentation = {
  qaMarker: typeof AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER
  headline: string
  detail: string | null
  activeCompanies: number | null
  targetCompanies: number | null
  fillPercent: number | null
  tone: "healthy" | "attention" | "neutral"
}

export function buildExecutivePortfolioHealthPresentation(input: {
  portfolio: GrowthPortfolioManagerOperatorProjection | null | undefined
}): GrowthHomeExecutivePortfolioHealthPresentation | null {
  const portfolio = input.portfolio
  if (!portfolio) return null

  const fillPercent =
    portfolio.targetActiveCompanies > 0
      ? Math.round((portfolio.currentActiveCompanies / portfolio.targetActiveCompanies) * 100)
      : null

  const headline = humanizeExecutivePresentationCopy(portfolio.healthLabel)
  const detail =
    portfolio.discoveryRunning && portfolio.discoveryStatusDisplay
      ? humanizeExecutivePresentationCopy(portfolio.discoveryStatusDisplay)
      : portfolio.researchRunning
        ? `${portfolio.researchRunningCount} companies in active research`
        : null

  return {
    qaMarker: AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER,
    headline,
    detail,
    activeCompanies: portfolio.currentActiveCompanies,
    targetCompanies: portfolio.targetActiveCompanies,
    fillPercent,
    tone: portfolio.healthState === "healthy" ? "healthy" : "attention",
  }
}

export function filterWorkspaceHealthForExecutiveSurface(input: {
  presentation: GrowthHomeWorkspaceHealthPresentation
  heroMentionsReview: boolean
  heroMentionsPipeline: boolean
}): GrowthHomeWorkspaceHealthPresentation {
  const items = input.presentation.items.filter((item) => {
    if (item.id === "packages-awaiting" && input.heroMentionsReview) return false
    if (item.id === "pipeline-health" && input.heroMentionsPipeline) return false
    return true
  })

  return {
    ...input.presentation,
    items,
  }
}

export function heroMentionsOperatorReview(heroNarrative: string): boolean {
  return /review|approval|packages ready|need your review/i.test(heroNarrative)
}

export function heroMentionsPipelineHealth(heroNarrative: string): boolean {
  return /portfolio|pipeline|discover|qualified companies|healthy/i.test(heroNarrative)
}
