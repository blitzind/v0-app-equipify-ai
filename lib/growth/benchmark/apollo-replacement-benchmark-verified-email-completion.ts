/** Phase 7.PS-IL — Benchmark-scoped verified email completion. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCorroboratedChannelRuntimeContext } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-runtime"
import { countOutreachReadyContactsForPersons } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { executeBenchmarkVerifiedEmailCandidate } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-execute"
import {
  persistBenchmarkVerifiedEmailQueue,
  waitForBenchmarkVerifiedEmailQueue,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-queue"
import { selectBenchmarkVerifiedEmailCandidates } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-selection"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
  type BenchmarkVerifiedEmailCandidateRow,
  type BenchmarkVerifiedEmailCompletionMetrics,
  type BenchmarkVerifiedEmailCompletionProvenance,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import {
  resolveGrowthDeployedRuntimeCronSecret,
  runDeployedBenchmarkVerifiedEmailQueue,
  runDeployedEmailDiscoveryCert,
} from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readDeployedDiscoveryCounts(body: Record<string, unknown> | null): {
  candidate_count: number
  verified_count: number
  promoted_count: number
} {
  const result =
    body?.result && typeof body.result === "object"
      ? (body.result as Record<string, unknown>)
      : body

  const asNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0

  return {
    candidate_count: asNumber(result?.candidate_count),
    verified_count: asNumber(result?.verified_count),
    promoted_count: asNumber(result?.promoted_count),
  }
}

async function verifyViaDeployedHttp(
  admin: SupabaseClient,
  candidate: BenchmarkVerifiedEmailCandidateRow,
  runtime: Awaited<ReturnType<typeof resolveCorroboratedChannelRuntimeContext>>,
): Promise<{
  attempted: boolean
  verified: boolean
  promoted: boolean
  provenance: BenchmarkVerifiedEmailCompletionProvenance
  messages: string[]
}> {
  const messages: string[] = []
  const base_url = runtime.deployed_base_url
  if (!base_url) {
    messages.push("email_skipped: deployed_base_url_unconfigured")
    return {
      attempted: false,
      verified: false,
      promoted: false,
      provenance: {
        provider: "zerobounce",
        deployed_runtime_used: false,
        execution_channel: "skipped",
        source_evidence: candidate.evidence_ref ?? candidate.email,
        contact_id: candidate.company_contact_id,
        email: candidate.email,
      },
      messages,
    }
  }

  const run = await runDeployedEmailDiscoveryCert({
    base_url,
    company_id: candidate.company_id,
    person_id: candidate.person_id,
    admin,
  })

  const counts = readDeployedDiscoveryCounts(run.body)
  const execution_channel =
    run.channel === "http" ? "deployed_http" : "deployed_vercel_cron"

  if (run.ok) {
    messages.push(
      `email_deployed_${execution_channel}: candidates=${counts.candidate_count} verified=${counts.verified_count} promoted=${counts.promoted_count}`,
    )
  } else {
    messages.push(`email_deployed_error: ${run.error ?? "unknown"}`)
  }

  return {
    attempted: true,
    verified: counts.verified_count > 0,
    promoted: counts.promoted_count > 0,
    provenance: {
      provider: "zerobounce",
      deployed_runtime_used: true,
      execution_channel,
      source_evidence: candidate.evidence_ref ?? candidate.email,
      contact_id: candidate.company_contact_id,
      email: candidate.email,
    },
    messages,
  }
}

async function resolveLinkedCandidates(
  admin: SupabaseClient,
  selected: BenchmarkVerifiedEmailCandidateRow[],
): Promise<{
  resolved: BenchmarkVerifiedEmailCandidateRow[]
  skipped: Array<{
    full_name: string
    email: string
    company_name: string
    messages: string[]
  }>
}> {
  const resolved: BenchmarkVerifiedEmailCandidateRow[] = []
  const skipped: Array<{
    full_name: string
    email: string
    company_name: string
    messages: string[]
  }> = []

  for (const candidate of selected) {
    const { data: linkedContact } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("canonical_person_id")
      .eq("id", candidate.company_contact_id)
      .maybeSingle()

    const linked_person_id = asString(linkedContact?.canonical_person_id)
    if (!linked_person_id) {
      skipped.push({
        full_name: candidate.full_name,
        email: candidate.email,
        company_name: candidate.company_name,
        messages: ["missing_canonical_person_id_after_backfill"],
      })
      continue
    }

    resolved.push({ ...candidate, person_id: linked_person_id })
  }

  return { resolved, skipped }
}

export async function runApolloReplacementBenchmarkVerifiedEmailCompletion(
  admin: SupabaseClient,
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER
  ok: boolean
  cohort_company_count: number
  selected_candidates: BenchmarkVerifiedEmailCandidateRow[]
  rejected_candidates: Awaited<ReturnType<typeof selectBenchmarkVerifiedEmailCandidates>>["rejected"]
  metrics: BenchmarkVerifiedEmailCompletionMetrics
  before: {
    verified_emails: number
    outreach_ready_contacts: number
    outreach_ready_companies: number
  }
  after: {
    verified_emails: number
    outreach_ready_contacts: number
    outreach_ready_companies: number
  }
  person_results: Array<{
    full_name: string
    email: string
    company_name: string
    verified: boolean
    promoted: boolean
    execution_channel: string
    messages: string[]
  }>
  messages: string[]
}> {
  const messages: string[] = []

  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  if (cohort) {
    const { data: candidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select("company_id, canonical_company_id")
      .in("canonical_company_id", cohort.company_ids)

    for (const row of candidates ?? []) {
      const company_candidate_id = asString((row as Record<string, unknown>).company_id)
      if (!company_candidate_id) continue
      await runCanonicalPersonBackfillForCompanyCandidate(admin, {
        company_candidate_id,
        canonical_company_id: asString((row as Record<string, unknown>).canonical_company_id) || null,
        mode: "apply",
      })
    }
    messages.push(`backfill_companies=${(candidates ?? []).length}`)
  }

  const { cohort_company_count, selected, rejected } = await selectBenchmarkVerifiedEmailCandidates(admin)
  messages.push(`selected=${selected.length} rejected=${rejected.length}`)

  const company_ids = cohort?.company_ids ?? []
  const { resolved, skipped } = await resolveLinkedCandidates(admin, selected)
  const person_ids = [...new Set(resolved.map((row) => row.person_id))]

  const before_verified = await countVerifiedEmailsForPersons(admin, person_ids)
  const before_outreach_contacts = await countOutreachReadyContactsForPersons(admin, person_ids)
  const before_outreach_companies = await countOutreachReadyCompanies(admin, company_ids)

  const runtime = await resolveCorroboratedChannelRuntimeContext(admin)
  const local_cert = evaluateEmailDiscoveryVerificationCertification()
  const cron_secret_available = Boolean(resolveGrowthDeployedRuntimeCronSecret())
  const use_local_staging =
    runtime.email_execution_path === "local" && local_cert.production_safe
  const use_deployed_http =
    runtime.email_execution_path === "deployed_runtime" && cron_secret_available
  const use_deployed_queue =
    runtime.email_execution_path === "deployed_runtime" && !cron_secret_available

  const metrics: BenchmarkVerifiedEmailCompletionMetrics = {
    candidates_selected: selected.length,
    candidates_rejected: rejected.length,
    emails_attempted: 0,
    emails_verified: 0,
    emails_promoted: 0,
    persons_with_new_verified_email: 0,
  }

  const person_results: Array<{
    full_name: string
    email: string
    company_name: string
    verified: boolean
    promoted: boolean
    execution_channel: string
    messages: string[]
  }> = skipped.map((row) => ({
    ...row,
    verified: false,
    promoted: false,
    execution_channel: "skipped",
  }))

  const promotedPersons = new Set<string>()

  if (use_deployed_queue && resolved.length > 0) {
    messages.push(`deployed_queue_candidates=${resolved.length}`)
    await persistBenchmarkVerifiedEmailQueue(admin, {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
      benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
      status: "scheduled",
      requested_at: new Date().toISOString(),
      completed_at: null,
      candidates: resolved,
      person_results: [],
      error: null,
    })

    const queue_trigger = await runDeployedBenchmarkVerifiedEmailQueue({ admin })
    const queue_record = await waitForBenchmarkVerifiedEmailQueue(admin, {
      poll_timeout_ms: 240_000,
    })

    if (!queue_trigger.ok) {
      messages.push(`deployed_queue_trigger_error: ${queue_trigger.error ?? "unknown"}`)
    }

    const results = queue_record?.person_results ?? []
    if (results.length > 0) metrics.emails_attempted = results.length
    for (const row of results) {
      if (row.verified) metrics.emails_verified += 1
      if (row.promoted) {
        metrics.emails_promoted += 1
        promotedPersons.add(row.person_id)
      }
      person_results.push({
        full_name: row.full_name,
        email: row.email,
        company_name: row.company_name,
        verified: row.verified,
        promoted: row.promoted,
        execution_channel: row.execution_channel,
        messages: row.messages,
      })
      messages.push(
        `${row.full_name}@${row.email}: verified=${row.verified} promoted=${row.promoted}`,
      )
    }

    if (queue_record?.status === "failed") {
      messages.push(`deployed_queue_failed: ${queue_record.error ?? "unknown"}`)
    }
  } else {
    for (const candidate of resolved) {
      try {
        const result = use_local_staging
          ? await executeBenchmarkVerifiedEmailCandidate(admin, candidate, {
              execution_channel: "local_staging_only",
            })
          : use_deployed_http
            ? await verifyViaDeployedHttp(admin, candidate, runtime).then((deployed) => ({
                attempted: deployed.attempted,
                verified: deployed.verified,
                promoted: deployed.promoted,
                provenance: deployed.provenance,
                messages: deployed.messages,
              }))
            : {
                attempted: false,
                verified: false,
                promoted: false,
                provenance: {
                  provider: "zerobounce",
                  deployed_runtime_used: false,
                  execution_channel: "skipped",
                  source_evidence: candidate.evidence_ref ?? candidate.email,
                  contact_id: candidate.company_contact_id,
                  email: candidate.email,
                },
                messages: ["email_skipped: verification_runtime_unavailable"],
              }

        if (result.attempted) metrics.emails_attempted += 1
        if (result.verified) metrics.emails_verified += 1
        if (result.promoted) {
          metrics.emails_promoted += 1
          promotedPersons.add(candidate.person_id)
        }

        person_results.push({
          full_name: candidate.full_name,
          email: candidate.email,
          company_name: candidate.company_name,
          verified: result.verified,
          promoted: result.promoted,
          execution_channel: result.provenance.execution_channel,
          messages: result.messages,
        })
        messages.push(
          `${candidate.full_name}@${candidate.email}: verified=${result.verified} promoted=${result.promoted}`,
        )
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        person_results.push({
          full_name: candidate.full_name,
          email: candidate.email,
          company_name: candidate.company_name,
          verified: false,
          promoted: false,
          execution_channel: "error",
          messages: [reason],
        })
        messages.push(`failed ${candidate.full_name}: ${reason}`)
      }
    }
  }

  metrics.persons_with_new_verified_email = promotedPersons.size

  const after_verified = await countVerifiedEmailsForPersons(admin, person_ids)
  const after_outreach_contacts = await countOutreachReadyContactsForPersons(admin, person_ids)
  const after_outreach_companies = await countOutreachReadyCompanies(admin, company_ids)

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_VERIFIED_EMAIL_QA_MARKER,
    ok: selected.length > 0,
    cohort_company_count,
    selected_candidates: selected,
    rejected_candidates: rejected,
    metrics,
    before: {
      verified_emails: before_verified,
      outreach_ready_contacts: before_outreach_contacts,
      outreach_ready_companies: before_outreach_companies,
    },
    after: {
      verified_emails: after_verified,
      outreach_ready_contacts: after_outreach_contacts,
      outreach_ready_companies: after_outreach_companies,
    },
    person_results,
    messages,
  }
}

async function countVerifiedEmailsForPersons(
  admin: SupabaseClient,
  person_ids: string[],
): Promise<number> {
  if (person_ids.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("person_emails")
    .select("id", { count: "exact", head: true })
    .in("person_id", person_ids)
    .eq("verification_status", "verified")
  return count ?? 0
}
