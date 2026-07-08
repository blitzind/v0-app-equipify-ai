/** GE-AIOS-8A-1 — Deterministic website business evidence extraction (client-safe). */

import { stripHtmlTags } from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  extractMetaDescriptionFromHtml,
  extractSchemaOrgOrganizationsFromHtml,
} from "@/lib/growth/company-intelligence/company-intelligence-schema-org"
import type {
  EvidenceEngineBusinessPageType,
} from "@/lib/growth/evidence-engine/providers/website-business-page-classifier"
import type {
  EvidenceEngineDecisionTier,
  EvidenceEngineFactCategory,
  EvidenceProviderRawItem,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function htmlToPlainText(html: string): string {
  let text = html
  text = text.replace(/<br\s*\/?>/gi, "\n")
  text = text.replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, "\n")
  return stripHtmlTags(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim()
}

function extractPageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = match?.[1]?.replace(/\s+/g, " ").trim()
  return title || null
}

function extractListItems(plain: string, max = 8): string[] {
  const lines = plain
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length >= 3 && line.length <= 160)

  const unique: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(line)
    if (unique.length >= max) break
  }
  return unique
}

function extractHeadingSnippets(html: string, max = 6): string[] {
  const headings: string[] = []
  for (const match of html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
    const text = stripHtmlTags(match[1] ?? "").trim()
    if (text.length >= 3 && text.length <= 120) headings.push(text)
    if (headings.length >= max) break
  }
  return headings
}

function extractBlockquotes(html: string, max = 4): string[] {
  const quotes: string[] = []
  for (const match of html.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)) {
    const text = stripHtmlTags(match[1] ?? "").trim()
    if (text.length >= 20 && text.length <= 400) quotes.push(text)
    if (quotes.length >= max) break
  }
  return quotes
}

function pushRawItem(
  items: EvidenceProviderRawItem[],
  input: Omit<EvidenceProviderRawItem, "provider"> & { provider?: EvidenceProviderRawItem["provider"] },
): void {
  const value = input.value_text.trim()
  if (!value) return

  items.push({
    provider: input.provider ?? "website",
    ...input,
    value_text: value,
    metadata: {
      ...(input.metadata ?? {}),
      raw_item_id: createId(),
    },
  })
}

function categoryForPageType(pageType: EvidenceEngineBusinessPageType): EvidenceEngineFactCategory {
  switch (pageType) {
    case "industries":
    case "solutions":
    case "customers":
      return "ideal_customers"
    case "pricing":
    case "plans":
      return "sales_marketing"
    case "testimonials":
    case "case_studies":
      return "strategy"
    case "integrations":
    case "certifications":
      return "operations"
    case "locations":
    case "contact":
      return "support"
    default:
      return "company"
  }
}

function factKeyForPageType(pageType: EvidenceEngineBusinessPageType): string {
  switch (pageType) {
    case "homepage":
    case "about":
    case "generic":
      return "company.description"
    case "services":
      return "company.services"
    case "products":
      return "company.products"
    case "pricing":
    case "plans":
      return "company.pricing_plans"
    case "industries":
      return "company.industries_served"
    case "solutions":
      return "company.solutions"
    case "customers":
      return "company.customers"
    case "case_studies":
      return "company.case_studies"
    case "testimonials":
      return "company.testimonials"
    case "integrations":
      return "company.integrations"
    case "certifications":
      return "company.certifications"
    case "locations":
      return "company.geographic_markets"
    case "contact":
      return "company.support_channels"
    default:
      return "company.description"
  }
}

function tierForExtraction(structured: boolean): EvidenceEngineDecisionTier {
  return structured ? "structured_extraction" : "explicit_website"
}

