/**
 * GE-AIOS-25C-1 — Pure CI promotion candidate builder from Company Evidence v22 (client-safe).
 */

import type {
  GrowthCompanyIntelligenceDraftFinding,
  GrowthCompanyIntelligenceEvidenceDraft,
} from "@/lib/growth/company-intelligence/company-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"

export const GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER =
  "ge-aios-25c-1-company-evidence-ci-promotion-v1" as const

export const COMPANY_EVIDENCE_CI_PROMOTION_MIN_CONFIDENCE = Math.max(
  GROWTH_COMPANY_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE,
  0.85,
)

export type CompanyEvidencePromotionCandidate = {
  draft: GrowthCompanyIntelligenceDraftFinding
  accepted: boolean
  rejectReason: string | null
}

export type CompanyEvidencePromotionResult = {
  qaMarker: typeof GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER
  companyId: string | null
  attempted: number
  promoted: number
  rejected: Array<{ key: string; reason: string }>
  skippedReason: string | null
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 120)
}

function hashRef(parts: string[]): string {
  let hash = 0
  const text = parts.join("|")
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export function buildCompanyEvidencePromotionCandidates(
  bundle: GrowthCompanyEvidenceBundle | null,
): CompanyEvidencePromotionCandidate[] {
  if (!bundle) return []
  const candidates: CompanyEvidencePromotionCandidate[] = []
  const observedAt = bundle.collectedAt

  function consider(input: {
    category: GrowthCompanyIntelligenceDraftFinding["intelligence_category"]
    key: string
    valueText: string
    confidence: number
    sourceUrl: string | null
    evidenceText: string
  }) {
    const normalized = normalizeKey(`${input.category}:${input.key}:${input.valueText}`)
    const evidence: GrowthCompanyIntelligenceEvidenceDraft[] = [
      {
        evidence_type: "website_page",
        source_url: input.sourceUrl,
        evidence_text: input.evidenceText.slice(0, 500),
        extraction_method: "company_evidence_v22",
        confidence: input.confidence,
        metadata: {
          qa_marker: GROWTH_COMPANY_EVIDENCE_CI_PROMOTION_QA_MARKER,
          observed_at: observedAt,
          proposed_value_text: input.valueText,
        },
      },
    ]

    const draft: GrowthCompanyIntelligenceDraftFinding = {
      finding_ref: `v22-${hashRef([bundle.cacheKey ?? bundle.websiteUrl ?? "x", normalized])}`,
      intelligence_category: input.category,
      intelligence_key: input.key,
      normalized_intelligence_key: normalized,
      value_text: input.valueText,
      value_json: { source: "companyEvidence_v22" },
      source: "website",
      confidence: input.confidence,
      confidence_tier: input.confidence >= 0.9 ? "direct_evidence" : "provider_evidence",
      provider_name: "company_evidence_v22",
      discovery_source: "prospect_research",
      evidence,
    }

    if (input.confidence < COMPANY_EVIDENCE_CI_PROMOTION_MIN_CONFIDENCE) {
      candidates.push({
        draft,
        accepted: false,
        rejectReason: `confidence_below_threshold:${input.confidence}`,
      })
      return
    }

    if (/^no\b|not found|missing|unknown/i.test(input.valueText)) {
      candidates.push({
        draft,
        accepted: false,
        rejectReason: "negative_or_absence_claim",
      })
      return
    }

    candidates.push({ draft, accepted: true, rejectReason: null })
  }

  const industries = bundle.profile.industriesServed
  if (industries?.values[0]) {
    consider({
      category: "industry",
      key: "primary_industry",
      valueText: industries.values[0],
      confidence: industries.confidence,
      sourceUrl: industries.sourceUrls[0] ?? bundle.websiteUrl,
      evidenceText: industries.evidence[0] ?? industries.values[0],
    })
  }

  if (bundle.profile.companyDescription) {
    consider({
      category: "description",
      key: "website_description",
      valueText: bundle.profile.companyDescription.value.slice(0, 400),
      confidence: bundle.profile.companyDescription.confidence,
      sourceUrl: bundle.profile.companyDescription.sourceUrl ?? bundle.websiteUrl,
      evidenceText: bundle.profile.companyDescription.evidence,
    })
  }

  for (const service of bundle.profile.primaryServices?.values.slice(0, 5) ?? []) {
    consider({
      category: "website_signal",
      key: `service:${normalizeKey(service)}`,
      valueText: service,
      confidence: bundle.profile.primaryServices?.confidence ?? 0.8,
      sourceUrl: bundle.profile.primaryServices?.sourceUrls[0] ?? bundle.websiteUrl,
      evidenceText: service,
    })
  }

  for (const market of bundle.profile.geographicMarkets?.values.slice(0, 5) ?? []) {
    consider({
      category: "location",
      key: `market:${normalizeKey(market)}`,
      valueText: market,
      confidence: bundle.profile.geographicMarkets?.confidence ?? 0.8,
      sourceUrl: bundle.profile.geographicMarkets?.sourceUrls[0] ?? bundle.websiteUrl,
      evidenceText: market,
    })
  }

  for (const cert of (bundle.profile.differentiators?.values ?? [])
    .filter((v) => /certif|iso|accredited/i.test(v))
    .slice(0, 3)) {
    consider({
      category: "website_signal",
      key: `certification:${normalizeKey(cert)}`,
      valueText: cert,
      confidence: bundle.profile.differentiators?.confidence ?? 0.8,
      sourceUrl: bundle.profile.differentiators?.sourceUrls[0] ?? bundle.websiteUrl,
      evidenceText: cert,
    })
  }

  for (const customer of bundle.profile.targetCustomers?.values.slice(0, 3) ?? []) {
    consider({
      category: "website_signal",
      key: `customer_type:${normalizeKey(customer)}`,
      valueText: customer,
      confidence: bundle.profile.targetCustomers?.confidence ?? 0.8,
      sourceUrl: bundle.profile.targetCustomers?.sourceUrls[0] ?? bundle.websiteUrl,
      evidenceText: customer,
    })
  }

  for (const hire of bundle.profile.hiringSignals?.values.slice(0, 2) ?? []) {
    consider({
      category: "hiring",
      key: `hiring:${normalizeKey(hire)}`,
      valueText: hire,
      confidence: bundle.profile.hiringSignals?.confidence ?? 0.8,
      sourceUrl: bundle.profile.hiringSignals?.sourceUrls[0] ?? bundle.websiteUrl,
      evidenceText: hire,
    })
  }

  return candidates
}
