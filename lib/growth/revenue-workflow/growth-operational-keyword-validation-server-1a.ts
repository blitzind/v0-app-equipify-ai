/** GE-AIOS-EXTERNAL-DISCOVERY-POST-RESEARCH-KEYWORD-VALIDATION-1A — Post-research admission reconciliation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { wakeDraftFactoryFromCompletionEvent } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthResearchRunPublicView } from "@/lib/growth/research/research-types"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  type GrowthLeadAdmissionLeadRow,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import type { GrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildLeadAdmissionMetadata,
  evaluateGrowthLeadAdmission,
  resolveReconciledLeadStatusFromAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildGrowthOperationalKeywordValidationInputFromResearch,
  buildOperationalKeywordValidationMetadata,
  evaluateExternalDiscoveryIndustryGateFromEvidence,
  evaluateGrowthOperationalKeywordValidation,
  isExternalDiscoveryLeadIntakeSource,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import {
  buildInvestmentChangedWakeSourceId,
  captureGrowthResourceAllocationInputSnapshot,
  hasMaterialResourceAllocationInputChange,
} from "@/lib/growth/revenue-workflow/growth-admission-investment-propagation-1a"
import type { GrowthLead } from "@/lib/growth/types"

export type ReconcileExternalDiscoveryPostResearchAdmissionInput = {
  admin: SupabaseClient
  lead: GrowthLead
  organizationId?: string
  admissionContext: GrowthLeadAdmissionContext
  evidenceBundle?: GrowthCompanyEvidenceBundle | null
  websiteCrawlText?: string | null
  providerKeywords?: string[]
  providerSignals?: string[]
  generatedAt?: string
  researchRun?: Pick<
    GrowthResearchRunPublicView,
    | "researchSummary"
    | "suggestedPitchAngle"
    | "suggestedSequence"
    | "suggestedCallOpening"
    | "recommendedNextAction"
    | "industryGuess"
    | "detectedTechnologies"
    | "signals"
  > | null
}

export type ReconcileExternalDiscoveryPostResearchAdmissionResult = {
  applied: boolean
  admissionState: string
  keywordValidationPass: boolean
  industryGatePassed: boolean
  investmentWakeEmitted: boolean
  investmentWakeDuplicate: boolean
  investmentWakeOutcome: string | null
}

function resolveOrganizationIdForLead(lead: GrowthLead, organizationId?: string): string | null {
  if (organizationId?.trim()) return organizationId.trim()
  if (lead.promotedOrganizationId?.trim()) return lead.promotedOrganizationId.trim()
  return getGrowthEngineAiOrgId() ?? null
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
  const emptyWake = {
    investmentWakeEmitted: false,
    investmentWakeDuplicate: false,
    investmentWakeOutcome: null,
  }

  if (!isExternalDiscoveryLeadIntakeSource(intake.source)) {
    return {
      applied: false,
      admissionState: String(input.lead.metadata?.admission_state ?? "unknown"),
      keywordValidationPass: false,
      industryGatePassed: false,
      ...emptyWake,
    }
  }

  const approvedProfile = input.admissionContext.approvedProfile
  if (!approvedProfile) {
    return {
      applied: false,
      admissionState: String(input.lead.metadata?.admission_state ?? "review"),
      keywordValidationPass: false,
      industryGatePassed: false,
      ...emptyWake,
    }
  }

  const organizationId = resolveOrganizationIdForLead(input.lead, input.organizationId)
  const beforeRaSnapshot = organizationId
    ? captureGrowthResourceAllocationInputSnapshot(input.lead, organizationId)
    : null

  const providerMeta = resolveProviderMetadata(input.lead)
  const validationInput = buildGrowthOperationalKeywordValidationInputFromResearch({
    companyName: input.lead.companyName,
    website: input.lead.website,
    industry: input.lead.industry ?? intake.industry ?? null,
    providerKeywords: input.providerKeywords ?? providerMeta.providerKeywords,
    providerSignals: input.providerSignals ?? providerMeta.providerSignals,
    websiteCrawlText: input.websiteCrawlText ?? null,
    evidenceBundle: input.evidenceBundle ?? null,
    researchRun: input.researchRun ?? null,
    approvedProfile,
  })
  const keywordValidation = evaluateGrowthOperationalKeywordValidation(validationInput)
  const industryGatePassed =
    providerMeta.prospectSearchIndustryGatePassed === true ||
    evaluateExternalDiscoveryIndustryGateFromEvidence({
      companyName: input.lead.companyName,
      website: input.lead.website,
      industry:
        input.lead.industry ??
        (input.researchRun?.industryGuess != null ? String(input.researchRun.industryGuess) : null) ??
        intake.industry ??
        null,
      keywords: [
        ...(validationInput.providerKeywords ?? []),
        ...(input.researchRun?.industryGuess != null ? [String(input.researchRun.industryGuess)] : []),
      ],
      signals: validationInput.providerSignals,
      notes: input.researchRun?.researchSummary ?? null,
      approvedProfile,
    })

  const admission = evaluateGrowthLeadAdmission(intake, input.admissionContext, {
    operationalKeywordValidation: keywordValidation,
    prospectSearchIndustryGatePassed: industryGatePassed,
  })

  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const existingMetadata =
    input.lead.metadata && typeof input.lead.metadata === "object" ? input.lead.metadata : {}
  const reconciledStatus = resolveReconciledLeadStatusFromAdmission(admission)
  const reconciledMetadata = {
    ...existingMetadata,
    ...buildLeadAdmissionMetadata(admission, generatedAt),
    ...buildOperationalKeywordValidationMetadata(keywordValidation, generatedAt),
    prospect_search_industry_gate_passed: industryGatePassed,
  }

  const afterRaSnapshot =
    organizationId != null
      ? captureGrowthResourceAllocationInputSnapshot(
          {
            ...input.lead,
            status: reconciledStatus,
            metadata: reconciledMetadata,
          },
          organizationId,
        )
      : null

  await updateGrowthLeadFromImportMerge(input.admin, input.lead.id, {
    status: reconciledStatus,
    metadata: reconciledMetadata,
  })

  let investmentWakeEmitted = false
  let investmentWakeDuplicate = false
  let investmentWakeOutcome: string | null = null

  if (
    organizationId &&
    beforeRaSnapshot &&
    afterRaSnapshot &&
    hasMaterialResourceAllocationInputChange(beforeRaSnapshot, afterRaSnapshot)
  ) {
    const wakeResult = await wakeDraftFactoryFromCompletionEvent(input.admin, {
      organizationId,
      leadId: input.lead.id,
      wake: {
        type: "investment_changed",
        sourceId: buildInvestmentChangedWakeSourceId(afterRaSnapshot),
      },
      portfolioSelected: true,
      allowGeneration: false,
    })
    if (wakeResult) {
      investmentWakeEmitted = true
      investmentWakeDuplicate = wakeResult.duplicate === true || wakeResult.outcome === "duplicate_noop"
      investmentWakeOutcome = wakeResult.outcome
    }
  }

  return {
    applied: true,
    admissionState: admission.state,
    keywordValidationPass: keywordValidation.pass,
    industryGatePassed,
    investmentWakeEmitted,
    investmentWakeDuplicate,
    investmentWakeOutcome,
  }
}
