/** GE-AIOS-8A-2 — Approved Business Profile → Evidence Engine provider (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import type {
  BusinessProfileDraftContent,
  BusinessProfileRecord,
} from "@/lib/growth/business-profile/business-profile-types"
import { defaultFreshnessConfidence } from "@/lib/growth/evidence-engine/evidence-confidence"
import type {
  EvidenceEngineFactCategory,
  EvidenceProviderCollectionOutput,
  EvidenceProviderRawItem,
} from "@/lib/growth/evidence-engine/evidence-engine-types"

export type ApprovedProfileEvidenceProviderInput = {
  admin: SupabaseClient
  organizationId: string
  loadApprovedProfile?: (
    admin: SupabaseClient,
    organizationId: string,
  ) => Promise<BusinessProfileRecord | null>
}

function pushRawItem(
  items: EvidenceProviderRawItem[],
  input: Omit<EvidenceProviderRawItem, "provider" | "decision_tier" | "evidence_type"> & {
    profile: BusinessProfileRecord
    section: string
    field: string
  },
): void {
  const value = input.value_text.trim()
  if (!value) return

  const approvedAt = input.profile.approvedAt ?? input.profile.updatedAt
  const freshness = defaultFreshnessConfidence(approvedAt)

  items.push({
    provider: "approved_profile",
    decision_tier: "historical_customer",
    evidence_type: "approved_profile",
    fact_key: input.fact_key,
    category: input.category,
    value_text: value,
    value_json: input.value_json ?? null,
    source_url: input.profile.website || null,
    page_title: "Approved Growth Profile",
    raw_excerpt: value.slice(0, 500),
    evidence_confidence: 0.95,
    extraction_confidence: 0.98,
    verification_confidence: 0.97,
    freshness_confidence: freshness,
    extracted_at: approvedAt,
    metadata: {
      business_profile_id: input.profile.id,
      approved_at: input.profile.approvedAt,
      approved_by: input.profile.approvedBy,
      profile_section: input.section,
      profile_field: input.field,
      operator_confirmed: true,
    },
  })
}

function pushArrayItems(
  items: EvidenceProviderRawItem[],
  input: {
    profile: BusinessProfileRecord
    factKeyPrefix: string
    category: EvidenceEngineFactCategory
    section: string
    field: string
    values: string[]
  },
): void {
  for (const value of input.values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    pushRawItem(items, {
      profile: input.profile,
      section: input.section,
      field: input.field,
      fact_key: `${input.factKeyPrefix}.${normalizeArrayFactSuffix(trimmed)}`,
      category: input.category,
      value_text: trimmed,
      value_json: { list_value: trimmed },
    })
  }
}

function normalizeArrayFactSuffix(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
}

function collectApprovedProfileRawItems(profile: BusinessProfileRecord): EvidenceProviderRawItem[] {
  const items: EvidenceProviderRawItem[] = []
  const content: BusinessProfileDraftContent = profile.profile

  pushRawItem(items, {
    profile,
    section: "company",
    field: "companyName",
    fact_key: "company.company_name",
    category: "company",
    value_text: content.company.companyName || profile.companyName,
  })

  pushRawItem(items, {
    profile,
    section: "company",
    field: "website",
    fact_key: "company.website",
    category: "company",
    value_text: content.company.website || profile.website,
  })

  pushRawItem(items, {
    profile,
    section: "company",
    field: "shortDescription",
    fact_key: "company.description",
    category: "company",
    value_text: content.company.shortDescription,
  })

  pushRawItem(items, {
    profile,
    section: "company",
    field: "businessModel",
    fact_key: "company.business_model",
    category: "company",
    value_text: content.company.businessModel,
  })

  pushRawItem(items, {
    profile,
    section: "company",
    field: "primaryValueProposition",
    fact_key: "company.primary_value_proposition",
    category: "company",
    value_text: content.company.primaryValueProposition,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "company.products_services",
    category: "company",
    section: "company",
    field: "productsServices",
    values: content.company.productsServices,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "ideal_customers.target_industries",
    category: "ideal_customers",
    section: "idealCustomers",
    field: "targetIndustries",
    values: content.idealCustomers.targetIndustries,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "ideal_customers.company_size_ranges",
    category: "ideal_customers",
    section: "idealCustomers",
    field: "companySizeRanges",
    values: content.idealCustomers.companySizeRanges,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "ideal_customers.geography",
    category: "ideal_customers",
    section: "idealCustomers",
    field: "geography",
    values: content.idealCustomers.geography,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "ideal_customers.buyer_personas",
    category: "ideal_customers",
    section: "idealCustomers",
    field: "buyerPersonas",
    values: content.idealCustomers.buyerPersonas,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "ideal_customers.disqualifiers",
    category: "ideal_customers",
    section: "idealCustomers",
    field: "disqualifiers",
    values: content.idealCustomers.disqualifiers,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "problems.pain_points",
    category: "problems",
    section: "problemsAndTriggers",
    field: "painPoints",
    values: content.problemsAndTriggers.painPoints,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "problems.buying_triggers",
    category: "problems",
    section: "problemsAndTriggers",
    field: "buyingTriggers",
    values: content.problemsAndTriggers.buyingTriggers,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "problems.competitors_alternatives",
    category: "problems",
    section: "problemsAndTriggers",
    field: "competitorsAlternatives",
    values: content.problemsAndTriggers.competitorsAlternatives,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "problems.keywords",
    category: "problems",
    section: "problemsAndTriggers",
    field: "keywords",
    values: content.problemsAndTriggers.keywords,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "problems.negative_keywords",
    category: "problems",
    section: "problemsAndTriggers",
    field: "negativeKeywords",
    values: content.problemsAndTriggers.negativeKeywords,
  })

  if (content.salesAndMarketing.averageDealSize) {
    pushRawItem(items, {
      profile,
      section: "salesAndMarketing",
      field: "averageDealSize",
      fact_key: "sales_marketing.average_deal_size",
      category: "sales_marketing",
      value_text: content.salesAndMarketing.averageDealSize,
    })
  }

  if (content.salesAndMarketing.salesCycleEstimate) {
    pushRawItem(items, {
      profile,
      section: "salesAndMarketing",
      field: "salesCycleEstimate",
      fact_key: "sales_marketing.sales_cycle_estimate",
      category: "sales_marketing",
      value_text: content.salesAndMarketing.salesCycleEstimate,
    })
  }

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "sales_marketing.messaging_angles",
    category: "sales_marketing",
    section: "salesAndMarketing",
    field: "messagingAngles",
    values: content.salesAndMarketing.messagingAngles,
  })

  pushArrayItems(items, {
    profile,
    factKeyPrefix: "sales_marketing.qualification_criteria",
    category: "sales_marketing",
    section: "salesAndMarketing",
    field: "qualificationCriteria",
    values: content.salesAndMarketing.qualificationCriteria,
  })

  return items
}

export async function collectApprovedProfileEvidence(
  input: ApprovedProfileEvidenceProviderInput,
): Promise<EvidenceProviderCollectionOutput> {
  const loadApprovedProfile = input.loadApprovedProfile ?? getActiveApprovedBusinessProfile
  const profile = await loadApprovedProfile(input.admin, input.organizationId)

  if (!profile) {
    return {
      organization_id: input.organizationId,
      provider: "approved_profile",
      raw_items: [],
      warnings: ["No approved Business Profile found for organization."],
      diagnostics: {
        skipped: true,
        reason: "no_approved_profile",
      },
    }
  }

  if (profile.status !== "approved") {
    return {
      organization_id: input.organizationId,
      provider: "approved_profile",
      raw_items: [],
      warnings: ["Business Profile is not approved; evidence collection skipped."],
      diagnostics: {
        skipped: true,
        reason: "profile_not_approved",
        profile_id: profile.id,
        profile_status: profile.status,
      },
    }
  }

  const raw_items = collectApprovedProfileRawItems(profile)

  return {
    organization_id: input.organizationId,
    provider: "approved_profile",
    raw_items,
    warnings: raw_items.length === 0 ? ["Approved Business Profile contained no extractable fields."] : [],
    diagnostics: {
      business_profile_id: profile.id,
      approved_at: profile.approvedAt,
      approved_by: profile.approvedBy,
      raw_item_count: raw_items.length,
    },
  }
}
