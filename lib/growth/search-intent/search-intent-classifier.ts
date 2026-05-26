import {
  GROWTH_SEARCH_INTENT_CATEGORIES,
  GROWTH_SEARCH_INTENT_STAGES,
  type GrowthSearchIntentCaptureInput,
  type GrowthSearchIntentCategory,
  type GrowthSearchIntentClassifiedSignal,
  type GrowthSearchIntentStage,
  type GrowthSearchIntentStrength,
} from "@/lib/growth/search-intent/search-intent-types"
import {
  isEmptyKeyword,
  normalizeKeyword,
} from "@/lib/growth/search-intent/search-intent-keywords"

const HIGH_INTENT_PATHS = ["/pricing", "/demo", "/book", "/contact", "/service", "/quote"]
const COMPARISON_PATHS = ["/compare", "/vs", "/alternative", "/competitor"]
const PRODUCT_PATHS = ["/product", "/features", "/solutions", "/platform"]

function pathIncludes(path: string, segments: string[]): boolean {
  const p = path.toLowerCase().split("?")[0] ?? ""
  return segments.some((s) => p === s || p.startsWith(`${s}/`) || p.includes(s))
}

function keywordIncludes(keyword: string, terms: string[]): boolean {
  const k = keyword.toLowerCase()
  return terms.some((t) => k.includes(t))
}

export function classifyIntentCategory(
  keyword: string,
  pagePath: string,
): GrowthSearchIntentCategory {
  const path = pagePath.toLowerCase()
  const k = keyword.toLowerCase()

  if (pathIncludes(path, HIGH_INTENT_PATHS)) {
    if (path.includes("/pricing") || keywordIncludes(k, ["pricing", "price", "cost"])) {
      return "pricing_research"
    }
    if (path.includes("/demo") || path.includes("/book") || keywordIncludes(k, ["demo", "trial"])) {
      return "demo_intent"
    }
    if (path.includes("/contact") || path.includes("/service") || keywordIncludes(k, ["urgent", "repair", "service"])) {
      return "urgent_service_need"
    }
  }

  if (pathIncludes(path, COMPARISON_PATHS) || keywordIncludes(k, ["vs", "compare", "alternative", "competitor"])) {
    return keywordIncludes(k, ["competitor"]) ? "competitor_research" : "vendor_comparison"
  }

  if (keywordIncludes(k, ["near me", "local", "city", "county"])) return "local_service_search"
  if (keywordIncludes(k, ["industry", "market", "trend", "report"])) return "industry_research"
  if (pathIncludes(path, PRODUCT_PATHS) || keywordIncludes(k, ["software", "platform", "tool", "solution"])) {
    return "solution_aware"
  }
  if (keywordIncludes(k, ["problem", "issue", "broken", "help", "how to"])) return "problem_aware"

  if (pathIncludes(path, HIGH_INTENT_PATHS)) return "pricing_research"
  if (k.length > 0) return "solution_aware"

  return "industry_research"
}

export function classifyIntentStage(category: GrowthSearchIntentCategory): GrowthSearchIntentStage {
  if (category === "demo_intent" || category === "pricing_research") return "evaluation"
  if (category === "urgent_service_need") return "purchase_ready"
  if (category === "vendor_comparison" || category === "competitor_research") return "evaluation"
  if (category === "solution_aware") return "consideration"
  if (category === "problem_aware") return "awareness"
  if (category === "local_service_search") return "purchase_ready"
  return "consideration"
}

export function classifyIntentStrength(
  input: GrowthSearchIntentCaptureInput,
  hasKeyword: boolean,
): GrowthSearchIntentStrength {
  if (input.source_type === "utm_keyword" && hasKeyword) return "high"
  if (input.source_type === "site_search" && hasKeyword) return "high"
  if (input.source_type === "paid_search" && hasKeyword) return "high"
  if (input.source_type === "organic_search" && hasKeyword) return "medium"
  if (input.source_type === "content_path") return "medium"
  if (input.source_type === "referrer_keyword" && !hasKeyword) return "low"
  return hasKeyword ? "medium" : "low"
}

export function buildIntentTopic(
  category: GrowthSearchIntentCategory,
  keyword: string,
  pagePath: string,
): string {
  const label = category.replace(/_/g, " ")
  if (keyword) return `${label}: ${keyword}`
  if (pagePath) return `${label} (${pagePath})`
  return label
}

export function classifySearchIntentSignal(
  input: GrowthSearchIntentCaptureInput,
): GrowthSearchIntentClassifiedSignal | null {
  const keyword = input.keyword ? normalizeKeyword(input.keyword) : ""
  const pagePath = input.matched_page_path ?? ""
  const hasKeyword = !isEmptyKeyword(keyword)

  if (!hasKeyword && input.source_type !== "content_path") {
    if (input.source_type === "referrer_keyword") return null
    if (!pagePath) return null
  }

  const normalized_keyword = hasKeyword
    ? keyword
    : normalizeKeyword(pagePath.split("/").filter(Boolean).pop() ?? "browse")
  if (isEmptyKeyword(normalized_keyword) && !pagePath) return null

  const intent_category = classifyIntentCategory(normalized_keyword, pagePath)
  const intent_stage = classifyIntentStage(intent_category)
  const intent_strength = classifyIntentStrength(input, hasKeyword)
  const intent_topic = buildIntentTopic(intent_category, hasKeyword ? normalized_keyword : "", pagePath)

  const evidenceParts = [
    hasKeyword ? `Keyword observed: "${normalized_keyword}"` : null,
    pagePath ? `Page path: ${pagePath}` : null,
    `Source: ${input.source_type}`,
    "Observable traffic only — not private search query access.",
  ].filter(Boolean)

  return {
    ...input,
    keyword: hasKeyword ? normalized_keyword : "",
    normalized_keyword,
    intent_topic,
    intent_category,
    intent_stage,
    intent_strength,
    intent_score: 0,
    matched_query_pattern: input.matched_query_pattern ?? null,
    evidence: evidenceParts.join(" · "),
    source_attribution: [],
    metadata: {},
  }
}

export function assertSearchIntentTaxonomy(): {
  categories: readonly string[]
  stages: readonly string[]
} {
  return { categories: GROWTH_SEARCH_INTENT_CATEGORIES, stages: GROWTH_SEARCH_INTENT_STAGES }
}
