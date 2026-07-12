/**
 * SV1-4 — DataMoon decision-maker enrichment service (server-only).
 * Composes provider config, SV1-1/SV1-2 authorization signals, audience filters,
 * canonical DM attach. Does not send/enroll. DataMoon-only enrichment path.
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
  idempotencyKey?: string
  companyId?: string | null
}) => Promise<{
  records: unknown[]
  providerCalled: boolean
  message: string
  status?:
    | "completed"
    | "pending"
    | "failed_retryable"
    | "failed_terminal"
    | "reused"
    | "skipped"
  runId?: string | null
  audienceId?: string | null
  nextPollAt?: string | null
  failureCode?: string | null
  creditsAvoided?: boolean
  adapterKind?: "live" | "stub" | "injected"
}>

/**
 * @deprecated CONTACT-1B — production must use resolveDatamoonDmDiscoveryAdapter({ runtime: "production" }).
 * Kept only so accidental omission is loud in logs; evaluateAndEnrich never selects this in production.
 */
export const defaultDatamoonDmDiscoveryAdapter: DatamoonDmDiscoveryAdapter = async () => ({
  records: [],
  providerCalled: false,
  message: "CONTACT-1B stub — production must resolve live DataMoon discovery adapter.",
  status: "failed_terminal",
  failureCode: "stub_adapter_forbidden_in_production",
  adapterKind: "stub",
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
    /** When true (default in production callers), resolve live DataMoon adapter if none injected. */
    useLiveDiscoveryAdapter?: boolean
    /** Injected candidate records for tests / dry paths without HTTP. */
    injectedRecords?: unknown[]
    forceProviderCall?: boolean
    generatedAt?: string
    env?: NodeJS.ProcessEnv
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
  let discoveryStatus:
    | "completed"
    | "pending"
    | "failed_retryable"
    | "failed_terminal"
    | "reused"
    | "skipped"
    | null = input.injectedRecords ? "completed" : null
  let discoveryRunId: string | null = null
  let discoveryAudienceId: string | null = null
  let discoveryNextPollAt: string | null = null

  if (!input.injectedRecords) {
    let adapter = input.discoveryAdapter
    if (!adapter && input.useLiveDiscoveryAdapter !== false) {
      const { resolveDatamoonDmDiscoveryAdapter } = await import(
        "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-factory"
      )
      const resolved = resolveDatamoonDmDiscoveryAdapter({
        runtime: "production",
        admin,
        env: input.env,
      })
      adapter = resolved.legacy
    }
    if (!adapter) {
      adapter = defaultDatamoonDmDiscoveryAdapter
      logGrowthEngine("datamoon_dm_discovery_stub_selected", {
        organization_id: input.organizationId,
        lead_id: lead.id,
        message: "Stub adapter selected — unexpected outside explicit cert injection.",
      })
    }
    const discovery = await adapter({
      organizationId: input.organizationId,
      leadId: lead.id,
      companyName: lead.companyName,
      companyDomain,
      titleFamilies: requirement.titleFamilies,
      filters,
      idempotencyKey,
    })
    records = discovery.records
    providerCalled = discovery.providerCalled || providerCalled
    discoveryStatus = discovery.status ?? (records.length > 0 ? "completed" : "pending")
    discoveryRunId = discovery.runId ?? null
    discoveryAudienceId = discovery.audienceId ?? null
    discoveryNextPollAt = discovery.nextPollAt ?? null

    if (discovery.adapterKind === "stub") {
      logGrowthEngine("datamoon_dm_discovery_stub_forbidden", {
        organization_id: input.organizationId,
        lead_id: lead.id,
        message: discovery.message,
      })
    }
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
    discoveryStatus,
  })

  // Attach discovery provenance onto explainability without changing the decision type.
  decision.explainability.providerProvenance = [
    ...decision.explainability.providerProvenance,
    ...(discoveryRunId ? [`datamoon:run:${discoveryRunId}`] : []),
    ...(discoveryAudienceId ? [`datamoon:audience:${discoveryAudienceId}`] : []),
    ...(discoveryNextPollAt ? [`next_poll_at:${discoveryNextPollAt}`] : []),
  ]

  if (providerCalled && discoveryStatus !== "pending" && discoveryStatus !== "reused") {
    recordDatamoonDmRequestAttempt({
      idempotencyKey,
      organizationId: input.organizationId,
      leadId: lead.id,
      now: generatedAt,
      outcome: decision.outcome,
      noSuitablePerson:
        decision.outcome === "no_suitable_person" ||
        decision.outcome === "company_match_uncertain" ||
        (decision.selectedCandidate == null &&
          discoveryStatus !== "pending" &&
          discoveryStatus !== "failed_retryable"),
    })
  }

  // GE-AIOS-CONTACT-1A — persist all DataMoon contact channels into canonical person model
  // whenever a candidate is selected (do not wait until after ranking to retrieve channels).
  if (decision.selectedCandidate) {
    const selected = decision.selectedCandidate
    try {
      const { persistDatamoonDecisionMakerCanonicalContacts } = await import(
        "@/lib/growth/datamoon-decision-maker/datamoon-dm-canonical-contact-persist"
      )
      const persisted = await persistDatamoonDecisionMakerCanonicalContacts(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        candidate: selected,
        emails: selected.emails.map((email) => ({
          value: email.value,
          normalized: email.normalized,
          emailType: email.emailType,
          rawProviderValue: email.rawProviderValue,
          fieldKey: email.fieldKey,
          providerConfidence: null,
        })),
        phones: selected.phones.map((phone) => ({
          value: phone.value,
          normalized: phone.normalized,
          e164: phone.e164,
          extension: phone.extension,
          phoneType: phone.phoneType,
          isCompanySwitchboard: phone.isCompanySwitchboard,
          rawProviderValue: phone.rawProviderValue,
          fieldKey: phone.fieldKey,
          providerConfidence: null,
        })),
        observedAt: generatedAt,
      })

      const { publishDraftFactoryContactAvailable, publishDraftFactoryContactVerified } = await import(
        "@/lib/growth/draft-factory/draft-factory-wake-emitters"
      )
      if (persisted.readiness.emailVerified || persisted.readiness.phoneVerified) {
        void publishDraftFactoryContactVerified(admin, {
          organizationId: input.organizationId,
          leadId: lead.id,
          contactId: persisted.decisionMakerId ?? persisted.personId ?? selected.providerRecordId ?? "dm",
          canonicalPersonId: persisted.personId,
          channel: persisted.readiness.emailVerified ? "email" : "phone",
          verificationStatus: "verified",
          sourceRunId: decision.idempotencyKey,
        })
      } else if (persisted.readiness.emailAvailable || persisted.readiness.phoneAvailable) {
        void publishDraftFactoryContactAvailable(admin, {
          organizationId: input.organizationId,
          leadId: lead.id,
          canonicalPersonId: persisted.personId,
          channel: persisted.readiness.emailAvailable ? "email" : "phone",
          verificationStatus: "unverified",
          sourceRunId: decision.idempotencyKey,
        })
      }
    } catch (error) {
      logGrowthEngine("datamoon_canonical_contact_persist_failed", {
        lead_id: lead.id,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
      // Fall back to legacy DM upsert so pipeline does not lose the selected person
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
  }

  await persistDecisionLedger(admin, decision)

  // GE-AIOS-CONTACT-1B / AUTONOMY-1B — lifecycle events → Draft Factory observer
  {
    const {
      publishDraftFactoryDatamoonPersonCompleted,
      publishDraftFactoryDatamoonPersonRequested,
      publishDraftFactoryDatamoonPersonPending,
    } = await import("@/lib/growth/draft-factory/draft-factory-wake-emitters")
    const eventKey = decision.idempotencyKey || `dm:${lead.id}:${generatedAt}`
    if (decision.outcome === "provider_pending") {
      void publishDraftFactoryDatamoonPersonRequested(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        idempotencyKey: eventKey,
        runId: discoveryRunId,
        audienceId: discoveryAudienceId,
        nextPollAt: discoveryNextPollAt,
      })
      void publishDraftFactoryDatamoonPersonPending(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        idempotencyKey: eventKey,
        runId: discoveryRunId,
        audienceId: discoveryAudienceId,
        nextPollAt: discoveryNextPollAt,
      })
    } else if (decision.resumeDraftFactoryTo === "personalization" && decision.selectedCandidate) {
      void publishDraftFactoryDatamoonPersonCompleted(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        idempotencyKey: eventKey,
        runId: discoveryRunId,
        audienceId: discoveryAudienceId,
      })
    } else if (
      decision.outcome === "no_suitable_person" ||
      decision.outcome === "provider_exhausted" ||
      decision.outcome === "company_match_uncertain" ||
      decision.outcome === "provider_failed_terminal" ||
      decision.outcome === "provider_failed_retryable" ||
      decision.outcome === "retry_later"
    ) {
      void publishDraftFactoryDatamoonPersonCompleted(admin, {
        organizationId: input.organizationId,
        leadId: lead.id,
        idempotencyKey: eventKey,
        runId: discoveryRunId,
        audienceId: discoveryAudienceId,
        failed: true,
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
