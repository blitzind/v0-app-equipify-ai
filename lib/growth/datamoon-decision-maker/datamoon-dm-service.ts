/**
 * SV1-4 — DataMoon decision-maker enrichment service (server-only).
 * Composes provider config, SV1-1/SV1-2 authorization signals, audience filters,
 * canonical DM attach. Does not send/enroll. Does not call Apollo.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  authorizeDatamoonPersonEnrichment,
  buildDatamoonAudienceFiltersForDecisionMaker,
  buildDatamoonPersonSearchIdempotencyKey,
  decideDatamoonDecisionMakerEnrichment,
  projectDecisionMakerRequirement,
  type ExistingDecisionMakerSnapshot,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import { normalizeDatamoonRecordsToDecisionMakerCandidates } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-normalize"
import {
  getDatamoonDmAttemptCount,
  hasInFlightOrRecentDatamoonDmRequest,
  hasRecentEquivalentDatamoonDmNoResult,
  recordDatamoonDmDecision,
  recordDatamoonDmRequestAttempt,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-request-ledger"
import type { AiOsDatamoonDmDecision } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"
import {
  listGrowthLeadDecisionMakers,
  upsertGrowthLeadDecisionMakerCandidates,
} from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"

export type DatamoonDmDiscoveryAdapter = (input: {
  organizationId: string
  leadId: string
  companyName: string | null
  companyDomain: string | null
  titleFamilies: string[]
  filters: Array<{ field: string; operator: string; value: string | string[] }>
}) => Promise<{ records: unknown[]; providerCalled: boolean; message: string }>

/** Default adapter is a no-network stub — production injects live audience build/fetch. */
export const defaultDatamoonDmDiscoveryAdapter: DatamoonDmDiscoveryAdapter = async () => ({
  records: [],
  providerCalled: false,
  message: "No discovery adapter records — inject live DataMoon audience adapter in runtime.",
})

function nowIso(): string {
  return new Date().toISOString()
}

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    const url = website.includes("://") ? new URL(website) : new URL(`https://${website}`)
    return url.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return website.replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? null
  }
}

async function persistDecisionLedger(
  admin: SupabaseClient | null,
  decision: AiOsDatamoonDmDecision,
): Promise<void> {
  recordDatamoonDmDecision(decision)
  logGrowthEngine("datamoon_dm_enrichment_decision", {
    qa_marker: decision.qaMarker,
    lead_id: decision.leadId,
    organization_id: decision.organizationId,
    outcome: decision.outcome,
    authorized: decision.authorized,
    deny_reason: decision.denyReason,
    provider_called: decision.providerCalled,
    duplicate_prevented: decision.duplicateRequestPrevented,
    resume_to: decision.resumeDraftFactoryTo,
    selected: decision.selectedCandidate?.fullName ?? null,
    explainability: decision.explainability,
  })
  if (!admin) return
  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: decision.organizationId,
      resourceType: "datamoon_dm:enrichment",
      severity: decision.authorized && decision.providerCalled ? "info" : "warning",
      message: `DataMoon DM ${decision.outcome}${decision.denyReason ? ` (${decision.denyReason})` : ""}`,
      context: { decision },
    })
  } catch {
    // ignore
  }
}

/**
 * Evaluate and optionally discover a decision maker for a lead.
 * Live provider calls only occur when authorized and an adapter returns/triggers them.
 */
export async function evaluateAndEnrichDecisionMakerForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    portfolioSelected?: boolean
    budgetAvailable?: boolean
    killSwitchActive?: boolean
    discoveryAdapter?: DatamoonDmDiscoveryAdapter
    /** Injected candidate records for tests / dry paths without HTTP. */
    injectedRecords?: unknown[]
    forceProviderCall?: boolean
    generatedAt?: string
  },
): Promise<AiOsDatamoonDmDecision> {
  const generatedAt = input.generatedAt ?? nowIso()
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    const requirement = projectDecisionMakerRequirement({ admissionState: "invalid" })
    const authorization = authorizeDatamoonPersonEnrichment({
      requirement,
      investmentState: "stop_investment",
      portfolioSelected: false,
      providerEnabled: false,
      providerConfigured: false,
      budgetAvailable: false,
    })
    const decision = decideDatamoonDecisionMakerEnrichment({
      organizationId: input.organizationId,
      leadId: input.leadId,
      requirement,
      authorization,
      now: generatedAt,
    })
    await persistDecisionLedger(admin, decision)
    return decision
  }

  const existingRows = await listGrowthLeadDecisionMakers(admin, lead.id).catch(() => [])
  const existing: ExistingDecisionMakerSnapshot[] = existingRows.map((row) => ({
    fullName: row.fullName,
    title: row.title,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
    status: row.status,
    isPrimary: row.isPrimary,
    confidence: row.confidence,
  }))

  const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
  const researchStale = lead.lastProspectResearchedAt
    ? isProspectResearchStale(lead.lastProspectResearchedAt)
    : true
  const researchComplete = hasUsableResearch && !researchStale
  const companyDomain = domainFromWebsite(lead.website)
  const companyIdentityConfident = Boolean(companyDomain || lead.companyName?.trim())

  const resource = evaluateResourceAllocationFacade({
    organizationId: input.organizationId,
    accountId: lead.id,
    resourceClass: "datamoon_enrichment",
    signals: buildResourceAllocationSignalsFromLead(lead, {
      budgetAvailable: input.budgetAvailable !== false,
      killSwitchActive: input.killSwitchActive === true,
    }),
  })

  const attemptCount = getDatamoonDmAttemptCount(input.organizationId, lead.id)
  const requirement = projectDecisionMakerRequirement({
    admissionState: (lead.metadata?.admission_state as string) ?? "unknown",
    leadStatus: lead.status,
    researchComplete,
    companyIdentityConfident,
    existingDecisionMakers: existing,
    hasPrimaryDecisionMaker: Boolean(lead.primaryDecisionMakerId),
    hasContactName: Boolean(lead.contactName?.trim()),
    contactEmail: lead.contactEmail,
    decisionMakerStatus: lead.decisionMakerStatus,
    searchAttemptCount: attemptCount,
    investmentState: resource.investment_state,
    earnedEnrichmentSpend: resource.investment_state === "increase_investment",
    now: generatedAt,
  })

  const idempotencyKey = buildDatamoonPersonSearchIdempotencyKey({
    organizationId: input.organizationId,
    leadId: lead.id,
    companyDomain,
    companyName: lead.companyName,
    titleFamilies: requirement.titleFamilies,
  })

  const recentNoResult = hasRecentEquivalentDatamoonDmNoResult({
    idempotencyKey,
    now: generatedAt,
  })
  const duplicateRecent = hasInFlightOrRecentDatamoonDmRequest({
    idempotencyKey,
    now: generatedAt,
  })

  const providerEnabled = isDatamoonProviderEnabled()
  const providerConfigured = isDatamoonProviderConfigured()

  const authorization = authorizeDatamoonPersonEnrichment({
    requirement,
    investmentState: resource.investment_state,
    resourceAllocationSpendAuthorized: resource.spend_authorized,
    portfolioSelected: input.portfolioSelected === true,
    providerEnabled,
    providerConfigured,
    budgetAvailable: input.budgetAvailable !== false,
    killSwitchActive: input.killSwitchActive === true,
    leadStatus: lead.status,
    researchComplete,
    companyIdentityConfident,
    recentEquivalentNoResult: recentNoResult,
    searchAttemptCount: attemptCount,
  })

  if (!authorization.authorized) {
    const decision = decideDatamoonDecisionMakerEnrichment({
      organizationId: input.organizationId,
      leadId: lead.id,
      requirement,
      authorization,
      providerCalled: false,
      duplicateRequestPrevented: false,
      idempotencyKey,
      now: generatedAt,
    })
    await persistDecisionLedger(admin, decision)
    return decision
  }

  if (duplicateRecent && !input.forceProviderCall && !input.injectedRecords) {
    const decision = decideDatamoonDecisionMakerEnrichment({
      organizationId: input.organizationId,
      leadId: lead.id,
      requirement,
      authorization: {
        ...authorization,
        authorized: false,
        denyReason: "recent_equivalent_no_result",
        reason: "Duplicate wake — equivalent DataMoon request already recorded (idempotent).",
      },
      providerCalled: false,
      duplicateRequestPrevented: true,
      idempotencyKey,
      now: generatedAt,
    })
    await persistDecisionLedger(admin, decision)
    return decision
  }

  const filters = buildDatamoonAudienceFiltersForDecisionMaker({
    companyName: lead.companyName,
    titleFamilies: requirement.titleFamilies,
  })

  let records: unknown[] = input.injectedRecords ?? []
  let providerCalled = Boolean(input.injectedRecords?.length || input.forceProviderCall)

  if (!input.injectedRecords) {
    const adapter = input.discoveryAdapter ?? defaultDatamoonDmDiscoveryAdapter
    const discovery = await adapter({
      organizationId: input.organizationId,
      leadId: lead.id,
      companyName: lead.companyName,
      companyDomain,
      titleFamilies: requirement.titleFamilies,
      filters,
    })
    records = discovery.records
    providerCalled = discovery.providerCalled || providerCalled
  } else {
    providerCalled = true
  }

  const ranked = normalizeDatamoonRecordsToDecisionMakerCandidates({
    records,
    expectedCompanyDomain: companyDomain,
    expectedCompanyName: lead.companyName,
  })

  const decision = decideDatamoonDecisionMakerEnrichment({
    organizationId: input.organizationId,
    leadId: lead.id,
    requirement,
    authorization,
    rankedCandidates: ranked,
    providerCalled,
    duplicateRequestPrevented: false,
    idempotencyKey,
    now: generatedAt,
  })

  if (providerCalled) {
    recordDatamoonDmRequestAttempt({
      idempotencyKey,
      organizationId: input.organizationId,
      leadId: lead.id,
      now: generatedAt,
      outcome: decision.outcome,
      noSuitablePerson:
        decision.outcome === "no_suitable_person" ||
        decision.outcome === "company_match_uncertain" ||
        decision.selectedCandidate == null,
    })
  }

  // Attach via existing DM upsert — source public_web + datamoon provenance (no schema change).
  if (decision.selectedCandidate && decision.resumeDraftFactoryTo === "personalization") {
    const selected = decision.selectedCandidate
    await upsertGrowthLeadDecisionMakerCandidates(admin, {
      leadId: lead.id,
      candidates: [
        {
          fullName: selected.fullName,
          title: selected.title,
          email: selected.email,
          phone: selected.phone,
          linkedinUrl: selected.linkedinUrl,
          source: "public_web",
          sourceDetail: `datamoon:person_enrichment:${selected.providerRecordId ?? "audience"}`,
          confidence: Math.max(0, Math.min(1, selected.compositeScore / 100)),
          evidenceExcerpt: selected.evidence.join(" | "),
        },
      ],
      createdBy: null,
    }).catch(() => undefined)
  }

  await persistDecisionLedger(admin, decision)

  // SV1-5A — durable wake on DataMoon DM completion / failure (idempotent by provider run id).
  {
    const { wakeDraftFactoryFromCompletionEvent } = await import(
      "@/lib/growth/draft-factory/draft-factory-durable-live"
    )
    if (decision.resumeDraftFactoryTo === "personalization" && decision.selectedCandidate) {
      void wakeDraftFactoryFromCompletionEvent(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        wake: {
          type: "datamoon_person_completed",
          sourceId: decision.idempotencyKey || `dm:${lead.id}:${generatedAt}`,
        },
        portfolioSelected: input.portfolioSelected === true,
        allowGeneration: false,
      })
    } else if (
      decision.outcome === "no_suitable_person" ||
      decision.outcome === "provider_exhausted" ||
      decision.outcome === "company_match_uncertain" ||
      decision.outcome === "retry_later"
    ) {
      void wakeDraftFactoryFromCompletionEvent(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        wake: {
          type: "datamoon_person_failed",
          sourceId: decision.idempotencyKey || `dm-fail:${lead.id}:${generatedAt}`,
        },
        portfolioSelected: input.portfolioSelected === true,
        allowGeneration: false,
      })
    }
  }

  return decision
}

export {
  authorizeDatamoonPersonEnrichment,
  buildDatamoonAudienceFiltersForDecisionMaker,
  decideDatamoonDecisionMakerEnrichment,
  evaluateDecisionMakerContactReadiness,
  projectDecisionMakerRequirement,
  rankDatamoonDecisionMakerCandidates,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-engine"
