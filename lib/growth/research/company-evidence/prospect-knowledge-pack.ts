/** GE-AIOS-25C-1 — Deterministic Prospect Knowledge Pack (client-safe). No LLM. */

import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthResearchSignals } from "@/lib/growth/research/research-types"

export const GROWTH_PROSPECT_KNOWLEDGE_PACK_QA_MARKER =
  "ge-aios-25c-1-prospect-knowledge-pack-v1" as const

export type ProspectKnowledgeConclusionKind = "observed_fact" | "derived_inference" | "unknown"

export type ProspectKnowledgeConclusion = {
  id: string
  field: string
  kind: ProspectKnowledgeConclusionKind
  value: string | boolean | string[] | null
  confidence: number | null
  sourceUrls: string[]
  evidenceExcerpt: string | null
  evidenceId: string | null
  extractionMethod: string
  lastObservedAt: string
}

export type ProspectKnowledgePack = {
  qaMarker: typeof GROWTH_PROSPECT_KNOWLEDGE_PACK_QA_MARKER
  generatedAt: string
  websiteUrl: string | null
  observed_facts: ProspectKnowledgeConclusion[]
  derived_inferences: ProspectKnowledgeConclusion[]
  unknowns: ProspectKnowledgeConclusion[]
}

const SERVICE_INDICATOR_PATTERNS: Array<{ field: string; pattern: RegExp; label: string }> = [
  { field: "field_service_indicator", pattern: /\bfield\s*service\b|\bon[- ]?site\b|\bin[- ]?field\b/i, label: "Field service language observed" },
  { field: "maintenance_indicator", pattern: /\bmaintenance\b|\bpm\b|\bpreventive\b/i, label: "Maintenance language observed" },
  { field: "installation_indicator", pattern: /\binstall(ation|ing)?\b/i, label: "Installation language observed" },
  { field: "repair_indicator", pattern: /\brepair\b|\bfix\b|\bservice\s+call\b/i, label: "Repair language observed" },
  { field: "inspection_indicator", pattern: /\binspection\b|\binspect\b/i, label: "Inspection language observed" },
  { field: "calibration_indicator", pattern: /\bcalibrat(e|ion)\b/i, label: "Calibration language observed" },
  { field: "emergency_service_indicator", pattern: /\bemergency\b|\b24\/7\b|\bafter[- ]?hours\b/i, label: "Emergency service language observed" },
  { field: "recurring_service_indicator", pattern: /\bcontract\b|\bsubscription\b|\brecurring\b|\bannual\s+service\b/i, label: "Recurring service language observed" },
]

function pushUnknown(
  unknowns: ProspectKnowledgeConclusion[],
  field: string,
  message: string,
  observedAt: string,
): void {
  unknowns.push({
    id: `unknown:${field}`,
    field,
    kind: "unknown",
    value: null,
    confidence: null,
    sourceUrls: [],
    evidenceExcerpt: message,
    evidenceId: null,
    extractionMethod: "absence_not_negation",
    lastObservedAt: observedAt,
  })
}

function textCorpus(bundle: GrowthCompanyEvidenceBundle): string {
  const parts: string[] = []
  const p = bundle.profile
  if (p.companyDescription?.value) parts.push(p.companyDescription.value)
  for (const list of [
    p.primaryServices,
    p.primaryProducts,
    p.industriesServed,
    p.differentiators,
    p.hiringSignals,
  ]) {
    if (list?.values.length) parts.push(...list.values)
    if (list?.evidence.length) parts.push(...list.evidence)
  }
  return parts.join("\n")
}