export function extractBusinessEvidenceFromHtml(input: {
  html: string
  pageUrl: string
  pageType: EvidenceEngineBusinessPageType
}): EvidenceProviderRawItem[] {
  const items: EvidenceProviderRawItem[] = []
  const pageTitle = extractPageTitle(input.html)
  const plain = htmlToPlainText(input.html)
  const excerpt = plain.slice(0, 500)
  const category = categoryForPageType(input.pageType)
  const baseFactKey = factKeyForPageType(input.pageType)

  const metaDescription = extractMetaDescriptionFromHtml(input.html)
  if (metaDescription) {
    pushRawItem(items, {
      fact_key: "company.description",
      category: "company",
      value_text: metaDescription,
      decision_tier: "structured_extraction",
      evidence_type: "meta_tag",
      source_url: input.pageUrl,
      page_title: pageTitle,
      raw_excerpt: metaDescription,
      evidence_confidence: 0.82,
      extraction_confidence: 0.88,
      verification_confidence: 0.8,
      metadata: { page_type: input.pageType, extraction_method: "meta_description" },
    })
  }

  for (const org of extractSchemaOrgOrganizationsFromHtml(input.html)) {
    if (org.description) {
      pushRawItem(items, {
        fact_key: "company.description",
        category: "company",
        value_text: org.description,
        decision_tier: "structured_extraction",
        evidence_type: "schema_org",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: org.description.slice(0, 300),
        evidence_confidence: 0.9,
        extraction_confidence: 0.92,
        verification_confidence: 0.85,
        metadata: { page_type: input.pageType, extraction_method: "schema_org_description" },
      })
    }
    if (org.industry) {
      pushRawItem(items, {
        fact_key: "company.industries_served",
        category: "ideal_customers",
        value_text: org.industry,
        decision_tier: "structured_extraction",
        evidence_type: "schema_org",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: org.industry,
        evidence_confidence: 0.86,
        extraction_confidence: 0.9,
        verification_confidence: 0.82,
        metadata: { page_type: input.pageType, extraction_method: "schema_org_industry" },
      })
    }
  }

  if (input.pageType === "homepage" || input.pageType === "about" || input.pageType === "generic") {
    const paragraphs = plain
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length >= 40 && line.length <= 500)
    const description = paragraphs[0]
    if (description) {
      pushRawItem(items, {
        fact_key: baseFactKey,
        category,
        value_text: description,
        decision_tier: tierForExtraction(false),
        evidence_type: "website_page",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: description.slice(0, 300),
        evidence_confidence: 0.75,
        extraction_confidence: 0.7,
        verification_confidence: 0.72,
        metadata: { page_type: input.pageType, extraction_method: "homepage_paragraph" },
      })
    }
  }

  const listFactTypes: EvidenceEngineBusinessPageType[] = [
    "services",
    "products",
    "industries",
    "solutions",
    "customers",
    "integrations",
    "certifications",
    "locations",
  ]

  if (listFactTypes.includes(input.pageType)) {
    const listItems = extractListItems(plain)
    for (const item of listItems) {
      pushRawItem(items, {
        fact_key: baseFactKey,
        category,
        value_text: item,
        decision_tier: tierForExtraction(true),
        evidence_type: "website_structured",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: item,
        evidence_confidence: 0.78,
        extraction_confidence: 0.8,
        verification_confidence: 0.74,
        metadata: { page_type: input.pageType, extraction_method: "list_item" },
      })
    }

    for (const heading of extractHeadingSnippets(input.html)) {
      pushRawItem(items, {
        fact_key: baseFactKey,
        category,
        value_text: heading,
        decision_tier: tierForExtraction(true),
        evidence_type: "website_structured",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: heading,
        evidence_confidence: 0.72,
        extraction_confidence: 0.76,
        verification_confidence: 0.7,
        metadata: { page_type: input.pageType, extraction_method: "heading" },
      })
    }
  }

  if (input.pageType === "pricing" || input.pageType === "plans") {
    const priceMatches = plain.match(/\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|year|yr))?/gi) ?? []
    const planHeadings = extractHeadingSnippets(input.html, 8)
    for (const heading of planHeadings) {
      pushRawItem(items, {
        fact_key: "company.pricing_plans",
        category: "sales_marketing",
        value_text: heading,
        decision_tier: "structured_extraction",
        evidence_type: "website_structured",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: heading,
        evidence_confidence: 0.74,
        extraction_confidence: 0.78,
        verification_confidence: 0.7,
        metadata: { page_type: input.pageType, extraction_method: "plan_heading" },
      })
    }
    for (const price of [...new Set(priceMatches)].slice(0, 6)) {
      pushRawItem(items, {
        fact_key: "company.pricing_plans",
        category: "sales_marketing",
        value_text: price,
        decision_tier: "explicit_website",
        evidence_type: "pattern_match",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: price,
        evidence_confidence: 0.7,
        extraction_confidence: 0.72,
        verification_confidence: 0.68,
        metadata: { page_type: input.pageType, extraction_method: "price_pattern" },
      })
    }
  }

  if (input.pageType === "testimonials") {
    for (const quote of extractBlockquotes(input.html)) {
      pushRawItem(items, {
        fact_key: "company.testimonials",
        category: "strategy",
        value_text: quote,
        decision_tier: tierForExtraction(true),
        evidence_type: "website_structured",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: quote.slice(0, 300),
        evidence_confidence: 0.8,
        extraction_confidence: 0.82,
        verification_confidence: 0.76,
        metadata: { page_type: input.pageType, extraction_method: "blockquote" },
      })
    }
  }

  if (input.pageType === "case_studies") {
    for (const heading of extractHeadingSnippets(input.html, 10)) {
      pushRawItem(items, {
        fact_key: "company.case_studies",
        category: "strategy",
        value_text: heading,
        decision_tier: tierForExtraction(true),
        evidence_type: "website_structured",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: heading,
        evidence_confidence: 0.76,
        extraction_confidence: 0.8,
        verification_confidence: 0.72,
        metadata: { page_type: input.pageType, extraction_method: "case_study_heading" },
      })
    }
  }

  if (input.pageType === "contact") {
    const emails = [...new Set((plain.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []))].slice(0, 4)
    const phones = [...new Set((plain.match(/(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g) ?? []))].slice(0, 4)
    for (const email of emails) {
      pushRawItem(items, {
        fact_key: "company.support_channels",
        category: "support",
        value_text: email,
        decision_tier: "structured_extraction",
        evidence_type: "pattern_match",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: email,
        evidence_confidence: 0.84,
        extraction_confidence: 0.86,
        verification_confidence: 0.8,
        metadata: { page_type: input.pageType, extraction_method: "contact_email" },
      })
    }
    for (const phone of phones) {
      pushRawItem(items, {
        fact_key: "company.support_channels",
        category: "support",
        value_text: phone,
        decision_tier: "structured_extraction",
        evidence_type: "pattern_match",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: phone,
        evidence_confidence: 0.8,
        extraction_confidence: 0.82,
        verification_confidence: 0.78,
        metadata: { page_type: input.pageType, extraction_method: "contact_phone" },
      })
    }
    if (/live chat|chat with us|support portal|help center/i.test(plain)) {
      pushRawItem(items, {
        fact_key: "company.support_channels",
        category: "support",
        value_text: "Live chat or help center referenced on contact page",
        decision_tier: "explicit_website",
        evidence_type: "website_page",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: excerpt,
        evidence_confidence: 0.72,
        extraction_confidence: 0.7,
        verification_confidence: 0.68,
        metadata: { page_type: input.pageType, extraction_method: "support_channel_cue" },
      })
    }
  }

  const buyerTerms = plain.match(/\b(buyers?|procurement|operations managers?|facilities|fleet|owners?|decision makers?)\b/gi) ?? []
  for (const term of [...new Set(buyerTerms.map((t) => t.toLowerCase()))].slice(0, 5)) {
    pushRawItem(items, {
      fact_key: "terminology.buyer",
      category: "terminology",
      value_text: term,
      decision_tier: "explicit_website",
      evidence_type: "pattern_match",
      source_url: input.pageUrl,
      page_title: pageTitle,
      raw_excerpt: term,
      evidence_confidence: 0.65,
      extraction_confidence: 0.62,
      verification_confidence: 0.6,
      metadata: { page_type: input.pageType, extraction_method: "buyer_terminology" },
    })
  }

  const customerTerms = plain.match(/\b(customers?|clients?|users?|tenants?|members?)\b/gi) ?? []
  for (const term of [...new Set(customerTerms.map((t) => t.toLowerCase()))].slice(0, 5)) {
    pushRawItem(items, {
      fact_key: "terminology.customer",
      category: "terminology",
      value_text: term,
      decision_tier: "explicit_website",
      evidence_type: "pattern_match",
      source_url: input.pageUrl,
      page_title: pageTitle,
      raw_excerpt: term,
      evidence_confidence: 0.65,
      extraction_confidence: 0.62,
      verification_confidence: 0.6,
      metadata: { page_type: input.pageType, extraction_method: "customer_terminology" },
    })
  }

  const guaranteeMatch = plain.match(
    /\b(\d+[- ]?(?:day|hour)[- ]?(?:guarantee|warranty)|money[- ]back guarantee|satisfaction guarantee)\b/gi,
  )
  if (guaranteeMatch) {
    for (const guarantee of [...new Set(guaranteeMatch)].slice(0, 3)) {
      pushRawItem(items, {
        fact_key: "company.guarantees",
        category: "sales_marketing",
        value_text: guarantee,
        decision_tier: "explicit_website",
        evidence_type: "pattern_match",
        source_url: input.pageUrl,
        page_title: pageTitle,
        raw_excerpt: guarantee,
        evidence_confidence: 0.78,
        extraction_confidence: 0.75,
        verification_confidence: 0.72,
        metadata: { page_type: input.pageType, extraction_method: "guarantee_pattern" },
      })
    }
  }

  return items
}
