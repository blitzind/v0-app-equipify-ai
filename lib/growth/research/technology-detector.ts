import type { GrowthTechnologyDetectionResult } from "@/lib/growth/research/research-types"

type TechnologyRule = {
  name: string
  patterns: RegExp[]
  weight: number
}

const TECHNOLOGY_RULES: TechnologyRule[] = [
  { name: "HubSpot", patterns: [/hubspot/i, /hs-scripts/i, /hsforms/i], weight: 12 },
  { name: "WordPress", patterns: [/wp-content/i, /wordpress/i], weight: 10 },
  { name: "Shopify", patterns: [/cdn\.shopify\.com/i, /shopify/i], weight: 10 },
  { name: "Cloudflare", patterns: [/cloudflare/i, /cf-ray/i], weight: 8 },
  { name: "Google Analytics", patterns: [/google-analytics\.com/i, /gtag\(/i, /googletagmanager/i], weight: 8 },
  { name: "Housecall Pro", patterns: [/housecallpro/i, /housecall\.pro/i], weight: 14 },
  { name: "ServiceTitan", patterns: [/servicetitan/i], weight: 14 },
]

export function detectWebsiteTechnologies(html: string, plainText: string): GrowthTechnologyDetectionResult {
  const haystack = `${html}\n${plainText}`
  const technologies: string[] = []
  let score = 20

  for (const rule of TECHNOLOGY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      technologies.push(rule.name)
      score += rule.weight
    }
  }

  if (/servicetitan/i.test(haystack) && !technologies.includes("ServiceTitan")) {
    technologies.push("ServiceTitan (signal)")
  }

  return {
    technologies: [...new Set(technologies)],
    score: Math.min(100, score),
  }
}
