/** GE-AIOS-21C-4 — Production admission analysis (server-only, read-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  extractDomainFromEmail,
  isConsumerEmailDomain,
  normalizeDomain,
} from "@/lib/growth/company-identification/company-identification-normalize"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import {
  classifyGrowthLeadAdmissionDrift,
  type GrowthLeadAdmissionDriftRow,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-drift"
import {
  evaluateGrowthLeadAdmission,
  resolveCredibleBusinessDomain,
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildGrowthLeadAdmissionIntakeFromLead,
  redactLeadSample,
  type GrowthLeadAdmissionLeadRow,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"

export const GROWTH_LEAD_ADMISSION_PRODUCTION_ANALYSIS_QA_MARKER =
  "ge-aios-21c-lead-admission-production-analysis-v1" as const

export type GrowthLeadAdmissionProductionLeadRow = GrowthLeadAdmissionLeadRow & {
  status: string
  created_at?: string | null
  latest_prospect_research_run_id?: string | null
  last_prospect_researched_at?: string | null
}

export type GrowthLeadAdmissionProductionCounts = {
  totalActiveLeads: number
  missingAdmissionMetadata: number
  accepted: number
  review: number
  rejected: number
  invalid: number
  consumerDomainWebsites: number
  consumerDomainCompanyNames: number
  credibleNameConsumerEmailOnly: number
  noCredibleCompanyIdentity: number
  researchEligible: number
  researchBlocked: number
  outreachEligible: number
  outreachBlocked: number
  storedVsEvaluatedDrift: number
  researchedAfter21CByInvalidRejected: number
  invalidRejectedInActiveQueue: number
}

export type GrowthLeadAdmissionProductionAnalysis = {
  qa_marker: typeof GROWTH_LEAD_ADMISSION_PRODUCTION_ANALYSIS_QA_MARKER
  organizationId: string
  generatedAt: string
  deploymentMarkerPresent: boolean
  counts: GrowthLeadAdmissionProductionCounts
  queueByAdmissionState: Record<GrowthLeadAdmissionState | "unclassified", number>
  researchRunsByAdmissionState: Record<GrowthLeadAdmissionState | "unclassified", number>
  driftRows: GrowthLeadAdmissionDriftRow[]
  samples: Record<string, Array<Record<string, unknown>>>
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

function isTerminalStatus(status: string | null | undefined): boolean {
  return status === "archived" || status === "converted"
}

function isActiveQueueStatus(status: string | null | undefined): boolean {
  return Boolean(status && !isTerminalStatus(status) && status !== "disqualified")
}

export async function loadSuppressedLeadIds(admin: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await admin
    .schema("growth")
    .from("suppression_entries")
    .select("lead_id")
    .not("lead_id", "is", null)
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((row) => String(row.lead_id)))
}

export async function analyzeGrowthLeadAdmissionProductionPool(input: {
  admin: SupabaseClient
  organizationId: string
  limit?: number
  includeArchived?: boolean
}): Promise<GrowthLeadAdmissionProductionAnalysis> {
  const generatedAt = new Date().toISOString()
  const limit = input.limit ?? 500
  const admissionContext = await loadGrowthLeadAdmissionContext(input.admin, input.organizationId)
  const approvedProfile = await getActiveApprovedBusinessProfile(input.admin, input.organizationId)
  const suppressedLeadIds = await loadSuppressedLeadIds(input.admin)

  let query = growthLeadsTable(input.admin)
    .select(
      "id, company_name, contact_name, contact_email, website, status, metadata, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!input.includeArchived) {
    query = query.not("status", "in", '("archived","converted")')
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const leads = (data ?? []) as GrowthLeadAdmissionProductionLeadRow[]
  const counts: GrowthLeadAdmissionProductionCounts = {
    totalActiveLeads: leads.length,
    missingAdmissionMetadata: 0,
    accepted: 0,
    review: 0,
    rejected: 0,
    invalid: 0,
    consumerDomainWebsites: 0,
    consumerDomainCompanyNames: 0,
    credibleNameConsumerEmailOnly: 0,
    noCredibleCompanyIdentity: 0,
    researchEligible: 0,
    researchBlocked: 0,
    outreachEligible: 0,
    outreachBlocked: 0,
    storedVsEvaluatedDrift: 0,
    researchedAfter21CByInvalidRejected: 0,
    invalidRejectedInActiveQueue: 0,
  }

  const queueByAdmissionState: GrowthLeadAdmissionProductionAnalysis["queueByAdmissionState"] = {
    accepted: 0,
    review: 0,
    rejected: 0,
    invalid: 0,
    unclassified: 0,
  }
  const researchRunsByAdmissionState: GrowthLeadAdmissionProductionAnalysis["researchRunsByAdmissionState"] = {
    accepted: 0,
    review: 0,
    rejected: 0,
    invalid: 0,
    unclassified: 0,
  }

  const driftRows: GrowthLeadAdmissionDriftRow[] = []
  const samples: GrowthLeadAdmissionProductionAnalysis["samples"] = {
    accepted: [],
    review: [],
    rejected: [],
    invalid: [],
    drift: [],
    consumer_domain_website: [],
    consumer_domain_company_name: [],
    credible_name_consumer_email: [],
    no_credible_identity: [],
    research_blocked: [],
    queue_violation: [],
  }

  let deploymentMarkerPresent = false

  for (const lead of leads) {
    const metadata =
      lead.metadata && typeof lead.metadata === "object" ? lead.metadata : {}
    const storedState = resolveLeadAdmissionStateFromMetadata(metadata)
    if (metadata.admission_qa_marker === "ge-aios-21c-lead-admission-gate-v1") {
      deploymentMarkerPresent = true
    }
    if (!storedState) counts.missingAdmissionMetadata += 1

    const intake = buildGrowthLeadAdmissionIntakeFromLead(lead)
    const evaluation = evaluateGrowthLeadAdmission(intake, admissionContext)
    const evaluatedState = evaluation.state
    counts[evaluatedState] += 1

    const websiteDomain = normalizeDomain(lead.website)
    if (websiteDomain && isConsumerEmailDomain(websiteDomain)) {
      counts.consumerDomainWebsites += 1
      if (samples.consumer_domain_website.length < 3) {
        samples.consumer_domain_website.push(redactLeadSample(lead))
      }
    }

    if (lead.company_name && isConsumerEmailDomain(normalizeDomain(lead.company_name))) {
      counts.consumerDomainCompanyNames += 1
      if (samples.consumer_domain_company_name.length < 3) {
        samples.consumer_domain_company_name.push(redactLeadSample(lead))
      }
    }

    const emailDomain = extractDomainFromEmail(lead.contact_email)
    const credibleDomain = resolveCredibleBusinessDomain({
      domain: intake.domain,
      website: intake.website,
      businessEmail:
        typeof metadata.business_email === "string" ? metadata.business_email : null,
      contactEmail: lead.contact_email,
    })
    if (
      lead.company_name &&
      !isConsumerEmailDomain(normalizeDomain(lead.company_name)) &&
      emailDomain &&
      isConsumerEmailDomain(emailDomain) &&
      !credibleDomain
    ) {
      counts.credibleNameConsumerEmailOnly += 1
      if (samples.credible_name_consumer_email.length < 3) {
        samples.credible_name_consumer_email.push(redactLeadSample(lead))
      }
    }

    if (evaluatedState === "invalid") {
      counts.noCredibleCompanyIdentity += 1
      if (samples.no_credible_identity.length < 3) {
        samples.no_credible_identity.push(redactLeadSample(lead))
      }
    }

    const researchEligible = shouldAutoQueueLeadResearch({
      website: lead.website,
      status: lead.status,
      metadata,
      lastProspectResearchedAt: lead.last_prospect_researched_at ?? null,
      latestProspectResearchRunId: lead.latest_prospect_research_run_id ?? null,
      lastResearchedAt: null,
      latestResearchRunId: null,
    })
    if (researchEligible) counts.researchEligible += 1
    else counts.researchBlocked += 1

    const suppressed = suppressedLeadIds.has(lead.id)
    const drift = classifyGrowthLeadAdmissionDrift({
      storedState,
      evaluation,
      currentWebsite: lead.website,
      currentCompanyName: lead.company_name,
      status: lead.status,
      suppressed,
    })
    drift.leadId = lead.id
    drift.companyName = lead.company_name ?? drift.companyName
    driftRows.push(drift)

    if (storedState !== evaluatedState || drift.driftClassification !== "unchanged") {
      counts.storedVsEvaluatedDrift += 1
      if (samples.drift.length < 5) {
        samples.drift.push({
          ...redactLeadSample(lead),
          stored_state: storedState,
          evaluated_state: evaluatedState,
          drift: drift.driftClassification,
          proposed_action: drift.proposedAction,
        })
      }
    }

    const outreachEligible = drift.outreachEligibility
    if (outreachEligible) counts.outreachEligible += 1
    else counts.outreachBlocked += 1

    const queueKey = evaluatedState ?? "unclassified"
    if (isActiveQueueStatus(lead.status) && !suppressed) {
      queueByAdmissionState[queueKey] += 1
    }

    if (lead.latest_prospect_research_run_id || lead.last_prospect_researched_at) {
      researchRunsByAdmissionState[queueKey] += 1
    }

    if (
      (evaluatedState === "invalid" || evaluatedState === "rejected") &&
      (lead.latest_prospect_research_run_id || lead.last_prospect_researched_at) &&
      !metadata.admission_qa_marker
    ) {
      counts.researchedAfter21CByInvalidRejected += 1
    }

    if (
      (evaluatedState === "invalid" || evaluatedState === "rejected") &&
      isActiveQueueStatus(lead.status) &&
      !suppressed
    ) {
      counts.invalidRejectedInActiveQueue += 1
      if (samples.queue_violation.length < 3) {
        samples.queue_violation.push({
          ...redactLeadSample(lead),
          evaluated_state: evaluatedState,
          drift: drift.driftClassification,
        })
      }
    }

    const sampleKey = evaluatedState
    if (samples[sampleKey] && samples[sampleKey].length < 3) {
      samples[sampleKey].push({
        ...redactLeadSample(lead),
        evaluated_state: evaluatedState,
        stored_state: storedState,
        research_eligible: researchEligible,
        outreach_eligible: outreachEligible,
      })
    }

    if (!researchEligible && samples.research_blocked.length < 3) {
      if (evaluatedState === "invalid" || evaluatedState === "rejected" || evaluatedState === "review") {
        samples.research_blocked.push({
          ...redactLeadSample(lead),
          evaluated_state: evaluatedState,
        })
      }
    }
  }

  void approvedProfile

  return {
    qa_marker: GROWTH_LEAD_ADMISSION_PRODUCTION_ANALYSIS_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt,
    deploymentMarkerPresent,
    counts,
    queueByAdmissionState,
    researchRunsByAdmissionState,
    driftRows,
    samples,
  }
}
