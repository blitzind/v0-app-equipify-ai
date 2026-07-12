/** GE-AIOS-8A-1 / 25C-1 — Business-focused website page classification (client-safe). */

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
  "faq",
  "help",
  "resources",
  "blog",
  "news",
  "press",
  "careers",
  "leadership",
  "financing",
  "warranty",
  "support",
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
  "/markets",
  "/solutions",
  "/solution",
  "/capabilities",
  "/customers",
  "/clients",
  "/case-studies",
  "/case-study",
  "/customer-stories",
  "/success-stories",
  "/testimonials",
  "/reviews",
  "/integrations",
  "/partners",
  "/certifications",
  "/certified",
  "/locations",
  "/location",
  "/service-areas",
  "/service-area",
  "/areas-we-serve",
  "/contact",
  "/contact-us",
  "/faq",
  "/faqs",
  "/help",
  "/support",
  "/resources",
  "/blog",
  "/news",
  "/press",
  "/press-releases",
  "/careers",
  "/jobs",
  "/join-us",
  "/leadership",
  "/team",
  "/our-team",
  "/financing",
  "/financing-options",
  "/warranty",
  "/warranties",
] as const

/** Higher research value → lower priority number (sorted ascending). */
export function businessPagePriority(pageType: EvidenceEngineBusinessPageType): number {
  const order: EvidenceEngineBusinessPageType[] = [
    "homepage",
    "about",
    "services",
    "products",
    "industries",
    "solutions",
    "pricing",
    "plans",
    "locations",
    "case_studies",
    "testimonials",
    "customers",
    "careers",
    "faq",
    "financing",
    "warranty",
    "support",
    "help",
    "resources",
    "leadership",
    "certifications",
    "integrations",
    "contact",
    "press",
    "news",
    "blog",
    "generic",
  ]
  const index = order.indexOf(pageType)
  return index >= 0 ? index : order.length
}

export function classifyBusinessWebsitePageType(url: string): EvidenceEngineBusinessPageType {
  const lower = url.toLowerCase()
  try {
    const path = new URL(url).pathname.replace(/\/$/, "") || "/"
    if (path === "/") return "homepage"
  } catch {
    if (lower.endsWith("/") || /\/index\.html?$/.test(lower)) return "homepage"
  }
  if (/\/(faq|faqs)\b/.test(lower)) return "faq"
  if (/\/(help-center|help)\b/.test(lower)) return "help"
  if (/\/(support)\b/.test(lower)) return "support"
  if (/\/(resources?)\b/.test(lower)) return "resources"
  if (/\/(careers?|jobs?|join-us|job-openings)\b/.test(lower)) return "careers"
  if (/\/(leadership|our-team|meet-the-team|management-team)\b/.test(lower)) return "leadership"
  if (/\/(financ(e|ing)|payment-plans)\b/.test(lower)) return "financing"
  if (/\/(warrant(y|ies))\b/.test(lower)) return "warranty"
  if (/\/(press-releases?|press)\b/.test(lower)) return "press"
  if (/\/(news|newsroom)\b/.test(lower)) return "news"
  if (/\/(blog)\b/.test(lower)) return "blog"
  if (/\/(pricing|price)/.test(lower)) return "pricing"
  if (/\/plans?\b/.test(lower)) return "plans"
  if (/\/(products?)\b/.test(lower)) return "products"
  if (/\/(services?)\b/.test(lower)) return "services"
  if (/\/(industries?|markets?)\b/.test(lower)) return "industries"
  if (/\/(solutions?|capabilities)\b/.test(lower)) return "solutions"
  if (/\/(customers?|clients?)\b/.test(lower)) return "customers"
  if (/\/(case-stud(?:y|ies)|customer-stories|success-stories)\b/.test(lower)) return "case_studies"
  if (/\/(testimonials?|reviews?)\b/.test(lower)) return "testimonials"
  if (/\/(integrations?|partners?)\b/.test(lower)) return "integrations"
  if (/\/(certifications?|certified)\b/.test(lower)) return "certifications"
  if (/\/(locations?|service-areas?|areas-we-serve)\b/.test(lower)) return "locations"
  if (/\/contact/.test(lower)) return "contact"
  if (/\/(about|who-we-are|company)\b/.test(lower)) return "about"
  if (/\/(team|staff|people)\b/.test(lower)) return "leadership"
  return "generic"
}

export function researchValueReasonForPageType(pageType: EvidenceEngineBusinessPageType): string {
  switch (pageType) {
    case "homepage":
      return "homepage_identity"
    case "about":
      return "company_narrative"
    case "services":
    case "products":
    case "solutions":
      return "offerings"
    case "industries":
      return "markets_served"
    case "pricing":
    case "plans":
    case "financing":
      return "commercial_terms"
    case "case_studies":
    case "testimonials":
    case "customers":
      return "proof_social"
    case "careers":
      return "hiring_signal"
    case "faq":
    case "help":
    case "support":
    case "warranty":
      return "buyer_journey"
    case "locations":
      return "geographic_coverage"
    case "blog":
    case "news":
    case "press":
      return "public_updates"
    case "leadership":
      return "org_structure"
    case "resources":
      return "educational_content"
    default:
      return "supporting_page"
  }
}
