/** Apollo AI-2 controlled live pilot runner — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { syncContactCandidatesToCompanyContactsWithResolution } from "@/lib/growth/acquisition/sync-contact-candidates-to-company-contacts"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { ensureStagingCanonicalCompanyLinkage } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { fetchStagingCanonicalCompanyId } from "@/lib/growth/canonical-persons/canonical-person-repository-core"
import { runContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/contact-repository"
import { scoreDecisionMakerTitle } from "@/lib/growth/contact-discovery/decision-maker-score"
import type { ApolloLivePilotEvidence } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
import { APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER } from "@/lib/growth/apollo/apollo-live-pilot-evidence-types"
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

  let canonical_company_id: string | null = null
  if (row) {
    canonical_company_id = await fetchStagingCanonicalCompanyId(admin, company_candidate_id)
  }

  return {
    company_name: asString(row?.company_name) || company_candidate_id,
    domain,
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

    const discovery = await runContactDiscoveryForCompany(admin, {
      company_candidate_id,
      created_by: input.created_by ?? null,
      limit: input.contact_limit ?? 10,
      provider_types: ["future_apollo"],
    })

    const apolloOutcome = discovery.provider_outcomes.find((o) => o.provider === "apollo")
    const apolloContacts = discovery.contacts.filter((c) => c.provider_type === "future_apollo")

    if (apolloOutcome?.status === "failed") {
      errors.push(apolloOutcome.message ?? "apollo_discovery_failed")
    }

    const sync = await syncContactCandidatesToCompanyContactsWithResolution(admin, {
      company_candidate_id,
      canonical_company_id: canonical_company_id || null,
      candidates: apolloContacts,
    })

    const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
      company_candidate_id,
      canonical_company_id,
      mode: "apply",
    })

    const linkage = await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id, {
      explicit_canonical_company_id: canonical_company_id || null,
    })
    if (linkage.canonical_company_id) canonical_company_id = linkage.canonical_company_id

    const guardrails = getApolloRunGuardrailSnapshot()
    const config = diagnoseApolloContactDiscoveryConfig(env)
    const contactQuality = await collectContactQuality(admin, company_candidate_id)
    const readinessFunnel = await collectReadinessFunnel(
      admin,
      canonical_company_id,
      sync.synced,
    )

    const skippedFromMapper =
      typeof apolloOutcome?.metadata === "object" && apolloOutcome.metadata
        ? Number((apolloOutcome.metadata as Record<string, unknown>).contacts_skipped ?? 0)
        : 0

    const evidence: ApolloLivePilotEvidence = {
      qa_marker: APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER,
      pilot_at: new Date().toISOString(),
      mock: config.mock_mode,
      company: {
        canonical_company_id: canonical_company_id || null,
        company_candidate_id,
        company_name: companyContext.company_name,
        domain: companyContext.domain,
      },
      runtime: {
        duration_ms: Date.now() - started,
        api_calls: guardrails?.search_api_calls ?? 1,
        credits_consumed: guardrails?.credits_estimate ?? 0,
        errors,
      },
      discovery: {
        raw_contacts_returned: apolloContacts.length + skippedFromMapper,
        contacts_mapped: apolloContacts.length,
        contacts_skipped: skippedFromMapper,
        contacts_rejected: 0,
        candidates_stored: apolloContacts.length,
        company_contacts_synced: sync.synced,
      },
      canonical_matching: {
        company: {
          matched: canonical_company_id && sync.resolution?.ready !== false ? 1 : 0,
          created: 0,
          deduped: 0,
          rejected: canonical_company_id ? 0 : 1,
        },
        person: {
          matched: 0,
          created: backfill.persons_linked,
          deduped: Math.max(0, backfill.rows_processed - backfill.persons_linked),
          rejected: Math.max(0, apolloContacts.length - sync.synced),
        },
      },
      contact_quality: {
        ...contactQuality,
        irrelevant_title_skipped: skippedFromMapper,
      },
      research_pipeline: {
        company_intelligence_present: readinessFunnel.research_complete > 0,
        buying_committee_present: contactQuality.buying_committee_relevant > 0,
        fit_score_present: readinessFunnel.score_available > 0,
        relationship_intelligence_present: false,
        next_best_action_present: false,
        automated_flow_confirmed: apolloContacts.length > 0 && sync.synced > 0 && backfill.persons_linked > 0,
      },
      readiness_funnel: readinessFunnel,
    }

    return { ok: errors.length === 0 && apolloContacts.length > 0, evidence, error: null }
  } catch (error) {
    return {
      ok: false,
      evidence: null,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    resetApolloRunGuardrails()
  }
}