export function buildProspectKnowledgePack(input: {
  bundle: GrowthCompanyEvidenceBundle | null
  signals?: GrowthResearchSignals | null
  observedAt?: string
}): ProspectKnowledgePack {
  const observedAt = input.observedAt ?? new Date().toISOString()
  const facts: ProspectKnowledgeConclusion[] = []
  const inferences: ProspectKnowledgeConclusion[] = []
  const unknowns: ProspectKnowledgeConclusion[] = []
  const bundle = input.bundle

  if (!bundle) {
    pushUnknown(unknowns, "company_description", "No Company Evidence v22 bundle available.", observedAt)
    return {
      qaMarker: GROWTH_PROSPECT_KNOWLEDGE_PACK_QA_MARKER,
      generatedAt: observedAt,
      websiteUrl: null,
      observed_facts: facts,
      derived_inferences: inferences,
      unknowns,
    }
  }

  const profile = bundle.profile

  function addListFact(field: string, list: typeof profile.primaryServices, method: string) {
    if (!list?.values.length) return
    facts.push({
      id: `fact:${field}`,
      field,
      kind: "observed_fact",
      value: list.values.slice(0, 12),
      confidence: list.confidence,
      sourceUrls: list.sourceUrls.slice(0, 8),
      evidenceExcerpt: list.evidence[0] ?? null,
      evidenceId: null,
      extractionMethod: method,
      lastObservedAt: observedAt,
    })
  }

  if (profile.companyDescription) {
    facts.push({
      id: "fact:company_description",
      field: "company_description",
      kind: "observed_fact",
      value: profile.companyDescription.value,
      confidence: profile.companyDescription.confidence,
      sourceUrls: profile.companyDescription.sourceUrl
        ? [profile.companyDescription.sourceUrl]
        : [],
      evidenceExcerpt: profile.companyDescription.evidence,
      evidenceId: null,
      extractionMethod: "website_description",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(unknowns, "company_description", "No reliable company description found on crawled pages.", observedAt)
  }

  if (profile.businessModel) {
    facts.push({
      id: "fact:primary_business_model",
      field: "primary_business_model",
      kind: "observed_fact",
      value: profile.businessModel.value,
      confidence: profile.businessModel.confidence,
      sourceUrls: profile.businessModel.sourceUrl ? [profile.businessModel.sourceUrl] : [],
      evidenceExcerpt: profile.businessModel.evidence,
      evidenceId: null,
      extractionMethod: "business_model_field",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(unknowns, "primary_business_model", "Business model not confirmed by website evidence.", observedAt)
  }

  addListFact("products", profile.primaryProducts, "product_list_extraction")
  addListFact("services", profile.primaryServices, "service_list_extraction")
  addListFact("industries_served", profile.industriesServed, "industry_list_extraction")
  addListFact("customer_types", profile.targetCustomers, "customer_list_extraction")
  addListFact("geographic_coverage", profile.geographicMarkets, "geography_list_extraction")
  addListFact("differentiators", profile.differentiators, "differentiator_extraction")
  addListFact("hiring_signals", profile.hiringSignals, "careers_page_extraction")
  addListFact("technology_signals", profile.technologySignals, "technology_extraction")

  if (!profile.primaryProducts?.values.length) {
    pushUnknown(unknowns, "products", "No product listings confirmed on crawled pages.", observedAt)
  }
  if (!profile.primaryServices?.values.length) {
    pushUnknown(unknowns, "services", "No service listings confirmed on crawled pages.", observedAt)
  }
  if (!profile.industriesServed?.values.length) {
    pushUnknown(unknowns, "industries_served", "Industries served not confirmed.", observedAt)
  }
  if (!profile.geographicMarkets?.values.length) {
    pushUnknown(unknowns, "geographic_coverage", "Geographic coverage not confirmed.", observedAt)
  }

  const coverage = bundle.crawlState.websiteCoverage ?? []
  const pageTypes = (bundle.crawlState.pageSelections ?? []).map((p) => p.pageType)

  const presenceChecks: Array<{ field: string; present: boolean; label: string }> = [
    { field: "case_study_presence", present: pageTypes.includes("case_studies") || coverage.some((u) => /case-stud/i.test(u)), label: "Case study page observed" },
    { field: "testimonial_presence", present: pageTypes.includes("testimonials") || coverage.some((u) => /testimonial|reviews/i.test(u)), label: "Testimonial/reviews page observed" },
    { field: "careers_hiring_presence", present: pageTypes.includes("careers") || Boolean(profile.hiringSignals?.values.length), label: "Careers/hiring page observed" },
    { field: "pricing_visibility", present: pageTypes.includes("pricing") || pageTypes.includes("plans"), label: "Pricing/plans page observed" },
    { field: "faq_presence", present: pageTypes.includes("faq"), label: "FAQ page observed" },
    { field: "blog_or_news_presence", present: pageTypes.includes("blog") || pageTypes.includes("news") || pageTypes.includes("press"), label: "Blog/news/press page observed" },
  ]

  for (const check of presenceChecks) {
    if (check.present) {
      facts.push({
        id: `fact:${check.field}`,
        field: check.field,
        kind: "observed_fact",
        value: true,
        confidence: 0.85,
        sourceUrls: coverage.filter((u) => {
          if (check.field.includes("case")) return /case-stud/i.test(u)
          if (check.field.includes("testimonial")) return /testimonial|reviews/i.test(u)
          if (check.field.includes("careers")) return /career|job/i.test(u)
          if (check.field.includes("pricing")) return /pric|plan/i.test(u)
          if (check.field.includes("faq")) return /faq/i.test(u)
          return /blog|news|press/i.test(u)
        }).slice(0, 3),
        evidenceExcerpt: check.label,
        evidenceId: null,
        extractionMethod: "page_type_presence",
        lastObservedAt: observedAt,
      })
    } else {
      // Missing page ≠ negative capability claim
      pushUnknown(unknowns, check.field, `No crawled page confirmed for ${check.field.replace(/_/g, " ")}.`, observedAt)
    }
  }

  const signals = input.signals
  if (signals?.hasCustomerPortal === true) {
    facts.push({
      id: "fact:customer_portal_indicator",
      field: "customer_portal_indicator",
      kind: "observed_fact",
      value: true,
      confidence: 0.8,
      sourceUrls: bundle.websiteUrl ? [bundle.websiteUrl] : [],
      evidenceExcerpt: "Customer portal signal detected on website.",
      evidenceId: null,
      extractionMethod: "website_feature_flag",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(
      unknowns,
      "customer_portal_indicator",
      "No reliable evidence confirms a customer portal. Absence is not a negative claim.",
      observedAt,
    )
  }

  if (signals?.hasOnlineBooking === true) {
    facts.push({
      id: "fact:online_scheduling_indicator",
      field: "online_scheduling_indicator",
      kind: "observed_fact",
      value: true,
      confidence: 0.8,
      sourceUrls: bundle.websiteUrl ? [bundle.websiteUrl] : [],
      evidenceExcerpt: "Online booking/scheduling signal detected.",
      evidenceId: null,
      extractionMethod: "website_feature_flag",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(
      unknowns,
      "online_scheduling_indicator",
      "No reliable evidence confirms online scheduling.",
      observedAt,
    )
  }

  if (signals?.hasFinancing === true) {
    facts.push({
      id: "fact:financing_indicator",
      field: "financing_indicator",
      kind: "observed_fact",
      value: true,
      confidence: 0.78,
      sourceUrls: bundle.websiteUrl ? [bundle.websiteUrl] : [],
      evidenceExcerpt: "Financing language detected on website.",
      evidenceId: null,
      extractionMethod: "website_feature_flag",
      lastObservedAt: observedAt,
    })
  } else if (pageTypes.includes("financing")) {
    facts.push({
      id: "fact:financing_indicator",
      field: "financing_indicator",
      kind: "observed_fact",
      value: true,
      confidence: 0.82,
      sourceUrls: coverage.filter((u) => /financ/i.test(u)).slice(0, 2),
      evidenceExcerpt: "Financing page observed.",
      evidenceId: null,
      extractionMethod: "page_type_presence",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(unknowns, "financing_indicator", "No financing evidence confirmed.", observedAt)
  }

  const corpus = textCorpus(bundle)
  for (const indicator of SERVICE_INDICATOR_PATTERNS) {
    if (indicator.pattern.test(corpus)) {
      inferences.push({
        id: `inference:${indicator.field}`,
        field: indicator.field,
        kind: "derived_inference",
        value: true,
        confidence: 0.62,
        sourceUrls: profile.primaryServices?.sourceUrls?.slice(0, 3) ??
          (bundle.websiteUrl ? [bundle.websiteUrl] : []),
        evidenceExcerpt: indicator.label,
        evidenceId: null,
        extractionMethod: "keyword_inference_from_observed_text",
        lastObservedAt: observedAt,
      })
    } else {
      pushUnknown(unknowns, indicator.field, `No textual evidence for ${indicator.field.replace(/_/g, " ")}.`, observedAt)
    }
  }

  // Equipment categories: derive only from explicit service/product strings containing equipment nouns
  const equipmentValues = [
    ...(profile.primaryServices?.values ?? []),
    ...(profile.primaryProducts?.values ?? []),
  ].filter((v) => /\b(equipment|mri|ct|ultrasound|x[- ]?ray|device|asset|fleet|hvac|generator)\b/i.test(v))

  if (equipmentValues.length > 0) {
    inferences.push({
      id: "inference:equipment_or_asset_categories",
      field: "equipment_or_asset_categories",
      kind: "derived_inference",
      value: equipmentValues.slice(0, 8),
      confidence: 0.68,
      sourceUrls: [
        ...(profile.primaryServices?.sourceUrls ?? []),
        ...(profile.primaryProducts?.sourceUrls ?? []),
      ].slice(0, 6),
      evidenceExcerpt: equipmentValues[0] ?? null,
      evidenceId: null,
      extractionMethod: "keyword_inference_from_offerings",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(
      unknowns,
      "equipment_or_asset_categories",
      "No equipment/asset categories confirmed from offerings text.",
      observedAt,
    )
  }

  // Mission / value proposition: only when description looks like mission language
  if (profile.companyDescription?.value && /\b(mission|we help|we enable|dedicated to|committed to)\b/i.test(profile.companyDescription.value)) {
    facts.push({
      id: "fact:mission_or_value_proposition_language",
      field: "mission_or_value_proposition_language",
      kind: "observed_fact",
      value: profile.companyDescription.value,
      confidence: Math.min(profile.companyDescription.confidence, 0.8),
      sourceUrls: profile.companyDescription.sourceUrl ? [profile.companyDescription.sourceUrl] : [],
      evidenceExcerpt: profile.companyDescription.evidence,
      evidenceId: null,
      extractionMethod: "mission_language_on_page",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(
      unknowns,
      "mission_or_value_proposition_language",
      "No explicit mission/value proposition language found.",
      observedAt,
    )
  }

  // CTA / buying journey cues from contact/pricing/faq presence
  const journey: string[] = []
  if (pageTypes.includes("pricing") || pageTypes.includes("plans")) journey.push("pricing_review")
  if (pageTypes.includes("faq") || pageTypes.includes("support")) journey.push("self_serve_questions")
  if (pageTypes.includes("contact")) journey.push("contact_cta")
  if (pageTypes.includes("case_studies")) journey.push("social_proof")
  if (journey.length > 0) {
    inferences.push({
      id: "inference:cta_and_buying_journey",
      field: "cta_and_buying_journey",
      kind: "derived_inference",
      value: journey,
      confidence: 0.6,
      sourceUrls: coverage.slice(0, 5),
      evidenceExcerpt: `Observed journey cues: ${journey.join(", ")}`,
      evidenceId: null,
      extractionMethod: "page_type_journey_inference",
      lastObservedAt: observedAt,
    })
  } else {
    pushUnknown(unknowns, "cta_and_buying_journey", "Buying journey cues not confirmed from page types.", observedAt)
  }

  // Risks = missing high-value evidence only (not invented competitors/revenue/headcount/software)
  const risks: string[] = []
  for (const missing of bundle.crawlState.missingInformation ?? []) {
    risks.push(missing)
  }
  if (risks.length > 0) {
    inferences.push({
      id: "inference:detected_prospect_risks_or_missing_evidence",
      field: "detected_prospect_risks_or_missing_evidence",
      kind: "derived_inference",
      value: risks.slice(0, 8),
      confidence: 0.7,
      sourceUrls: [],
      evidenceExcerpt: "Derived from missing evidence checklist — not negative capability claims.",
      evidenceId: null,
      extractionMethod: "missing_evidence_checklist",
      lastObservedAt: observedAt,
    })
  }

  pushUnknown(
    unknowns,
    "competitors",
    "Competitors are not inferred from website crawl in this pack.",
    observedAt,
  )
  pushUnknown(
    unknowns,
    "revenue",
    "Revenue is not inferred without explicit evidence.",
    observedAt,
  )
  pushUnknown(
    unknowns,
    "employee_count",
    "Employee count is not inferred without explicit evidence.",
    observedAt,
  )
  pushUnknown(
    unknowns,
    "fsm_software_usage",
    "No reliable evidence confirms field-service management software usage.",
    observedAt,
  )

  return {
    qaMarker: GROWTH_PROSPECT_KNOWLEDGE_PACK_QA_MARKER,
    generatedAt: observedAt,
    websiteUrl: bundle.websiteUrl,
    observed_facts: facts,
    derived_inferences: inferences,
    unknowns,
  }
}
