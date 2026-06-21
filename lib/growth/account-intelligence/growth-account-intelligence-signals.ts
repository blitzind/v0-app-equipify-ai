/** GS-AI-PLAYBOOK-3A — Signal categorization patterns (client-safe). */

import type {
  GrowthAccountIntelligenceSignalCategory,
  GrowthAccountIntelligenceSourceType,
} from "@/lib/growth/account-intelligence/growth-account-intelligence-types"

export const GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_PRECEDENCE: Record<
  GrowthAccountIntelligenceSourceType,
  number
> = {
  crm_metadata: 1,
  research: 2,
  website_crawl: 3,
  discovery: 4,
  apollo: 5,
  public_indicator: 6,
}

export const GROWTH_ACCOUNT_INTELLIGENCE_SOURCE_BASE_CONFIDENCE: Record<
  GrowthAccountIntelligenceSourceType,
  number
> = {
  crm_metadata: 92,
  research: 88,
  website_crawl: 84,
  discovery: 78,
  apollo: 74,
  public_indicator: 68,
}

const CATEGORY_PATTERNS: Array<{
  category: GrowthAccountIntelligenceSignalCategory
  pattern: RegExp
}> = [
  {
    category: "operational",
    pattern:
      /\b(dispatch|field techn|work order|pm program|preventive maintenance|multi-?location|after-?hours|service area|backlog|scheduling|route|technician|truck roll|first-?time fix)\b/i,
  },
  {
    category: "growth",
    pattern:
      /\b(hiring|recruit|expansion|expand|acquisition|acquired|new location|additional location|service line|opening|growth|branch|scale)\b/i,
  },
  {
    category: "compliance",
    pattern:
      /\b(compliance|audit|recall|certification|inspection|joint commission|fda|regulated|survey|traceability|aami|iso)\b/i,
  },
  {
    category: "technology",
    pattern:
      /\b(portal|scheduling software|erp|crm|integration|servicetitan|salesforce|quickbooks|software|platform|system)\b/i,
  },
  {
    category: "customer",
    pattern:
      /\b(testimonial|review|guarantee|hospital|surgery center|clinic|facility|customer|client|serves|supports|vertical)\b/i,
  },
  {
    category: "differentiation",
    pattern:
      /\b(specializ|certified|accredited|unique|differentiat|leader|award|premier|trusted partner)\b/i,
  },
  {
    category: "equipment",
    pattern:
      /\b(equipment|biomedical|hvac|calibration|medical device|infusion|imaging|modality|asset|fleet)\b/i,
  },
  {
    category: "financial",
    pattern: /\b(revenue|profit|margin|contract|billing|invoice|t&m|time and material)\b/i,
  },
  {
    category: "location",
    pattern: /\b(located|headquarter|office|campus|region|state|city|county|nationwide|across)\b/i,
  },
  {
    category: "services",
    pattern: /\b(provides|offers|delivers|service|maintenance|repair|install|support|field service)\b/i,
  },
  {
    category: "products",
    pattern: /\b(product|solution|offering|portfolio|line of)\b/i,
  },
  {
    category: "website",
    pattern: /\b(website|site excerpt|online|web page|homepage)\b/i,
  },
]

export function classifyAccountIntelligenceSignal(text: string): GrowthAccountIntelligenceSignalCategory {
  for (const entry of CATEGORY_PATTERNS) {
    if (entry.pattern.test(text)) return entry.category
  }
  return "summary"
}

export function mapSnapshotSourceToAccountSource(source: string): GrowthAccountIntelligenceSourceType {
  const normalized = source.toLowerCase()
  if (normalized.includes("canonical") || normalized.includes("staging")) return "crm_metadata"
  if (normalized.includes("website")) return "website_crawl"
  if (normalized.includes("apollo")) return "apollo"
  if (normalized.includes("discovery")) return "discovery"
  if (normalized.includes("manual")) return "crm_metadata"
  return "research"
}

export function mapSnapshotCategoryToSignalCategory(
  category: string,
): GrowthAccountIntelligenceSignalCategory {
  switch (category) {
    case "technology":
      return "technology"
    case "hiring":
      return "growth"
    case "company_size":
      return "summary"
    case "location":
      return "location"
    case "description":
    case "industry":
    case "sub_industry":
      return "summary"
    case "website_signal":
      return "website"
    case "social_presence":
      return "customer"
    case "contactability":
      return "operational"
    default:
      return classifyAccountIntelligenceSignal(category)
  }
}

export const GROWTH_ACCOUNT_INTELLIGENCE_MISSING_SIGNAL_HINTS = [
  "operational workflow signals",
  "growth or hiring indicators",
  "technology stack indicators",
  "customer or vertical focus",
  "differentiation signals",
  "compliance indicators",
] as const
