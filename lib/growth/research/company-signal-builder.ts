import type { GrowthCompanySignalBuildResult, GrowthWebsiteScrapeResult } from "@/lib/growth/research/research-types"
import { detectWebsiteFeatureFlags } from "@/lib/growth/research/website-maturity-score"

const COMPETITOR_HINTS = [
  { name: "ServiceTitan", pattern: /servicetitan/i },
  { name: "Housecall Pro", pattern: /housecallpro|housecall\.pro/i },
  { name: "Jobber", pattern: /jobber/i },
  { name: "FieldEdge", pattern: /fieldedge/i },
]

export function buildCompanySignals(
  html: string,
  plainText: string,
  scrape: GrowthWebsiteScrapeResult,
  technologies: string[],
): GrowthCompanySignalBuildResult {
  const flags = detectWebsiteFeatureFlags(html, plainText, scrape)
  const haystack = `${html}\n${plainText}`.toLowerCase()

  const socialPresenceScore = Math.min(
    100,
    (flags.hasSocialLinks ? 45 : 0) + (flags.hasReviewLinks ? 35 : 0) + (flags.hasChatWidget ? 20 : 0),
  )
  const reputationScore = Math.min(100, (flags.hasReviewLinks ? 70 : 20) + (flags.hasSsl ? 15 : 0) + (flags.pageQuality >= 5 ? 15 : 0))

  const employeeMatch = haystack.match(/(\d{1,4})\+?\s*(employees|technicians|team members)/i)
  const employeeSizeGuess = employeeMatch ? `${employeeMatch[1]}+ ${employeeMatch[2]}` : null

  const revenueMatch = haystack.match(/\$[\d,.]+(?:\s*(million|m|k))?/i)
  const revenueSizeGuess = revenueMatch ? revenueMatch[0] : null

  const competitors = COMPETITOR_HINTS.flatMap((entry) =>
    entry.pattern.test(haystack) || technologies.some((tech) => tech.toLowerCase().includes(entry.name.toLowerCase()))
      ? [{ name: entry.name, source: "website_signal", confidence: 55 }]
      : [],
  )

  return {
    socialPresenceScore,
    reputationScore,
    employeeSizeGuess,
    revenueSizeGuess,
    competitors,
  }
}
