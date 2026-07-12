/**
 * GE-AIOS-25C-1 — Unified company research read projection (client-safe composition).
 * Read-only. No new SoR table. Sparse-safe. Exposes conflicts instead of silent overwrite.
 */

import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import {
  buildProspectKnowledgePack,
  type ProspectKnowledgePack,
} from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"

export const GROWTH_COMPANY_RESEARCH_READ_MODEL_QA_MARKER =
  "ge-aios-25c-1-company-research-read-model-v1" as const

export const GROWTH_COMPANY_RESEARCH_FIELD_PRECEDENCE = [
  "verified_canonical_fact",
  "current_high_confidence_v22",
  "company_intelligence_projection",
  "research_run_heuristic",
  "unknown",
] as const

export type GrowthCompanyResearchFieldPrecedence =
  (typeof GROWTH_COMPANY_RESEARCH_FIELD_PRECEDENCE)[number]

export type GrowthCompanyResearchProjectedField = {
  field: string
  value: string | string[] | number | boolean | null
  confidence: number | null
  precedence: GrowthCompanyResearchFieldPrecedence
  sourceUrls: string[]
  freshnessAt: string | null
  conflictWith?: string | null
}

export type GrowthCompanyResearchReadModel = {
  qaMarker: typeof GROWTH_COMPANY_RESEARCH_READ_MODEL_QA_MARKER
  leadId: string | null
  companyId: string | null
  websiteUrl: string | null
  researchRunId: string | null
  researchStatus: string | null
  researchFreshnessAt: string | null
  overallConfidence: number | null
  companyEvidence_v22: GrowthCompanyEvidenceBundle | null
  knowledgePack: ProspectKnowledgePack
  fields: GrowthCompanyResearchProjectedField[]
  conflicts: Array<{ field: string; left: string; right: string; note: string }>
  sourceSummary: {
    hasV22: boolean
    hasCanonicalCompany: boolean
    hasCompanyIntelligence: boolean
    hasPersonsOrCommitteeRefs: boolean
  }
}

export type BuildCompanyResearchReadModelInput = {
  leadId?: string | null
  companyId?: string | null
  prospectRun?: GrowthResearchRunPublicView | null
  canonicalCompany?: {
    id: string
    name?: string | null
    website?: string | null
    industry?: string | null
    employeeRange?: string | null
    identityConfidence?: number | null
    updatedAt?: string | null
  } | null
  companyIntelligence?: Array<{
    category: string
    key: string
    valueText: string | null
    confidence: number | null
    verificationStatus?: string | null
    observedAt?: string | null
    sourceUrls?: string[]
  }> | null
  personOrCommitteeRefs?: Array<{ label: string; href?: string | null }> | null
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === "string" && value.trim()) return [value.trim()]
  return []
}

