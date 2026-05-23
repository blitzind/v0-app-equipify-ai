import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  buildLeadContactDecisionMakerCandidate,
  recomputeGrowthLeadDecisionMakerStatus,
  upsertGrowthLeadDecisionMakerCandidates,
} from "@/lib/growth/decision-maker-repository"
import type { GrowthDecisionMakerCandidate } from "@/lib/growth/decision-maker-types"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"
import type { GrowthLead } from "@/lib/growth/types"

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function mapResearchDecisionMakerCandidates(
  result: GrowthLeadResearchResult,
): GrowthDecisionMakerCandidate[] {
  return (result.decisionMakerCandidates ?? []).flatMap((candidate) => {
    const fullName = candidate.fullName?.trim()
    if (!fullName) return []
    return [
      {
        fullName,
        title: candidate.title,
        email: candidate.email,
        phone: candidate.phone,
        linkedinUrl: candidate.linkedinUrl,
        source: "website" as const,
        sourceDetail: "AI research extraction",
        confidence: candidate.confidence ?? 0.45,
        evidenceExcerpt: candidate.evidenceExcerpt,
      },
    ]
  })
}

export async function applyGrowthLeadResearchEnrichment(
  admin: SupabaseClient,
  input: {
    lead: GrowthLead
    result: GrowthLeadResearchResult
    createdBy?: string | null
  },
): Promise<GrowthLead | null> {
  const intelligencePatch = {
    estimatedAnnualRevenue: trimOrNull(result.estimatedAnnualRevenue),
    estimatedEmployeeCount: trimOrNull(result.estimatedEmployeeCount ?? result.companySizeEstimate),
    fleetSizeEstimate: trimOrNull(result.fleetSizeEstimate),
    crmDetected: trimOrNull(result.crmDetected),
    fieldServiceStackDetected: trimOrNull(result.fieldServiceStackDetected),
  }

  await updateGrowthLead(admin, input.lead.id, intelligencePatch)

  const candidates = [
    ...mapResearchDecisionMakerCandidates(input.result),
    ...(buildLeadContactDecisionMakerCandidate(input.lead)
      ? [buildLeadContactDecisionMakerCandidate(input.lead)!]
      : []),
  ]

  if (candidates.length > 0) {
    await upsertGrowthLeadDecisionMakerCandidates(admin, {
      leadId: input.lead.id,
      candidates,
      createdBy: input.createdBy ?? null,
    })
  }

  await recomputeGrowthLeadDecisionMakerStatus(admin, input.lead.id)

  logGrowthEngine("research_enrichment_applied", {
    leadId: input.lead.id,
    candidateCount: candidates.length,
  })

  return fetchGrowthLeadById(admin, input.lead.id)
}
