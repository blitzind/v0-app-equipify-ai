import type { GrowthWebsiteMaturityResult, GrowthWebsiteScrapeResult } from "@/lib/growth/research/research-types"

type FeatureFlags = {
  hasSsl: boolean
  hasMobileViewport: boolean
  hasOnlineBooking: boolean
  hasCustomerPortal: boolean
  hasSocialLinks: boolean
  hasReviewLinks: boolean
  hasChatWidget: boolean
  hasFinancing: boolean
  serviceDepth: number
  ctaDensity: number
  contactAccessibility: number
  pageQuality: number
  blogActivity: number
}

export function detectWebsiteFeatureFlags(html: string, plainText: string, scrape: GrowthWebsiteScrapeResult): FeatureFlags {
  const haystack = `${html}\n${plainText}`.toLowerCase()
  const ctaMatches = haystack.match(/book now|schedule|get a quote|contact us|call now|request service/gi)?.length ?? 0

  return {
    hasSsl: scrape.hasSsl,
    hasMobileViewport: scrape.hasMobileViewport,
    hasOnlineBooking: /book online|schedule service|online booking|appointment/i.test(haystack),
    hasCustomerPortal: /customer portal|client portal|account login|pay online|pay bill/i.test(haystack),
    hasSocialLinks: /facebook\.com|instagram\.com|linkedin\.com|youtube\.com|x\.com|twitter\.com/i.test(haystack),
    hasReviewLinks: /google\.com\/maps|yelp\.com|bbb\.org|reviews/i.test(haystack),
    hasChatWidget: /intercom|drift|livechat|tawk|chat widget|chat with us/i.test(haystack),
    hasFinancing: /financing|payment plan|affirm|warranty plan/i.test(haystack),
    serviceDepth: Math.min(10, scrape.services.length),
    ctaDensity: Math.min(10, ctaMatches),
    contactAccessibility: Math.min(10, scrape.contactMethods.length * 2),
    pageQuality: scrape.title && scrape.metaDescription ? 8 : scrape.title ? 5 : 2,
    blogActivity: /blog|news|articles|resources/i.test(haystack) ? 6 : 0,
  }
}

export function scoreWebsiteMaturity(
  html: string,
  plainText: string,
  scrape: GrowthWebsiteScrapeResult,
): GrowthWebsiteMaturityResult {
  const flags = detectWebsiteFeatureFlags(html, plainText, scrape)

  const breakdown: Record<string, number> = {
    ssl: flags.hasSsl ? 10 : 0,
    mobile: flags.hasMobileViewport ? 12 : 0,
    booking: flags.hasOnlineBooking ? 14 : 0,
    portal: flags.hasCustomerPortal ? 10 : 0,
    social: flags.hasSocialLinks ? 8 : 0,
    reviews: flags.hasReviewLinks ? 10 : 0,
    chat: flags.hasChatWidget ? 6 : 0,
    financing: flags.hasFinancing ? 6 : 0,
    serviceDepth: flags.serviceDepth,
    ctaDensity: flags.ctaDensity,
    contactAccessibility: flags.contactAccessibility,
    pageQuality: flags.pageQuality,
    blogActivity: flags.blogActivity,
  }

  const raw = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  const score = Math.max(0, Math.min(100, Math.round((raw / 102) * 100)))

  return { score, breakdown }
}
