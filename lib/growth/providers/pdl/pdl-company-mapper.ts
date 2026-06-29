/** Map PDL company enrich records → company intelligence draft findings. Server-only. */

import "server-only"

import type { GrowthCompanyIntelligenceDraftFinding } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { baseConfidenceForCompanyIntelligenceSource } from "@/lib/growth/company-intelligence/company-intelligence-confidence"
import {
  buildNormalizedIntelligenceKey,
  normalizeIntelligenceValueText,
  normalizeTechnologyIntelligenceKey,
} from "@/lib/growth/company-intelligence/company-intelligence-normalize"
import type { PdlCompanyRecord } from "@/lib/growth/providers/pdl/pdl-types"

function draftFinding(
  partial: Omit<
    GrowthCompanyIntelligenceDraftFinding,
    "finding_ref" | "confidence_tier" | "normalized_intelligence_key"
  > & { finding_ref?: string },
): GrowthCompanyIntelligenceDraftFinding {
  const confidence = partial.confidence
  return {
    ...partial,
    finding_ref: partial.finding_ref ?? randomUUID(),
    normalized_intelligence_key: buildNormalizedIntelligenceKey({
      intelligence_category: partial.intelligence_category,
      intelligence_key: partial.intelligence_key,
    }),
    confidence_tier:
      confidence >= 0.85 ? "direct_evidence" : confidence >= 0.75 ? "provider_evidence" : "low",
  }
}

export function mapPdlCompanyToIntelligenceFindings(input: {
  company: PdlCompanyRecord
  company_id: string
  sandbox: boolean
}): GrowthCompanyIntelligenceDraftFinding[] {
  const base = baseConfidenceForCompanyIntelligenceSource("staging_company")
  const providerLabel = input.sandbox ? "People Data Labs (sandbox)" : "People Data Labs"
  const drafts: GrowthCompanyIntelligenceDraftFinding[] = []
  const company = input.company

  const pushText = (
    category: GrowthCompanyIntelligenceDraftFinding["intelligence_category"],
    key: string,
    value: string | null | undefined,
    confidence = base,
  ) => {
    const normalized = normalizeIntelligenceValueText(value)
    if (!normalized) return
    drafts.push(
      draftFinding({
        intelligence_category: category,
        intelligence_key: key,
        value_text: normalized,
        value_json: null,
        source: "staging_company",
        confidence,
        provider_name: "people_data_labs",
        discovery_source: "pdl_company_enrich",
        evidence: [
          {
            evidence_type: "staging_row",
            source_record_id: company.id ?? input.company_id,
            extraction_method: `pdl_company_enrich.${key}`,
            evidence_text: `${providerLabel}: ${normalized}`,
            confidence,
          },
        ],
      }),
    )
  }

  pushText("industry", "industry", company.industry, base + 0.05)
  pushText("company_size", "employee_count", company.size ?? (company.employee_count != null ? String(company.employee_count) : null))
  pushText("description", "summary", company.summary, base)
  pushText("location", "headquarters", company.location?.name ?? [
    company.location?.locality,
    company.location?.region,
    company.location?.country,
  ].filter(Boolean).join(", "))

  if (company.inferred_revenue) {
    pushText("company_size", "inferred_revenue", company.inferred_revenue, base - 0.05)
  }

  for (const tech of (company.tech ?? company.tags ?? []).slice(0, 25)) {
    const value = normalizeIntelligenceValueText(tech)
    if (!value) continue
    drafts.push(
      draftFinding({
        intelligence_category: "technology",
        intelligence_key: normalizeTechnologyIntelligenceKey(value),
        value_text: value,
        value_json: { technology: value },
        source: "staging_company",
        confidence: base,
        provider_name: "people_data_labs",
        discovery_source: "pdl_company_enrich.tech",
        evidence: [
          {
            evidence_type: "staging_row",
            source_record_id: company.id ?? input.company_id,
            extraction_method: "pdl_company_enrich.tech",
            evidence_text: `${providerLabel} technology: ${value}`,
            confidence: base,
          },
        ],
      }),
    )
  }

  return drafts
}
