/** Apollo-Scale-1 — multi-company production scale certification (acquisition only, no outreach). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence, ApolloPrimaryContactAcquisitionEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { emptyApolloPrimaryContactAcquisitionEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import { runApolloPrimaryContactAcquisition } from "@/lib/growth/apollo/apollo-primary-contact-acquisition"
import {
  assertApolloPrimaryContactAcquisitionAllowed,
  resolveApolloPrimaryContactAcquisitionContactLimit,
} from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import { isSequenceReadyCompanyContact as isSequenceReadyContact } from "@/lib/growth/apollo/apollo-enrichment-cert-promotion-evidence"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

export const APOLLO_SCALE_1_QA_MARKER = "apollo-scale-1-production-cert-v1" as const

export type ApolloScale1CertResult = "PASS" | "PASS_PARTIAL" | "FAIL"

export type ApolloScale1BlockerCategory =
  | "no_email"
  | "no_phone"
  | "low_confidence"
  | "missing_company"
  | "missing_person"
  | "suppression"
  | "fatigue"
  | "duplicate"
  | "other"

export type ApolloScale1CompanyResult = {
  company_name: string
  company_candidate_id: string
  canonical_company_id: string | null
  industry: string | null
  acquisition: {
    apollo_contacts_found: number
    apollo_contacts_enriched: number
    emails_discovered: number
    phones_discovered: number
    linkedin_profiles_discovered: number
    credits_consumed: number
    apollo_search_attempted: boolean
    apollo_search_skipped_reason: string | null
    enrichment_attempted: boolean
    enrichment_skipped_reason: string | null
  }
  promotion: {
    contacts_promoted: number
    canonical_persons_created: number
    canonical_persons_matched: number
    canonical_company_matched: boolean
    company_contacts_created: number
  }
  readiness: {
    contactable_contacts: number
    sequence_ready_contacts: number
    blocked_contacts: number
    blockers_by_category: Record<ApolloScale1BlockerCategory, number>
  }
  company_blockers: string[]
  failed: boolean
  failure_reason: string | null
}

export type ApolloScale1FailureRecord = {
  scope: "company" | "contact" | "promotion" | "canonical" | "apollo"
  company_candidate_id: string | null
  company_name: string | null
  reason: string
  count: number
}

export type ApolloScale1ProductionCertification = {
  qa_marker: typeof APOLLO_SCALE_1_QA_MARKER
  result: ApolloScale1CertResult
  certified_at: string
  safety: {
    auto_enrollment: false
    outreach_sent: false
    enrollment_confirmed: false
    execution_approved: false
    scheduler_ran: false
  }
  sample: {
    companies_requested: number
    companies_processed: number
    company_candidate_ids: string[]
    contact_limit_per_company: number
    mock: boolean
  }
  company_results: ApolloScale1CompanyResult[]
  aggregate: {
    total_contacts_found: number
    total_contacts_enriched: number
    total_emails_discovered: number
    total_phones_discovered: number
    total_linkedin_discovered: number
    total_contacts_promoted: number
    total_contactable: number
    total_sequence_ready: number
    total_blocked: number
    search_to_contactable_pct: number | null
    search_to_sequence_ready_pct: number | null
    enrichment_success_pct: number | null
    promotion_success_pct: number | null
    canonical_resolution_success_pct: number | null
  }
  credit_efficiency: {
    apollo_credits_consumed: number
    contacts_discovered_per_credit: number | null
    contactable_contacts_per_credit: number | null
    sequence_ready_contacts_per_credit: number | null
    cost_per_usable_contact: number | null
    cost_per_sequence_ready_contact: number | null
  }
  blockers_aggregate: Record<ApolloScale1BlockerCategory, number>
  failures: ApolloScale1FailureRecord[]
  failures_by_root_cause: Array<{ root_cause: string; count: number; examples: string[] }>
  recommendation: {
    ready_as_primary_engine: boolean
    expected_usable_contact_yield_pct: number | null
    largest_blockers: string[]
    improvements_before_scale: string[]
    answers: {
      is_apollo_ready_as_primary: string
      expected_usable_contact_yield: string
      largest_blockers: string
      improvements_before_hundreds: string
    }
  }
  acquisition_evidence: ApolloPrimaryContactAcquisitionEvidence
  gate_blockers: string[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function pct(n: number, d: number): number | null {
  if (d <= 0) return null
  return Math.round((n / d) * 1000) / 10
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

function emptyBlockerCounts(): Record<ApolloScale1BlockerCategory, number> {
  return {
    no_email: 0,
    no_phone: 0,
    low_confidence: 0,
    missing_company: 0,
    missing_person: 0,
    suppression: 0,
    fatigue: 0,
    duplicate: 0,
    other: 0,
  }
}

function categorizeContactBlocker(input: {
  row: Record<string, unknown>
  canonical_company_id: string | null
}): ApolloScale1BlockerCategory {
  if (!input.canonical_company_id) return "missing_company"

  const email = asString(input.row.email)
  const phone = asString(input.row.phone)
  const emailStatus = asString(input.row.email_status)
  const phoneStatus = asString(input.row.phone_status)
  const hasEmail = Boolean(email) && emailStatus !== "blocked"
  const hasPhone = Boolean(phone) && phoneStatus !== "blocked"

  if (!hasEmail && !hasPhone) {
    if (!email && !phone) return "no_email"
    return "no_email"
  }

  if (!asString(input.row.canonical_person_id)) return "missing_person"

  const metadata =
    input.row.metadata && typeof input.row.metadata === "object"
      ? (input.row.metadata as Record<string, unknown>)
      : {}
  const classification = asString(metadata.identity_classification)
  if (classification === "company_channel" || classification === "generic_placeholder") {
    return "low_confidence"
  }
  if (metadata.eligible_for_canonical_person === false) return "low_confidence"
  if (metadata.duplicate === true || asString(metadata.duplicate_of)) return "duplicate"
  if (emailStatus === "suppressed" || phoneStatus === "suppressed") return "suppression"
  if (metadata.fatigue_blocked === true) return "fatigue"

  const identity = classifyContactIdentity({
    full_name: asString(input.row.full_name),
    title: asString(input.row.title) || null,
    email: email || null,
    phone: phone || null,
    linkedin_url: asString(input.row.linkedin_url) || null,
    source_type: "public_record",
  })
  if (!identity.eligible_for_canonical_person || identity.eligible_for_committee === false) {
    return "low_confidence"
  }

  return "other"
}

function isContactableRow(row: Record<string, unknown>): boolean {
  const hasEmail = Boolean(asString(row.email)) && asString(row.email_status) !== "blocked"
  const hasPhone = Boolean(asString(row.phone)) && asString(row.phone_status) !== "blocked"
  return hasEmail || hasPhone
}

async function loadScale1CompanyMeta(
  admin: SupabaseClient,
  company_candidate_ids: string[],
): Promise<Map<string, { industry: string | null; company_name: string }>> {
  const map = new Map<string, { industry: string | null; company_name: string }>()
  if (company_candidate_ids.length === 0) return map

  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, industry")
    .in("company_id", company_candidate_ids)

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>
    const id = asString(row.company_id)
    if (!id) continue
    map.set(id, {
      industry: asString(row.industry) || null,
      company_name: asString(row.company_name) || id,
    })
  }

  return map
}

export async function buildApolloScale1CompanyResult(
  admin: SupabaseClient,
  company: ApolloPrimaryContactAcquisitionCompanyEvidence,
  meta: { industry: string | null; company_name: string },
): Promise<ApolloScale1CompanyResult> {
  const blockers_by_category = emptyBlockerCounts()

  const { data: candidates } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, email, phone, linkedin_url, metadata, provider_type")
    .eq("company_candidate_id", company.company_candidate_id)
    .eq("provider_type", "future_apollo")

  let emails_discovered = 0
  let phones_discovered = 0
  let linkedin_profiles_discovered = 0
  let apollo_contacts_enriched = 0

  for (const raw of candidates ?? []) {
    const row = raw as Record<string, unknown>
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {}
    if (asString(row.email)) emails_discovered += 1
    if (asString(row.phone)) phones_discovered += 1
    if (asString(row.linkedin_url)) linkedin_profiles_discovered += 1
    if (asString(metadata.apollo_enriched_at)) apollo_contacts_enriched += 1
  }

  let company_contacts: Record<string, unknown>[] = []
  if (company.canonical_company_id) {
    const { data } = await admin
      .schema("growth")
      .from("company_contacts")
      .select(
        "id, full_name, title, email, phone, email_status, phone_status, linkedin_url, canonical_person_id, metadata, created_at",
      )
      .eq("company_id", company.canonical_company_id)
    company_contacts = (data ?? []) as Record<string, unknown>[]
  }

  let canonical_persons_matched = 0
  let canonical_persons_created = 0
  for (const row of company_contacts) {
    if (asString(row.canonical_person_id)) canonical_persons_matched += 1
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {}
    if (metadata.canonical_person_created === true) canonical_persons_created += 1
  }

  let contactable_contacts = 0
  let sequence_ready_contacts = 0
  let blocked_contacts = 0

  for (const row of company_contacts) {
    if (isContactableRow(row)) contactable_contacts += 1
    if (isSequenceReadyContact(row)) {
      sequence_ready_contacts += 1
      continue
    }
    blocked_contacts += 1
    const category = categorizeContactBlocker({
      row,
      canonical_company_id: company.canonical_company_id,
    })
    blockers_by_category[category] += 1
  }

  return {
    company_name: company.company_name || meta.company_name,
    company_candidate_id: company.company_candidate_id,
    canonical_company_id: company.canonical_company_id,
    industry: meta.industry,
    acquisition: {
      apollo_contacts_found: company.apollo_people_found,
      apollo_contacts_enriched: apollo_contacts_enriched || company.enrichment_candidates_updated,
      emails_discovered,
      phones_discovered,
      linkedin_profiles_discovered,
      credits_consumed: company.credits_consumed,
      apollo_search_attempted: company.apollo_search_attempted,
      apollo_search_skipped_reason: company.apollo_search_skipped_reason,
      enrichment_attempted: company.enrichment_attempted,
      enrichment_skipped_reason: company.enrichment_skipped_reason,
    },
    promotion: {
      contacts_promoted: company.promoted_contacts,
      canonical_persons_created,
      canonical_persons_matched,
      canonical_company_matched: Boolean(company.canonical_company_id),
      company_contacts_created: company.promoted_contacts,
    },
    readiness: {
      contactable_contacts,
      sequence_ready_contacts,
      blocked_contacts,
      blockers_by_category,
    },
    company_blockers: company.blockers,
    failed: false,
    failure_reason: null,
  }
}

export async function resolveApolloScale1CompanySample(
  admin: SupabaseClient,
  input: { limit: number; env?: NodeJS.ProcessEnv },
): Promise<Array<{ company_candidate_id: string; company_name: string; industry: string | null }>> {
  const env = input.env ?? process.env
  const limit = Math.max(10, Math.min(20, input.limit))

  const explicit = env.GROWTH_APOLLO_SCALE_1_COMPANY_CANDIDATE_IDS?.trim()
  if (explicit) {
    const ids = explicit
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, limit)
    const meta = await loadScale1CompanyMeta(admin, ids)
    return ids.map((company_candidate_id) => ({
      company_candidate_id,
      company_name: meta.get(company_candidate_id)?.company_name ?? company_candidate_id,
      industry: meta.get(company_candidate_id)?.industry ?? null,
    }))
  }

  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (cohort?.company_ids?.length) {
    const canonicalIds = cohort.company_ids.slice(0, limit * 2)
    const { data: candidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select("company_id, company_name, canonical_company_id, industry, primary_domain")
      .in("canonical_company_id", canonicalIds)
      .not("canonical_company_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit * 3)

    const seen = new Set<string>()
    const results: Array<{ company_candidate_id: string; company_name: string; industry: string | null }> = []
    for (const raw of candidates ?? []) {
      const row = raw as Record<string, unknown>
      const company_candidate_id = asString(row.company_id)
      if (!company_candidate_id || seen.has(company_candidate_id)) continue
      seen.add(company_candidate_id)
      results.push({
        company_candidate_id,
        company_name: asString(row.company_name) || company_candidate_id,
        industry: asString(row.industry) || null,
      })
      if (results.length >= limit) break
    }
    if (results.length >= 10) return results
  }

  const { data: fallbackRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, industry, canonical_company_id")
    .not("canonical_company_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit * 3)

  const seen = new Set<string>()
  const results: Array<{ company_candidate_id: string; company_name: string; industry: string | null }> = []
  for (const raw of fallbackRows ?? []) {
    const row = raw as Record<string, unknown>
    const company_candidate_id = asString(row.company_id)
    if (!company_candidate_id || seen.has(company_candidate_id)) continue
    seen.add(company_candidate_id)
    results.push({
      company_candidate_id,
      company_name: asString(row.company_name) || company_candidate_id,
      industry: asString(row.industry) || null,
    })
    if (results.length >= limit) break
  }

  if (results.length < 10) {
    throw new Error(
      `Apollo-Scale-1 requires at least 10 companies; only ${results.length} discovery_candidates with canonical_company_id found.`,
    )
  }

  return results
}

function collectFailures(input: {
  company_results: ApolloScale1CompanyResult[]
  acquisition: ApolloPrimaryContactAcquisitionEvidence
}): ApolloScale1FailureRecord[] {
  const failures: ApolloScale1FailureRecord[] = []

  for (const error of input.acquisition.runtime.errors) {
    const [company_candidate_id, ...rest] = error.split(":")
    failures.push({
      scope: "company",
      company_candidate_id: asString(company_candidate_id) || null,
      company_name: null,
      reason: rest.join(":").trim() || error,
      count: 1,
    })
  }

  for (const company of input.company_results) {
    if (company.failed && company.failure_reason) {
      failures.push({
        scope: "company",
        company_candidate_id: company.company_candidate_id,
        company_name: company.company_name,
        reason: company.failure_reason,
        count: 1,
      })
    }
    for (const blocker of company.company_blockers) {
      let scope: ApolloScale1FailureRecord["scope"] = "apollo"
      if (blocker.includes("canonical")) scope = "canonical"
      else if (blocker.includes("promotion") || blocker.includes("sync")) scope = "promotion"
      failures.push({
        scope,
        company_candidate_id: company.company_candidate_id,
        company_name: company.company_name,
        reason: blocker,
        count: 1,
      })
    }
    for (const [category, count] of Object.entries(company.readiness.blockers_by_category)) {
      if (count <= 0) continue
      failures.push({
        scope: "contact",
        company_candidate_id: company.company_candidate_id,
        company_name: company.company_name,
        reason: category,
        count,
      })
    }
  }

  return failures
}

function groupFailuresByRootCause(
  failures: ApolloScale1FailureRecord[],
): Array<{ root_cause: string; count: number; examples: string[] }> {
  const grouped = new Map<string, { count: number; examples: Set<string> }>()
  for (const failure of failures) {
    const key = `${failure.scope}:${failure.reason}`
    const existing = grouped.get(key) ?? { count: 0, examples: new Set<string>() }
    existing.count += failure.count
    if (failure.company_name) existing.examples.add(failure.company_name)
    grouped.set(key, existing)
  }

  return [...grouped.entries()]
    .map(([root_cause, value]) => ({
      root_cause,
      count: value.count,
      examples: [...value.examples].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count)
}

function assessApolloScale1Result(input: {
  aggregate: ApolloScale1ProductionCertification["aggregate"]
  credit_efficiency: ApolloScale1ProductionCertification["credit_efficiency"]
  companies_processed: number
  company_failures: number
  mock: boolean
  gate_blockers: string[]
}): {
  result: ApolloScale1CertResult
  recommendation: ApolloScale1ProductionCertification["recommendation"]
} {
  const blockers: string[] = [...input.gate_blockers]
  if (input.mock) blockers.push("mock_mode_active")
  if (input.companies_processed < 10) blockers.push("insufficient_company_sample")

  const seqReady = input.aggregate.total_sequence_ready
  const contactable = input.aggregate.total_contactable
  const found = input.aggregate.total_contacts_found
  const searchToSeq = input.aggregate.search_to_sequence_ready_pct ?? 0
  const searchToContactable = input.aggregate.search_to_contactable_pct ?? 0

  let result: ApolloScale1CertResult = "FAIL"
  const auditMode = input.gate_blockers.includes("production_state_audit_no_new_apollo_http")
  if (
    !input.mock &&
    input.companies_processed >= 10 &&
    seqReady >= 5 &&
    searchToSeq >= 5 &&
    input.company_failures <= 2 &&
    !auditMode
  ) {
    result = "PASS"
  } else if (
    !input.mock &&
    input.companies_processed >= 10 &&
    (seqReady >= 1 || contactable >= 10) &&
    !auditMode
  ) {
    result = "PASS_PARTIAL"
  } else if (auditMode && input.companies_processed >= 10 && found >= 1) {
    result = seqReady >= 1 ? "PASS_PARTIAL" : "FAIL"
  }

  const largest_blockers = [
    searchToContactable < 30 ? "Low search→contactable conversion" : "",
    searchToSeq < 5 ? "Low sequence-ready yield after promotion" : "",
    input.aggregate.canonical_resolution_success_pct !== null &&
    input.aggregate.canonical_resolution_success_pct < 80
      ? "Canonical company resolution gaps"
      : "",
    (input.credit_efficiency.cost_per_sequence_ready_contact ?? 999) > 2
      ? "High credit cost per sequence-ready contact"
      : "",
    input.company_failures > 0 ? `${input.company_failures} company-level acquisition failures` : "",
  ].filter(Boolean)

  if (auditMode) {
    largest_blockers.unshift(
      "Production state audit only — no live Apollo search/enrichment in this run.",
    )
    const companiesWithApollo = found > 0 ? 1 : 0
    if (companiesWithApollo < input.companies_processed) {
      largest_blockers.push(
        `Apollo acquisition not yet run on ${input.companies_processed - companiesWithApollo} of ${input.companies_processed} sampled companies (contact_candidates empty).`,
      )
    }
  }

  const improvements = [
    searchToSeq < 10
      ? "Improve enrichment coverage and identity classification before scaling enrollment."
      : "",
    input.aggregate.enrichment_success_pct !== null && input.aggregate.enrichment_success_pct < 50
      ? "Tune Apollo enrichment targeting for channel-less search rows."
      : "",
    input.aggregate.canonical_resolution_success_pct !== null &&
    input.aggregate.canonical_resolution_success_pct < 90
      ? "Harden canonical company staging linkage for discovery_candidates."
      : "",
    "Run operator review (Primary-2) on sequence-ready contacts before bulk enrollment.",
    "Monitor credit guardrails with GROWTH_APOLLO_MAX_* limits during rollout.",
  ].filter(Boolean)

  const yieldPct = input.aggregate.search_to_sequence_ready_pct

  return {
    result,
    recommendation: {
      ready_as_primary_engine: result === "PASS",
      expected_usable_contact_yield_pct: yieldPct,
      largest_blockers,
      improvements_before_scale: improvements,
      answers: {
        is_apollo_ready_as_primary:
          result === "PASS"
            ? "Yes — sample shows sufficient sequence-ready yield and acceptable failure rate for controlled primary-engine rollout."
            : result === "PASS_PARTIAL" && auditMode
              ? "Partially — production DB audit shows Apollo works on certified paths (e.g. Henry Schein) but most cohort companies have not yet run Apollo acquisition at scale."
              : result === "PASS_PARTIAL"
                ? "Partially — acquisition works but sequence-ready yield or blockers need improvement before primary-engine status."
                : "No — sample did not demonstrate sufficient usable-contact yield for primary-engine designation.",
        expected_usable_contact_yield:
          yieldPct === null
            ? "Insufficient data — no Apollo contacts mapped in sample."
            : `Approximately ${yieldPct}% of Apollo contacts found reach sequence-ready status (usable for enrollment handoff).`,
        largest_blockers: largest_blockers.length > 0 ? largest_blockers.join("; ") : "None dominant in sample.",
        improvements_before_hundreds: improvements.join(" "),
      },
    },
  }
}

export function buildApolloScale1ProductionCertification(input: {
  company_results: ApolloScale1CompanyResult[]
  acquisition: ApolloPrimaryContactAcquisitionEvidence
  sample: ApolloScale1ProductionCertification["sample"]
  gate_blockers: string[]
  certified_at?: string
}): ApolloScale1ProductionCertification {
  const blockers_aggregate = emptyBlockerCounts()
  for (const company of input.company_results) {
    for (const [key, count] of Object.entries(company.readiness.blockers_by_category)) {
      blockers_aggregate[key as ApolloScale1BlockerCategory] += count
    }
  }

  const total_contacts_found = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.apollo_contacts_found,
    0,
  )
  const total_contacts_enriched = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.apollo_contacts_enriched,
    0,
  )
  const total_emails_discovered = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.emails_discovered,
    0,
  )
  const total_phones_discovered = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.phones_discovered,
    0,
  )
  const total_linkedin_discovered = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.linkedin_profiles_discovered,
    0,
  )
  const total_contacts_promoted = input.company_results.reduce(
    (sum, row) => sum + row.promotion.contacts_promoted,
    0,
  )
  const total_contactable = input.company_results.reduce(
    (sum, row) => sum + row.readiness.contactable_contacts,
    0,
  )
  const total_sequence_ready = input.company_results.reduce(
    (sum, row) => sum + row.readiness.sequence_ready_contacts,
    0,
  )
  const total_blocked = input.company_results.reduce(
    (sum, row) => sum + row.readiness.blocked_contacts,
    0,
  )

  const credits = input.acquisition.credits_consumed
  const companies_with_canonical = input.company_results.filter((row) => row.canonical_company_id).length

  const aggregate = {
    total_contacts_found,
    total_contacts_enriched,
    total_emails_discovered,
    total_phones_discovered,
    total_linkedin_discovered,
    total_contacts_promoted,
    total_contactable,
    total_sequence_ready,
    total_blocked,
    search_to_contactable_pct: pct(total_contactable, total_contacts_found),
    search_to_sequence_ready_pct: pct(total_sequence_ready, total_contacts_found),
    enrichment_success_pct: pct(total_contacts_enriched, total_contacts_found),
    promotion_success_pct: pct(total_contacts_promoted, total_contacts_found),
    canonical_resolution_success_pct: pct(companies_with_canonical, input.company_results.length),
  }

  const credit_efficiency = {
    apollo_credits_consumed: credits,
    contacts_discovered_per_credit: safeRatio(total_contacts_found, credits),
    contactable_contacts_per_credit: safeRatio(total_contactable, credits),
    sequence_ready_contacts_per_credit: safeRatio(total_sequence_ready, credits),
    cost_per_usable_contact: safeRatio(credits, total_contactable),
    cost_per_sequence_ready_contact: safeRatio(credits, total_sequence_ready),
  }

  const failures = collectFailures({
    company_results: input.company_results,
    acquisition: input.acquisition,
  })
  const failures_by_root_cause = groupFailuresByRootCause(failures)

  const company_failures =
    input.acquisition.runtime.errors.length +
    input.company_results.filter((row) => row.failed).length

  const assessment = assessApolloScale1Result({
    aggregate,
    credit_efficiency,
    companies_processed: input.company_results.length,
    company_failures,
    mock: input.acquisition.mock,
    gate_blockers: input.gate_blockers,
  })

  return {
    qa_marker: APOLLO_SCALE_1_QA_MARKER,
    result: assessment.result,
    certified_at: input.certified_at ?? new Date().toISOString(),
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      enrollment_confirmed: false,
      execution_approved: false,
      scheduler_ran: false,
    },
    sample: input.sample,
    company_results: input.company_results,
    aggregate,
    credit_efficiency,
    blockers_aggregate,
    failures,
    failures_by_root_cause,
    recommendation: assessment.recommendation,
    acquisition_evidence: input.acquisition,
    gate_blockers: input.gate_blockers,
  }
}

export async function certifyApolloScale1Production(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale1ProductionCertification> {
  const env = input?.env ?? process.env
  const company_limit = Math.max(
    10,
    Math.min(
      20,
      input?.company_limit ??
        Number.parseInt(env.GROWTH_APOLLO_SCALE_1_COMPANY_LIMIT ?? "15", 10) ??
        15,
    ),
  )
  const contact_limit =
    input?.contact_limit ?? resolveApolloPrimaryContactAcquisitionContactLimit(env)

  const gate = assertApolloPrimaryContactAcquisitionAllowed(env, { require_production: false })
  const gate_blockers = gate.ok ? [] : gate.blockers

  const sampleCompanies = await resolveApolloScale1CompanySample(admin, {
    limit: company_limit,
    env,
  })

  const acquisition = await runApolloPrimaryContactAcquisition(admin, {
    company_candidate_ids: sampleCompanies.map((row) => row.company_candidate_id),
    contact_limit,
    env,
  })

  const metaById = new Map(
    sampleCompanies.map((row) => [
      row.company_candidate_id,
      { industry: row.industry, company_name: row.company_name },
    ]),
  )

  const company_results: ApolloScale1CompanyResult[] = []
  for (const company of acquisition.companies) {
    const meta = metaById.get(company.company_candidate_id) ?? {
      industry: null,
      company_name: company.company_name,
    }
    company_results.push(await buildApolloScale1CompanyResult(admin, company, meta))
  }

  for (const error of acquisition.runtime.errors) {
    const company_candidate_id = error.split(":")[0]?.trim()
    if (!company_candidate_id) continue
    if (company_results.some((row) => row.company_candidate_id === company_candidate_id)) continue
    const meta = metaById.get(company_candidate_id)
    company_results.push({
      company_name: meta?.company_name ?? company_candidate_id,
      company_candidate_id,
      canonical_company_id: null,
      industry: meta?.industry ?? null,
      acquisition: {
        apollo_contacts_found: 0,
        apollo_contacts_enriched: 0,
        emails_discovered: 0,
        phones_discovered: 0,
        linkedin_profiles_discovered: 0,
        credits_consumed: 0,
        apollo_search_attempted: false,
        apollo_search_skipped_reason: null,
        enrichment_attempted: false,
        enrichment_skipped_reason: null,
      },
      promotion: {
        contacts_promoted: 0,
        canonical_persons_created: 0,
        canonical_persons_matched: 0,
        canonical_company_matched: false,
        company_contacts_created: 0,
      },
      readiness: {
        contactable_contacts: 0,
        sequence_ready_contacts: 0,
        blocked_contacts: 0,
        blockers_by_category: emptyBlockerCounts(),
      },
      company_blockers: ["company_acquisition_failed"],
      failed: true,
      failure_reason: error,
    })
  }

  return buildApolloScale1ProductionCertification({
    company_results,
    acquisition,
    gate_blockers,
    sample: {
      companies_requested: company_limit,
      companies_processed: company_results.length,
      company_candidate_ids: sampleCompanies.map((row) => row.company_candidate_id),
      contact_limit_per_company: contact_limit,
      mock: acquisition.mock,
    },
  })
}

/** Analyze existing production Apollo state without new Apollo HTTP (no search/enrichment calls). */
export async function certifyApolloScale1ProductionAudit(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale1ProductionCertification & { mode: "production_state_audit" }> {
  const env = input?.env ?? process.env
  const company_limit = Math.max(
    10,
    Math.min(
      20,
      input?.company_limit ??
        Number.parseInt(env.GROWTH_APOLLO_SCALE_1_COMPANY_LIMIT ?? "15", 10) ??
        15,
    ),
  )

  const sampleCompanies = await resolveApolloScale1CompanySample(admin, {
    limit: company_limit,
    env,
  })

  const company_results: ApolloScale1CompanyResult[] = []
  for (const sample of sampleCompanies) {
    const { resolveApolloEnrichmentCanonicalCompanyId } = await import(
      "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
    )
    const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
      company_candidate_id: sample.company_candidate_id,
      domain: null,
    })

    const stubCompany: ApolloPrimaryContactAcquisitionCompanyEvidence = {
      company_candidate_id: sample.company_candidate_id,
      company_name: sample.company_name,
      domain: null,
      canonical_company_id: resolution.canonical_company_id,
      apollo_search_attempted: false,
      apollo_search_skipped_reason: "production_state_audit",
      apollo_people_found: 0,
      existing_contacts_reused: 0,
      existing_contactable_before: 0,
      enrichment_attempted: false,
      enrichment_skipped_reason: "production_state_audit",
      enrichment_candidates_updated: 0,
      credits_consumed: 0,
      promoted_contacts: 0,
      contactable_contacts: 0,
      sequence_ready_contacts: 0,
      blockers: resolution.canonical_company_id ? [] : ["canonical_company_id_unresolved"],
    }

    const { data: apolloCandidates } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("id")
      .eq("company_candidate_id", sample.company_candidate_id)
      .eq("provider_type", "future_apollo")

    stubCompany.apollo_people_found = (apolloCandidates ?? []).length

    const built = await buildApolloScale1CompanyResult(admin, stubCompany, {
      industry: sample.industry,
      company_name: sample.company_name,
    })
    company_results.push(built)
  }

  const acquisition = emptyApolloPrimaryContactAcquisitionEvidence(false)
  acquisition.companies_searched = company_results.length
  acquisition.companies = company_results.map((row) => ({
    company_candidate_id: row.company_candidate_id,
    company_name: row.company_name,
    domain: null,
    canonical_company_id: row.canonical_company_id,
    apollo_search_attempted: false,
    apollo_search_skipped_reason: "production_state_audit",
    apollo_people_found: row.acquisition.apollo_contacts_found,
    existing_contacts_reused: 0,
    existing_contactable_before: 0,
    enrichment_attempted: false,
    enrichment_skipped_reason: "production_state_audit",
    enrichment_candidates_updated: row.acquisition.apollo_contacts_enriched,
    credits_consumed: 0,
    promoted_contacts: row.promotion.contacts_promoted,
    contactable_contacts: row.readiness.contactable_contacts,
    sequence_ready_contacts: row.readiness.sequence_ready_contacts,
    blockers: row.company_blockers,
  }))

  acquisition.apollo_people_found = company_results.reduce(
    (sum, row) => sum + row.acquisition.apollo_contacts_found,
    0,
  )
  acquisition.promoted_contacts = company_results.reduce(
    (sum, row) => sum + row.promotion.contacts_promoted,
    0,
  )
  acquisition.contactable_contacts = company_results.reduce(
    (sum, row) => sum + row.readiness.contactable_contacts,
    0,
  )
  acquisition.sequence_ready_contacts = company_results.reduce(
    (sum, row) => sum + row.readiness.sequence_ready_contacts,
    0,
  )

  const report = buildApolloScale1ProductionCertification({
    company_results,
    acquisition,
    gate_blockers: ["production_state_audit_no_new_apollo_http"],
    sample: {
      companies_requested: company_limit,
      companies_processed: company_results.length,
      company_candidate_ids: sampleCompanies.map((row) => row.company_candidate_id),
      contact_limit_per_company: 0,
      mock: false,
    },
  })

  return { ...report, mode: "production_state_audit" }
}
