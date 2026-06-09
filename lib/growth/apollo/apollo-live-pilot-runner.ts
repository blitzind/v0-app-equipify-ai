/** Apollo AI-2 controlled live pilot runner — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { syncContactCandidatesToCompanyContactsWithResolution } from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { ensureStagingCanonicalCompanyLinkage } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { fetchStagingCanonicalCompanyId } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { runApolloLivePilotContactDiscovery } from "@/lib/growth/apollo/apollo-live-pilot-contact-discovery"
import type { GrowthContactDiscoveryProviderOutcome } from "@/lib/growth/contact-discovery/contact-discovery-provider-outcomes"
import type { GrowthContactDiscoverySnapshot } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { scoreDecisionMakerTitle } from "@/lib/growth/contact-discovery/decision-maker-score"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import { APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  buildApolloLivePilotProviderDiscoveryError,
  buildApolloLivePilotProviderEvidence,
  logApolloLivePilotProviderEvidence,
  type ApolloLivePilotProviderEvidence,
} from "@/lib/growth/apollo/apollo-live-pilot-provider-evidence"
import { classifyApolloContactTitleBucket } from "@/lib/growth/providers/apollo/apollo-title-buckets"
import {
  assertApolloLiveBenchmarkAllowed,
  diagnoseApolloContactDiscoveryConfig,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"
import {
  formatApolloLivePilotErrorForEvidence,
  formatApolloLivePilotFailureForEvidence,
  logApolloLivePilotError,
  logApolloLivePilotFailure,
} from "@/lib/growth/apollo/apollo-live-pilot-error-reporting"
import type { SyncContactCandidatesToCompanyContactsResult } from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"

export const APOLLO_LIVE_PILOT_RUNNER_QA_MARKER = "apollo-live-pilot-runner-ai-2-v1" as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isLivePilotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED === "true" ||
    env.GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED === "true"
  )
}

export function assertApolloAi2LivePilotAllowed(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean
  error: string | null
} {
  if (!isLivePilotEnabled(env)) {
    return {
      ok: false,
      error:
        "Set GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true (or AI-2 equivalent) to run live pilot.",
    }
  }
  if (isApolloMockEnabled(env)) {
    return {
      ok: false,
      error: "Live pilot requires GROWTH_APOLLO_USE_MOCK=false.",
    }
  }
  const gate = assertApolloLiveBenchmarkAllowed(env)
  if (!gate.ok) {
    return { ok: false, error: gate.error }
  }
  return { ok: true, error: null }
}

async function loadCompanyContext(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<{
  company_name: string
  domain: string | null
  website_url: string | null
  canonical_company_id: string | null
}> {
  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_name, domain, website, id, company_id")
    .or(`id.eq.${company_candidate_id},company_id.eq.${company_candidate_id}`)
    .limit(1)
    .maybeSingle()

  const row = data as Record<string, unknown> | null
  const domain =
    asString(row?.domain) ||
    asString(row?.website)?.replace(/^https?:\/\//, "").split("/")[0] ||
    null
  const website_url = asString(row?.website) || (domain ? `https://${domain}` : null)

  let canonical_company_id: string | null = null
  if (row) {
    canonical_company_id = await fetchStagingCanonicalCompanyId(admin, company_candidate_id)
  }

  return {
    company_name: asString(row?.company_name) || company_candidate_id,
    domain,
    website_url,
    canonical_company_id,
  }
}

async function collectContactQuality(
  admin: SupabaseClient,
  company_candidate_id: string,
): Promise<ApolloLivePilotEvidence["contact_quality"]> {
  const { data: candidates } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("full_name, job_title, email, phone, linkedin_url, metadata, verification_state")
    .eq("company_candidate_id", company_candidate_id)
    .eq("provider_type", "future_apollo")

  const rows = candidates ?? []
  const title_buckets: Record<string, number> = {}
  let decision_maker_count = 0
  let with_email = 0
  let with_phone = 0
  let with_verified_email = 0
  let with_linkedin = 0
  let buying_committee_relevant = 0
  let scoreTotal = 0
  let scoreCount = 0

  for (const raw of rows) {
    const row = raw as Record<string, unknown>
    const title = asString(row.job_title) || null
    const email = asString(row.email)
    const phone = asString(row.phone)
    const linkedin = asString(row.linkedin_url)
    const bucket = classifyApolloContactTitleBucket(title)
    title_buckets[bucket] = (title_buckets[bucket] ?? 0) + 1

    const scored = scoreDecisionMakerTitle({ title, source_type: "apollo" })
    if (scored.score >= 70) {
      decision_maker_count += 1
      buying_committee_relevant += 1
    }
    scoreTotal += scored.score
    scoreCount += 1

    if (email) {
      with_email += 1
      if (asString(row.verification_state) === "verified" || asString(row.metadata?.email_status) === "verified") {
        with_verified_email += 1
      }
    }
    if (phone) with_phone += 1
    if (linkedin) with_linkedin += 1
  }

  return {
    decision_maker_count,
    with_email,
    with_phone,
    with_verified_email,
    with_linkedin,
    irrelevant_title_skipped: 0,
    buying_committee_relevant,
    average_decision_maker_score: scoreCount > 0 ? Math.round(scoreTotal / scoreCount) : null,
    title_buckets,
  }
}

async function collectReadinessFunnel(
  admin: SupabaseClient,
  canonical_company_id: string | null,
  importedCount: number,
): Promise<ApolloLivePilotEvidence["readiness_funnel"]> {
  if (!canonical_company_id || importedCount === 0) {
    return {
      imported: importedCount,
      research_complete: 0,
      score_available: 0,
      contactable: 0,
      sequence_ready: 0,
    }
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("email, phone, email_status, phone_status, canonical_person_id, growth_lead_id")
    .eq("company_id", canonical_company_id)

  const rows = contacts ?? []
  let research_complete = 0
  let score_available = 0
  let contactable = 0
  let sequence_ready = 0

  for (const raw of rows) {
    const row = raw as Record<string, unknown>
    const hasPerson = Boolean(asString(row.canonical_person_id))
    const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
    const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
    const leadId = asString(row.growth_lead_id)

    if (hasPerson) research_complete += 1
    if (hasEmail || hasPhone) contactable += 1

    if (leadId) {
      const { data: lead } = await admin
        .schema("growth")
        .from("leads")
        .select("score, research_summary")
        .eq("id", leadId)
        .maybeSingle()
      const leadRow = lead as Record<string, unknown> | null
      if (leadRow?.score != null && Number(leadRow.score) >= 0) score_available += 1
      if (
        hasPerson &&
        (hasEmail || hasPhone) &&
        leadRow?.score != null &&
        Number(leadRow.score) >= 50 &&
        asString(leadRow.research_summary)
      ) {
        sequence_ready += 1
      }
    }
  }

  return {
    imported: Math.max(importedCount, rows.length),
    research_complete,
    score_available,
    contactable,
    sequence_ready,
  }
}

function providerClassificationErrorName(
  classification: ApolloLivePilotProviderEvidence["classification"],
): string {
  switch (classification) {
    case "apollo_zero_results":
      return "ApolloZeroResults"
    case "apollo_results_rejected_by_mapping":
      return "ApolloResultsRejectedByMapping"
    case "apollo_results_rejected_by_icp_title":
      return "ApolloResultsRejectedByIcpTitle"
    case "apollo_results_rejected_by_canonical_sync":
      return "ApolloResultsRejectedByCanonicalSync"
    case "apollo_results_missing_contact_channels":
      return "ApolloResultsMissingContactChannels"
    case "apollo_results_rejected_non_person_rows":
      return "ApolloResultsRejectedNonPersonRows"
    case "apollo_success":
      return "ApolloSuccess"
  }
}

function providerClassificationPhase(
  classification: ApolloLivePilotProviderEvidence["classification"],
): string {
  return `contact_discovery_${classification}`
}

function collectApolloDiscoveryErrors(
  apolloOutcome: GrowthContactDiscoveryProviderOutcome | null,
  providerEvidence: ApolloLivePilotProviderEvidence | null,
  fallbackMessage: string | null,
): string[] {
  const errors: string[] = []

  if (!apolloOutcome) {
    const message = fallbackMessage ?? "Apollo provider outcome missing from contact discovery."
    logApolloLivePilotFailure({
      phase: "contact_discovery_apollo_outcome",
      error_name: "ApolloOutcomeMissing",
      error_message: message,
    })
    errors.push(formatApolloLivePilotFailureForEvidence("contact_discovery_apollo_outcome", "ApolloOutcomeMissing", message))
    return errors
  }

  if (apolloOutcome.status === "skipped") {
    const message = apolloOutcome.message ?? apolloOutcome.provider_error ?? "Apollo discovery skipped."
    logApolloLivePilotFailure({
      phase: "contact_discovery_apollo_skipped",
      error_name: "ApolloSkipped",
      error_message: message,
    })
    errors.push(formatApolloLivePilotFailureForEvidence("contact_discovery_apollo_skipped", "ApolloSkipped", message))
    return errors
  }

  if (apolloOutcome.status === "failed") {
    const message = apolloOutcome.provider_error ?? apolloOutcome.message ?? "Apollo discovery failed."
    logApolloLivePilotFailure({
      phase: "contact_discovery_apollo_failed",
      error_name: "ApolloFailed",
      error_message: message,
    })
    errors.push(formatApolloLivePilotFailureForEvidence("contact_discovery_apollo_failed", "ApolloFailed", message))
    return errors
  }

  if (providerEvidence) {
    const discoveryError = buildApolloLivePilotProviderDiscoveryError(providerEvidence)
    if (discoveryError) {
      logApolloLivePilotFailure({
        phase: providerClassificationPhase(providerEvidence.classification),
        error_name: providerClassificationErrorName(providerEvidence.classification),
        error_message: discoveryError,
      })
      errors.push(discoveryError)
    }
    return errors
  }

  if ((apolloOutcome.contacts_returned ?? 0) === 0) {
    const message = apolloOutcome.message ?? "Apollo returned zero contacts."
    logApolloLivePilotFailure({
      phase: "contact_discovery_apollo_zero_results",
      error_name: "ApolloZeroResults",
      error_message: message,
    })
    errors.push(
      formatApolloLivePilotFailureForEvidence("contact_discovery_apollo_zero_results", "ApolloZeroResults", message),
    )
  }

  return errors
}

function buildApolloLivePilotEvidence(input: {
  started: number
  env: NodeJS.ProcessEnv
  company_candidate_id: string
  companyContext: {
    company_name: string
    domain: string | null
    canonical_company_id: string | null
  }
  canonical_company_id: string | null
  errors: string[]
  apolloContacts: GrowthContactDiscoverySnapshot["contacts"]
  apolloOutcome: GrowthContactDiscoveryProviderOutcome | null
  sync: SyncContactCandidatesToCompanyContactsResult
  backfill: { persons_linked: number; rows_processed: number }
  contactQuality: ApolloLivePilotEvidence["contact_quality"]
  readinessFunnel: ApolloLivePilotEvidence["readiness_funnel"]
  providerEvidence: ApolloLivePilotProviderEvidence | null
}): ApolloLivePilotEvidence {
  const guardrails = getApolloRunGuardrailSnapshot()
  const config = diagnoseApolloContactDiscoveryConfig(input.env)
  const provider = input.providerEvidence
  const irrelevantTitleSkipped = provider?.rejection_reasons.irrelevant_title ?? 0

  return {
    qa_marker: APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER,
    pilot_at: new Date().toISOString(),
    mock: config.mock_mode,
    company: {
      canonical_company_id: input.canonical_company_id || null,
      company_candidate_id: input.company_candidate_id,
      company_name: input.companyContext.company_name,
      domain: input.companyContext.domain,
    },
    runtime: {
      duration_ms: Date.now() - input.started,
      api_calls: guardrails?.search_api_calls ?? 0,
      credits_consumed: guardrails?.credits_estimate ?? 0,
      errors: input.errors,
    },
    discovery: {
      raw_contacts_returned: provider?.apollo_people_returned ?? input.apolloContacts.length,
      contacts_mapped: provider?.apollo_people_mapped ?? input.apolloContacts.length,
      contacts_skipped: provider?.apollo_people_rejected ?? 0,
      contacts_rejected: provider?.apollo_people_rejected ?? 0,
      candidates_stored: input.apolloContacts.length,
      company_contacts_synced: input.sync.synced,
    },
    provider: input.providerEvidence,
    canonical_matching: {
      company: {
        matched:
          input.canonical_company_id && input.sync.resolution?.ready !== false ? 1 : 0,
        created: 0,
        deduped: 0,
        rejected: input.canonical_company_id ? 0 : 1,
      },
      person: {
        matched: 0,
        created: input.backfill.persons_linked,
        deduped: Math.max(0, input.backfill.rows_processed - input.backfill.persons_linked),
        rejected:
          input.providerEvidence?.classification === "apollo_results_missing_contact_channels"
            ? 0
            : Math.max(0, input.apolloContacts.length - input.sync.synced),
      },
    },
    contact_quality: {
      ...input.contactQuality,
      irrelevant_title_skipped: irrelevantTitleSkipped,
    },
    research_pipeline: {
      company_intelligence_present: input.readinessFunnel.research_complete > 0,
      buying_committee_present: input.contactQuality.buying_committee_relevant > 0,
      fit_score_present: input.readinessFunnel.score_available > 0,
      relationship_intelligence_present: false,
      next_best_action_present: false,
      automated_flow_confirmed:
        input.apolloContacts.length > 0 &&
        input.sync.synced > 0 &&
        input.backfill.persons_linked > 0,
    },
    readiness_funnel: input.readinessFunnel,
  }
}

export async function runApolloLivePilotAi2(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    created_by?: string | null
    contact_limit?: number
    env?: NodeJS.ProcessEnv
  },
): Promise<{ ok: boolean; evidence: ApolloLivePilotEvidence | null; error: string | null }> {
  const env = input.env ?? process.env
  const allowed = assertApolloAi2LivePilotAllowed(env)
  if (!allowed.ok) {
    return { ok: false, evidence: null, error: allowed.error }
  }

  const company_candidate_id = input.company_candidate_id.trim()
  if (!company_candidate_id) {
    return { ok: false, evidence: null, error: "company_candidate_id is required." }
  }

  const started = Date.now()
  const errors: string[] = []
  beginApolloRunGuardrails()

  try {
    const companyContext = await loadCompanyContext(admin, company_candidate_id)
    console.info(
      JSON.stringify({
        source: "growth-engine",
        event: "apollo_live_pilot_runner_trace",
        ts: new Date().toISOString(),
        phase: "before_contact_discovery",
        company_candidate_id,
        company_domain: companyContext.domain,
        company_name: companyContext.company_name,
        exited_before_apollo_request: false,
        search_skip_note:
          !companyContext.domain && !companyContext.company_name.trim()
            ? "Both company_domain and company_name empty — Apollo search will skip before HTTP."
            : !companyContext.domain
              ? "company_domain is null — Apollo HTTP may still run but q_organization_domains_list is not sent."
              : null,
      }),
    )
    let canonical_company_id =
      companyContext.canonical_company_id ||
      (await fetchStagingCanonicalCompanyId(admin, company_candidate_id))

    let discoveryResult: Awaited<ReturnType<typeof runApolloLivePilotContactDiscovery>>
    try {
      discoveryResult = await runApolloLivePilotContactDiscovery(admin, {
        company_candidate_id,
        company_name: companyContext.company_name,
        domain: companyContext.domain,
        website_url: companyContext.website_url,
        created_by: input.created_by ?? null,
        limit: input.contact_limit ?? 10,
      })
    } catch (error) {
      logApolloLivePilotError("runContactDiscoveryForCompany", error)
      errors.push(formatApolloLivePilotErrorForEvidence("runContactDiscoveryForCompany", error))
      const contactQuality = await collectContactQuality(admin, company_candidate_id)
      const evidence = buildApolloLivePilotEvidence({
        started,
        env,
        company_candidate_id,
        companyContext,
        canonical_company_id,
        errors,
        apolloContacts: [],
        apolloOutcome: null,
        sync: { synced: 0, created: 0, updated: 0, resolution: null, canonical_sync_attempted: false, rejection_reasons: {} },
        backfill: { persons_linked: 0, rows_processed: 0 },
        contactQuality,
        readinessFunnel: {
          imported: 0,
          research_complete: 0,
          score_available: 0,
          contactable: 0,
          sequence_ready: 0,
        },
        providerEvidence: null,
      })
      return {
        ok: false,
        evidence,
        error: formatApolloLivePilotErrorForEvidence("runContactDiscoveryForCompany", error),
      }
    }

    const apolloOutcome = discoveryResult.apollo_outcome
    const apolloContacts = discoveryResult.apollo_contacts
    const fallbackMessage =
      discoveryResult.snapshot.provider_messages.find((message) =>
        message.toLowerCase().startsWith("apollo:"),
      ) ??
      discoveryResult.snapshot.provider_messages[0] ??
      null

    let sync: SyncContactCandidatesToCompanyContactsResult
    try {
      sync = await syncContactCandidatesToCompanyContactsWithResolution(admin, {
        company_candidate_id,
        canonical_company_id: canonical_company_id || null,
        candidates: apolloContacts,
        require_contact_channel: true,
      })
    } catch (error) {
      logApolloLivePilotError("syncContactCandidatesToCompanyContacts", error)
      errors.push(formatApolloLivePilotErrorForEvidence("syncContactCandidatesToCompanyContacts", error))
      sync = {
        synced: 0,
        created: 0,
        updated: 0,
        resolution: null,
        canonical_sync_attempted: false,
        rejection_reasons: {},
      }
    }

    const providerEvidence = buildApolloLivePilotProviderEvidence({
      provider_result: discoveryResult.apollo_provider_result,
      candidates_stored: apolloContacts.length,
      company_contacts_synced: sync.synced,
      canonical_sync_rejected: Math.max(0, apolloContacts.length - sync.synced),
      canonical_sync_attempted: sync.canonical_sync_attempted,
      canonical_sync_rejection_reasons: sync.rejection_reasons,
      candidates: apolloContacts,
    })
    logApolloLivePilotProviderEvidence(providerEvidence)
    errors.push(...collectApolloDiscoveryErrors(apolloOutcome, providerEvidence, fallbackMessage))

    const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
      company_candidate_id,
      canonical_company_id,
      mode: "apply",
    })

    const linkage = await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id, {
      explicit_canonical_company_id: canonical_company_id || null,
    })
    if (linkage.canonical_company_id) canonical_company_id = linkage.canonical_company_id

    const contactQuality = await collectContactQuality(admin, company_candidate_id)
    const readinessFunnel = await collectReadinessFunnel(
      admin,
      canonical_company_id,
      sync.synced,
    )

    const evidence = buildApolloLivePilotEvidence({
      started,
      env,
      company_candidate_id,
      companyContext,
      canonical_company_id,
      errors,
      apolloContacts,
      apolloOutcome,
      sync,
      backfill,
      contactQuality,
      readinessFunnel,
      providerEvidence,
    })

    const apolloPeopleMapped = providerEvidence?.apollo_people_mapped ?? 0
    return {
      ok: errors.length === 0 && (apolloContacts.length > 0 || apolloPeopleMapped > 0),
      evidence,
      error: null,
    }
  } catch (error) {
    logApolloLivePilotError("runApolloLivePilotAi2", error)
    return {
      ok: false,
      evidence: null,
      error: formatApolloLivePilotErrorForEvidence("runApolloLivePilotAi2", error),
    }
  } finally {
    resetApolloRunGuardrails()
  }
}
