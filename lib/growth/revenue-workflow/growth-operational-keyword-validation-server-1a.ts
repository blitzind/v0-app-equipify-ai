/** GE-AIOS-EXTERNAL-DISCOVERY-POST-RESEARCH-KEYWORD-VALIDATION-1A — Post-research admission reconciliation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  type GrowthLeadAdmissionLeadRow,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import type { GrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildLeadAdmissionMetadata,
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildGrowthOperationalKeywordValidationInputFromResearch,
  buildOperationalKeywordValidationMetadata,
  evaluateExternalDiscoveryIndustryGateFromEvidence,
  evaluateGrowthOperationalKeywordValidation,
  isExternalDiscoveryLeadIntakeSource,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import type { GrowthLead } from "@/lib/growth/types"

export type ReconcileExternalDiscoveryPostResearchAdmissionInput = {
  admin: SupabaseClient
  lead: GrowthLead
  admissionContext: GrowthLeadAdmissionContext
  evidenceBundle?: GrowthCompanyEvidenceBundle | null
  websiteCrawlText?: string | null
  providerKeywords?: string[]
  providerSignals?: string[]
  generatedAt?: string
}

export type ReconcileExternalDiscoveryPostResearchAdmissionResult = {
  applied: boolean
  admissionState: string
  keywordValidationPass: boolean
  industryGatePassed: boolean
}

function resolveProviderMetadata(lead: GrowthLead): {
  providerKeywords?: string[]
  providerSignals?: string[]
  prospectSearchIndustryGatePassed?: boolean
} {
  const metadata = lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {}
  const datamoon =
    metadata.datamoon && typeof metadata.datamoon === "object"
      ? (metadata.datamoon as Record<string, unknown>)
      : {}
  const providerKeywords = Array.isArray(datamoon.provider_keywords)
    ? datamoon.provider_keywords.filter((value): value is string => typeof value === "string")
    : undefined
  const providerSignals = Array.isArray(datamoon.provider_signals)
    ? datamoon.provider_signals.filter((value): value is string => typeof value === "string")
    : undefined
  return {
    providerKeywords,
    providerSignals,
    prospectSearchIndustryGatePassed:
      metadata.prospect_search_industry_gate_passed === true ||
      datamoon.prospect_search_industry_gate_passed === true,
  }
}

export async function reconcileExternalDiscoveryPostResearchAdmission(
  input: ReconcileExternalDiscoveryPostResearchAdmissionInput,
): Promise<ReconcileExternalDiscoveryPostResearchAdmissionResult> {
  const intake = buildGrowthLeadAdmissionIntakeFromLead(input.lead as GrowthLeadAdmissionLeadRow)
  if (!isExternalDiscoveryLeadIntakeSource(intake.source)) {
    return {
      applied: false,
      admissionState: String(input.lead.metadata?.admission_state ?? "unknown"),
      keywordValidationPass: false,
      industryGatePassed: false,
    }
  }

  const approvedProfile = input.admissionContext.approvedProfile
  if (!approvedProfile) {
    return {
      applied: false,
      admissionState: String(input.lead.metadata?.admission_state ?? "review"),
      keywordValidationPass: false,
      industryGatePassed: false,
    }
  }

  const providerMeta = resolveProviderMetadata(input.lead)
  const validationInput = buildGrowthOperationalKeywordValidationInputFromResearch({
    companyName: input.lead.companyName,
    website: input.lead.website,
    industry: input.lead.industry ?? intake.industry ?? null,
    providerKeywords: input.providerKeywords ?? providerMeta.providerKeywords,
    providerSignals: input.providerSignals ?? providerMeta.providerSignals,
    websiteCrawlText: input.websiteCrawlText ?? null,
    evidenceBundle: input.evidenceBundle ?? null,
    approvedProfile,
  })
  const keywordValidation = evaluateGrowthOperationalKeywordValidation(validationInput)
  const industryGatePassed =
    providerMeta.prospectSearchIndustryGatePassed === true ||
    evaluateExternalDiscoveryIndustryGateFromEvidence({
      companyName: input.lead.companyName,
      website: input.lead.website,
      industry: input.lead.industry ?? intake.industry ?? null,
      keywords: validationInput.providerKeywords,
      signals: validationInput.providerSignals,
      approvedProfile,
    })

  const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext, {
    operationalKeywordValidation: keywordValidation,
    prospectSearchIndustryGatePassed: industryGatePassed,
  })

  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const existingMetadata =
    input.lead.metadata && typeof input.lead.metadata === "object" ? input.lead.metadata : {}

  await updateGrowthLeadFromImportMerge(input.admin, input.lead.id, {
    status: admission.leadStatus === "disqualified" ? "disqualified" : input.lead.status,
    metadata: {
      ...existingMetadata,
      ...buildLeadAdmissionMetadata(admission, generatedAt),
      ...buildOperationalKeywordValidationMetadata(keywordValidation, generatedAt),
      prospect_search_industry_gate_passed: industryGatePassed,
    },
  })

  return {
    applied: true,
    admissionState: admission.state,
    keywordValidationPass: keywordValidation.pass,
    industryGatePassed,
  }
}
