/** GE-AIOS-8A-1 — Business-focused website page classification (client-safe). */

export const EVIDENCE_ENGINE_BUSINESS_PAGE_TYPES = [
  "homepage",
  "about",
  "services",
  "products",
  "pricing",
  "plans",
  "industries",
  "solutions",
  "customers",
  "case_studies",
  "testimonials",
  "integrations",
  "certifications",
  "locations",
  "contact",
  "generic",
] as const

export type EvidenceEngineBusinessPageType = (typeof EVIDENCE_ENGINE_BUSINESS_PAGE_TYPES)[number]

export const EVIDENCE_ENGINE_BUSINESS_SEED_PATHS = [
  "/",
  "/about",
  "/about-us",
  "/who-we-are",
  "/company",
  "/services",
  "/service",
  "/products",
  "/product",
  "/pricing",
  "/plans",
  "/industries",
  "/industry",
  "/solutions",
  "/solution",
  "/customers",
  "/clients",
  "/case-studies",
  "/case-study",
  "/customer-stories",
  "/testimonials",
  "/reviews",
  "/integrations",
  "/partners",
  "/certifications",
  "/certified",
  "/locations",
  "/location",
  "/contact",
  "/contact-us",
] as const

export function classifyBusinessWebsitePageType(url: string): EvidenceEngineBusinessPageType {
  const lower = url.toLowerCase()
  if (lower.endsWith("/") || /\/index\.html?$/.test(lower)) return "homepage"
  if (/\/(pricing|price)/.test(lower)) return "pricing"
  if (/\/plans?\b/.test(lower)) return "plans"
  if (/\/(products?)\b/.test(lower)) return "products"
  if (/\/(services?)\b/.test(lower)) return "services"
  if (/\/(industries?)\b/.test(lower)) return "industries"
  if (/\/(solutions?)\b/.test(lower)) return "solutions"
  if (/\/(customers?|clients?)\b/.test(lower)) return "customers"
  if (/\/(case-stud(?:y|ies)|customer-stories)\b/.test(lower)) return "case_studies"
  if (/\/(testimonials?|reviews?)\b/.test(lower)) return "testimonials"
  if (/\/(integrations?|partners?)\b/.test(lower)) return "integrations"
  if (/\/(certifications?|certified)\b/.test(lower)) return "certifications"
  if (/\/(locations?|service-areas?|areas-we-serve)\b/.test(lower)) return "locations"
  if (/\/contact/.test(lower)) return "contact"
  if (/\/(about|who-we-are|company)\b/.test(lower)) return "about"
  return "generic"
}

export function businessPagePriority(pageType: EvidenceEngineBusinessPageType): number {
  const order: EvidenceEngineBusinessPageType[] = [
    "homepage",
    "about",
    "services",
    "products",
    "pricing",
    "plans",
    "industries",
    "solutions",
    "customers",
    "case_studies",
    "testimonials",
    "integrations",
    "certifications",
    "locations",
    "contact",
    "generic",
  ]
  const index = order.indexOf(pageType)
  return index >= 0 ? index : order.length
}
