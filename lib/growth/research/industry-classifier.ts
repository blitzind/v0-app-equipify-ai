import type { GrowthIndustryClassificationResult, GrowthResearchIndustry, GrowthWebsiteScrapeResult } from "@/lib/growth/research/research-types"

type IndustryRule = {
  industry: GrowthResearchIndustry
  patterns: RegExp[]
  weight: number
}

const INDUSTRY_RULES: IndustryRule[] = [
  { industry: "HVAC", patterns: [/hvac|heating|cooling|air conditioning|furnace/i], weight: 30 },
  { industry: "Electrical", patterns: [/electrician|electrical|wiring|panel upgrade/i], weight: 30 },
  { industry: "Medical Equipment", patterns: [/biomedical|medical equipment|clinical|hospital/i], weight: 28 },
  { industry: "Plumbing", patterns: [/plumb|drain|sewer|water heater/i], weight: 28 },
  { industry: "Garage Door", patterns: [/garage door|overhead door/i], weight: 28 },
  { industry: "MEP", patterns: [/mep|mechanical electrical plumbing/i], weight: 24 },
  { industry: "Appliance Repair", patterns: [/appliance repair|washer|dryer|refrigerator repair/i], weight: 24 },
  { industry: "Commercial Equipment", patterns: [/commercial equipment|industrial equipment/i], weight: 22 },
  { industry: "Equipment Service", patterns: [/equipment service|field service|service technician/i], weight: 20 },
  { industry: "Specialty Contractor", patterns: [/contractor|construction|remodel/i], weight: 16 },
  { industry: "Field Service", patterns: [/field service|dispatch|service call/i], weight: 18 },
]

export function classifyProspectIndustry(
  companyName: string,
  scrape: GrowthWebsiteScrapeResult,
): GrowthIndustryClassificationResult {
  const haystack = [
    companyName,
    scrape.title ?? "",
    scrape.metaDescription ?? "",
    scrape.plainText,
    ...scrape.services,
  ]
    .join("\n")
    .toLowerCase()

  let best: GrowthIndustryClassificationResult = { industry: "Unknown", confidence: 25 }

  for (const rule of INDUSTRY_RULES) {
    const hits = rule.patterns.filter((pattern) => pattern.test(haystack)).length
    if (hits === 0) continue
    const confidence = Math.min(95, 40 + hits * rule.weight)
    if (confidence > best.confidence) {
      best = { industry: rule.industry, confidence }
    }
  }

  if (best.industry === "Unknown" && /service|repair|maintenance/i.test(haystack)) {
    best = { industry: "Field Service", confidence: 45 }
  }

  return best
}
