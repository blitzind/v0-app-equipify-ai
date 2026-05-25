import type {
  GrowthPainSignalDetectionResult,
  GrowthResearchPainSignal,
  GrowthWebsiteScrapeResult,
} from "@/lib/growth/research/research-types"
import { detectWebsiteFeatureFlags } from "@/lib/growth/research/website-maturity-score"

export function detectProspectPainSignals(
  html: string,
  plainText: string,
  scrape: GrowthWebsiteScrapeResult,
  maturityScore: number,
): GrowthPainSignalDetectionResult {
  const flags = detectWebsiteFeatureFlags(html, plainText, scrape)
  const painSignals: GrowthResearchPainSignal[] = []

  if (!flags.hasOnlineBooking) painSignals.push("missing_online_booking")
  if (!flags.hasReviewLinks) painSignals.push("weak_reviews")
  if (!flags.hasCustomerPortal) painSignals.push("missing_customer_portal")
  if (maturityScore < 45) painSignals.push("outdated_site")
  if (!flags.hasMobileViewport) painSignals.push("weak_mobile")
  if (!flags.hasFinancing) painSignals.push("no_financing")
  if (!flags.hasChatWidget) painSignals.push("missing_chat")
  if (scrape.services.length < 3) painSignals.push("limited_service_visibility")
  if (!flags.hasSocialLinks && !flags.hasReviewLinks) painSignals.push("no_trust_indicators")
  if (!flags.hasOnlineBooking && flags.ctaDensity < 3) painSignals.push("missing_scheduling_flow")
  if (flags.ctaDensity < 2) painSignals.push("weak_cta_density")
  if (!flags.hasCustomerPortal && !flags.hasFinancing) painSignals.push("weak_customer_retention_indicators")

  return { painSignals: [...new Set(painSignals)] }
}