export function buildCompanyResearchReadModel(
  input: BuildCompanyResearchReadModelInput,
): GrowthCompanyResearchReadModel {
  const run = input.prospectRun ?? null
  const bundle = run?.signals?.companyEvidence_v22 ?? null
  const knowledgePack = buildProspectKnowledgePack({
    bundle,
    signals: run?.signals ?? null,
    observedAt: bundle?.collectedAt ?? run?.completedAt ?? new Date().toISOString(),
  })

  const fields: GrowthCompanyResearchProjectedField[] = []
  const conflicts: GrowthCompanyResearchReadModel["conflicts"] = []

  const verifiedCi = (input.companyIntelligence ?? []).filter(
    (row) => row.verificationStatus === "verified" && (row.confidence ?? 0) >= 0.85,
  )

  function addField(field: GrowthCompanyResearchProjectedField) {
    fields.push(field)
  }

  // Industry: verified CI > high-confidence v22 > run heuristic
  const ciIndustry = verifiedCi.find((r) => r.category === "industry" || r.key.includes("industry"))
  const v22Industry = bundle?.profile.industriesServed
  const runIndustry = run?.industryGuess

  if (ciIndustry?.valueText) {
    addField({
      field: "industry",
      value: ciIndustry.valueText,
      confidence: ciIndustry.confidence,
      precedence: "verified_canonical_fact",
      sourceUrls: ciIndustry.sourceUrls ?? [],
      freshnessAt: ciIndustry.observedAt ?? null,
    })
    if (
      v22Industry?.values[0] &&
      v22Industry.values[0].toLowerCase() !== ciIndustry.valueText.toLowerCase() &&
      (v22Industry.confidence ?? 0) >= 0.7
    ) {
      conflicts.push({
        field: "industry",
        left: `verified:${ciIndustry.valueText}`,
        right: `v22:${v22Industry.values[0]}`,
        note: "Verified Company Intelligence retained; v22 kept as conflict.",
      })
    }
  } else if (v22Industry?.values.length && (v22Industry.confidence ?? 0) >= 0.7) {
    addField({
      field: "industry",
      value: v22Industry.values,
      confidence: v22Industry.confidence,
      precedence: "current_high_confidence_v22",
      sourceUrls: v22Industry.sourceUrls,
      freshnessAt: bundle?.collectedAt ?? null,
    })
  } else if (runIndustry) {
    addField({
      field: "industry",
      value: runIndustry,
      confidence: run?.researchConfidence != null ? run.researchConfidence / 100 : null,
      precedence: "research_run_heuristic",
      sourceUrls: run.websiteUrl ? [run.websiteUrl] : [],
      freshnessAt: run.completedAt,
    })
  } else {
    addField({
      field: "industry",
      value: null,
      confidence: null,
      precedence: "unknown",
      sourceUrls: [],
      freshnessAt: null,
    })
  }

  // Description
  if (bundle?.profile.companyDescription) {
    addField({
      field: "company_description",
      value: bundle.profile.companyDescription.value,
      confidence: bundle.profile.companyDescription.confidence,
      precedence: "current_high_confidence_v22",
      sourceUrls: bundle.profile.companyDescription.sourceUrl
        ? [bundle.profile.companyDescription.sourceUrl]
        : [],
      freshnessAt: bundle.collectedAt,
    })
  } else {
    const ciDesc = verifiedCi.find((r) => r.category === "description")
    if (ciDesc?.valueText) {
      addField({
        field: "company_description",
        value: ciDesc.valueText,
        confidence: ciDesc.confidence,
        precedence: "verified_canonical_fact",
        sourceUrls: ciDesc.sourceUrls ?? [],
        freshnessAt: ciDesc.observedAt ?? null,
      })
    } else {
      addField({
        field: "company_description",
        value: null,
        confidence: null,
        precedence: "unknown",
        sourceUrls: [],
        freshnessAt: null,
      })
    }
  }

  // Services / products from v22
  if (bundle?.profile.primaryServices?.values.length) {
    addField({
      field: "services",
      value: bundle.profile.primaryServices.values,
      confidence: bundle.profile.primaryServices.confidence,
      precedence: "current_high_confidence_v22",
      sourceUrls: bundle.profile.primaryServices.sourceUrls,
      freshnessAt: bundle.collectedAt,
    })
  }
  if (bundle?.profile.primaryProducts?.values.length) {
    addField({
      field: "products",
      value: bundle.profile.primaryProducts.values,
      confidence: bundle.profile.primaryProducts.confidence,
      precedence: "current_high_confidence_v22",
      sourceUrls: bundle.profile.primaryProducts.sourceUrls,
      freshnessAt: bundle.collectedAt,
    })
  }

  // Canonical company identity fields (never overwritten by weaker research in this projection)
  if (input.canonicalCompany?.name) {
    addField({
      field: "canonical_company_name",
      value: input.canonicalCompany.name,
      confidence: input.canonicalCompany.identityConfidence ?? 0.9,
      precedence: "verified_canonical_fact",
      sourceUrls: input.canonicalCompany.website ? [input.canonicalCompany.website] : [],
      freshnessAt: input.canonicalCompany.updatedAt ?? null,
    })
  }

  if (input.canonicalCompany?.industry && ciIndustry == null) {
    // Soft identity industry — still higher than heuristic if identity confidence high
    const identityIndustry = input.canonicalCompany.industry
    if (
      v22Industry?.values[0] &&
      identityIndustry.toLowerCase() !== String(v22Industry.values[0]).toLowerCase()
    ) {
      conflicts.push({
        field: "industry_identity",
        left: `canonical:${identityIndustry}`,
        right: `v22:${v22Industry.values[0]}`,
        note: "Both retained; verified CI or canonical identity preferred for decisions.",
      })
    }
  }

  // Knowledge pack highlights as projected fields (facts only)
  for (const fact of knowledgePack.observed_facts.slice(0, 20)) {
    if (fields.some((f) => f.field === fact.field)) continue
    addField({
      field: fact.field,
      value: Array.isArray(fact.value) ? asStringArray(fact.value) : (fact.value as string | boolean | null),
      confidence: fact.confidence,
      precedence: "current_high_confidence_v22",
      sourceUrls: fact.sourceUrls,
      freshnessAt: fact.lastObservedAt,
    })
  }

  const overallConfidence =
    bundle?.qualityScores.overallEvidenceConfidence ??
    (run?.researchConfidence != null ? run.researchConfidence / 100 : null)

  return {
    qaMarker: GROWTH_COMPANY_RESEARCH_READ_MODEL_QA_MARKER,
    leadId: input.leadId ?? run?.leadId ?? null,
    companyId: input.companyId ?? input.canonicalCompany?.id ?? null,
    websiteUrl: bundle?.websiteUrl ?? run?.websiteUrl ?? input.canonicalCompany?.website ?? null,
    researchRunId: run?.id ?? null,
    researchStatus: run?.status ?? null,
    researchFreshnessAt: run?.completedAt ?? bundle?.collectedAt ?? null,
    overallConfidence,
    companyEvidence_v22: bundle,
    knowledgePack,
    fields,
    conflicts,
    sourceSummary: {
      hasV22: Boolean(bundle),
      hasCanonicalCompany: Boolean(input.canonicalCompany?.id || input.companyId),
      hasCompanyIntelligence: (input.companyIntelligence?.length ?? 0) > 0,
      hasPersonsOrCommitteeRefs: (input.personOrCommitteeRefs?.length ?? 0) > 0,
    },
  }
}
