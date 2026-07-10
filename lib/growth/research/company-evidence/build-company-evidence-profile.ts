/** GE-AIOS-22 — Map website raw evidence items to structured company profile (client-safe). */

import type { EvidenceProviderRawItem } from "@/lib/growth/evidence-engine/evidence-engine-types"
import type {
  GrowthCompanyEvidenceField,
  GrowthCompanyEvidenceListField,
  GrowthCompanyEvidenceProfile,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

const PRODUCT_FACT_KEYS = new Set([
  "company.products",
  "company.pricing_plans",
  "company.testimonials",
  "company.case_studies",
])

const SERVICE_FACT_KEYS = new Set([
  "company.services",
  "company.solutions",
  "company.industries",
  "company.markets",
  "company.manufacturing",
])

const INDUSTRY_FACT_KEYS = new Set(["company.industries_served", "company.industries"])

const MARKET_FACT_KEYS = new Set(["company.markets", "company.geography", "company.service_areas"])

const CUSTOMER_FACT_KEYS = new Set(["terminology.buyer", "terminology.customer", "company.ideal_customers"])

const HIRING_FACT_KEYS = new Set(["company.careers", "company.hiring"])

const TECH_FACT_KEYS = new Set(["company.technology", "company.tech_stack"])

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }
  return result
}

function pushListItem(
  bucket: { values: string[]; evidence: string[]; confidences: number[]; sourceUrls: string[] },
  item: EvidenceProviderRawItem,
): void {
  const value = item.value_text?.trim()
  if (!value) return
  bucket.values.push(value)
  bucket.evidence.push(item.raw_excerpt?.trim() || value)
  bucket.confidences.push(item.evidence_confidence ?? 0.65)
  bucket.sourceUrls.push(item.source_url ?? "")
}

function finalizeListField(
  bucket: { values: string[]; evidence: string[]; confidences: number[]; sourceUrls: string[] } | null,
): GrowthCompanyEvidenceListField | null {
  if (!bucket || bucket.values.length === 0) return null
  const values = dedupeValues(bucket.values)
  const avgConfidence =
    bucket.confidences.reduce((sum, value) => sum + value, 0) / Math.max(bucket.confidences.length, 1)
  return {
    values,
    evidence: bucket.evidence.slice(0, values.length),
    confidence: Math.min(1, avgConfidence),
    sourceUrls: [...new Set(bucket.sourceUrls.filter(Boolean))],
  }
}

function pickBestField(items: EvidenceProviderRawItem[]): GrowthCompanyEvidenceField | null {
  if (items.length === 0) return null
  const sorted = [...items].sort(
    (a, b) => (b.evidence_confidence ?? 0) - (a.evidence_confidence ?? 0),
  )
  const best = sorted[0]
  const value = best.value_text?.trim()
  if (!value) return null
  return {
    value,
    evidence: best.raw_excerpt?.trim() || value,
    confidence: best.evidence_confidence ?? 0.65,
    sourceUrl: best.source_url,
  }
}

export function buildCompanyEvidenceProfileFromRawItems(
  rawItems: EvidenceProviderRawItem[],
): GrowthCompanyEvidenceProfile {
  const descriptionItems: EvidenceProviderRawItem[] = []
  const businessModelItems: EvidenceProviderRawItem[] = []
  const sizeItems: EvidenceProviderRawItem[] = []
  const differentiatorItems: EvidenceProviderRawItem[] = []

  const industriesBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }
  const productsBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }
  const servicesBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }
  const customersBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }
  const marketsBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }
  const hiringBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }
  const techBucket = { values: [] as string[], evidence: [] as string[], confidences: [] as number[], sourceUrls: [] as string[] }

  for (const item of rawItems) {
    const factKey = item.fact_key

    if (factKey === "company.description" || factKey === "company.about") {
      descriptionItems.push(item)
      continue
    }

    if (factKey === "company.business_model") {
      businessModelItems.push(item)
      continue
    }

    if (factKey === "company.size" || factKey === "company.employee_count") {
      sizeItems.push(item)
      continue
    }

    if (factKey === "company.guarantees" || factKey === "company.differentiators") {
      differentiatorItems.push(item)
      continue
    }

    if (INDUSTRY_FACT_KEYS.has(factKey)) {
      pushListItem(industriesBucket, item)
      continue
    }

    if (PRODUCT_FACT_KEYS.has(factKey)) {
      pushListItem(productsBucket, item)
      continue
    }

    if (SERVICE_FACT_KEYS.has(factKey)) {
      pushListItem(servicesBucket, item)
      continue
    }

    if (CUSTOMER_FACT_KEYS.has(factKey)) {
      pushListItem(customersBucket, item)
      continue
    }

    if (MARKET_FACT_KEYS.has(factKey)) {
      pushListItem(marketsBucket, item)
      continue
    }

    if (HIRING_FACT_KEYS.has(factKey)) {
      pushListItem(hiringBucket, item)
      continue
    }

    if (TECH_FACT_KEYS.has(factKey)) {
      pushListItem(techBucket, item)
      continue
    }

    if (item.category === "ideal_customers") {
      pushListItem(customersBucket, item)
    } else if (item.category === "company") {
      pushListItem(servicesBucket, item)
    }
  }

  return {
    companyDescription: pickBestField(descriptionItems),
    industriesServed: finalizeListField(industriesBucket),
    primaryProducts: finalizeListField(productsBucket),
    primaryServices: finalizeListField(servicesBucket),
    targetCustomers: finalizeListField(customersBucket),
    businessModel: pickBestField(businessModelItems),
    geographicMarkets: finalizeListField(marketsBucket),
    estimatedCompanySize: pickBestField(sizeItems),
    differentiators: finalizeListField(differentiatorItems),
    technologySignals: finalizeListField(techBucket),
    hiringSignals: finalizeListField(hiringBucket),
  }
}

export function collectCompanyEvidenceSourceUrls(profile: GrowthCompanyEvidenceProfile): string[] {
  const urls = new Set<string>()

  function addField(field: GrowthCompanyEvidenceField | null): void {
    if (field?.sourceUrl) urls.add(field.sourceUrl)
  }

  function addListField(field: GrowthCompanyEvidenceListField | null): void {
    for (const url of field?.sourceUrls ?? []) {
      if (url) urls.add(url)
    }
  }

  addField(profile.companyDescription)
  addField(profile.businessModel)
  addField(profile.estimatedCompanySize)
  addListField(profile.industriesServed)
  addListField(profile.primaryProducts)
  addListField(profile.primaryServices)
  addListField(profile.targetCustomers)
  addListField(profile.geographicMarkets)
  addListField(profile.differentiators)
  addListField(profile.technologySignals)
  addListField(profile.hiringSignals)

  return [...urls]
}
