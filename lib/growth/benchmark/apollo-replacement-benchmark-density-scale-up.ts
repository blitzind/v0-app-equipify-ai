/** Phase 7.PS-IM — Benchmark density scale-up orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { auditApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-audit"
import { countOutreachReadyContactsForPersons } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"
import { countOutreachReadyCompanies } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { upgradeGenericIdentitiesBatch } from "@/lib/growth/human-identity-evidence/human-identity-evidence-identity-upgrade"
import { findGenericPersonalEmailUpgradeCandidates } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-candidates"
import { loadApolloDensityScaleUpCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-cohort"
import {
  persistDensityScaleUpQueue,
  waitForDensityScaleUpQueue,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-queue"
import {
  APOLLO_DENSITY_SCALE_UP_DEFAULT_UPGRADE_LIMIT,
  APOLLO_DENSITY_SCALE_UP_DEFAULT_VERIFY_LIMIT,
  APOLLO_DENSITY_SCALE_UP_DEFAULT_WEBSITE_REFRESH_LIMIT,
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER,
  type DensityScaleUpMetrics,
  type DensityScaleUpRejectedRow,
  type DensityScaleUpUpgradeCandidateRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-types"
import { selectVerifiedEmailCandidatesForCompanyIds } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-selection"
import type { BenchmarkVerifiedEmailCandidateRow } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-types"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { runDeployedBenchmarkVerifiedEmailQueue } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function resolveLinkedEmailCandidates(
  admin: SupabaseClient,
  selected: BenchmarkVerifiedEmailCandidateRow[],
): Promise<BenchmarkVerifiedEmailCandidateRow[]> {
  const resolved: BenchmarkVerifiedEmailCandidateRow[] = []
  for (const candidate of selected) {
    const { data: linkedContact } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("canonical_person_id")
      .eq("id", candidate.company_contact_id)
      .maybeSingle()
    const linked_person_id = asString(linkedContact?.canonical_person_id)
    if (!linked_person_id) continue
    resolved.push({ ...candidate, person_id: linked_person_id })
  }
  return resolved
}

export async function runApolloReplacementBenchmarkDensityScaleUp(
  admin: SupabaseClient,
  input: {
    upgrade_limit?: number
    verify_limit?: number
    icp_outside_limit?: number
    icp_scan_limit?: number
    website_refresh_limit?: number
  } = {},
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER
  ok: boolean
  cohort: Awaited<ReturnType<typeof loadApolloDensityScaleUpCohort>>
  upgrade_candidates: DensityScaleUpUpgradeCandidateRow[]
  upgrade_rejected: DensityScaleUpRejectedRow[]
  naming_upgrades: Awaited<ReturnType<typeof upgradeGenericIdentitiesBatch>>
  selected_emails: BenchmarkVerifiedEmailCandidateRow[]
  rejected_emails: Awaited<ReturnType<typeof selectVerifiedEmailCandidatesForCompanyIds>>["rejected"]
  metrics: DensityScaleUpMetrics
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
  website_refreshes: number
  messages: string[]
}> {
  const messages: string[] = []
  const upgrade_limit = input.upgrade_limit ?? APOLLO_DENSITY_SCALE_UP_DEFAULT_UPGRADE_LIMIT
  const verify_limit = input.verify_limit ?? APOLLO_DENSITY_SCALE_UP_DEFAULT_VERIFY_LIMIT
  const website_refresh_limit =
    input.website_refresh_limit ?? APOLLO_DENSITY_SCALE_UP_DEFAULT_WEBSITE_REFRESH_LIMIT

  const cohort = await loadApolloDensityScaleUpCohort(admin, {
    icp_outside_limit: input.icp_outside_limit,
    icp_scan_limit: input.icp_scan_limit,
  })
  messages.push(
    `cohort benchmark=${cohort.benchmark_company_count} icp_outside=${cohort.icp_outside_company_count}`,
  )

  let website_refreshes = 0
  const benchmark_audit = await auditApolloReplacementBenchmarkCohort(
    admin,
    cohort.benchmark_company_ids,
  )
  const { data: benchmarkCompanies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, website, primary_domain")
    .in("id", cohort.benchmark_company_ids)

  const websiteByCompanyId = new Map(
    (benchmarkCompanies ?? []).map((row) => [
      asString((row as Record<string, unknown>).id),
      asString((row as Record<string, unknown>).website) ||
        asString((row as Record<string, unknown>).primary_domain) ||
        null,
    ]),
  )

  const refreshTargets = benchmark_audit.companies
    .filter(
      (row) =>
        row.segment === "generic_channels_only" &&
        row.has_website &&
        websiteByCompanyId.get(row.canonical_company_id),
    )
    .slice(0, website_refresh_limit)

  for (const target of refreshTargets) {
    const website = websiteByCompanyId.get(target.canonical_company_id)
    if (!website) continue
    await runWebsiteContactDiscoveryForCompany(admin, {
      company_id: target.canonical_company_id,
      website,
    })
    website_refreshes += 1
    messages.push(`website_refresh: ${target.company_name}`)
  }
  messages.push(`website_refreshes=${website_refreshes}`)

  const { candidates: upgrade_candidates, rejected: upgrade_rejected } =
    await findGenericPersonalEmailUpgradeCandidates(admin, {
      company_ids: cohort.all_company_ids,
      benchmark_company_ids: cohort.benchmark_company_ids,
    })
  messages.push(`upgrade_candidates=${upgrade_candidates.length} rejected=${upgrade_rejected.length}`)

  const naming_upgrades = await upgradeGenericIdentitiesBatch(admin, {
    company_ids: cohort.all_company_ids,
    limit: upgrade_limit,
    require_canonical_person_id: false,
  })
  const identities_upgraded = naming_upgrades.filter((row) => row.upgraded).length
  const identities_skipped = naming_upgrades.length - identities_upgraded
  messages.push(`naming_upgrades=${identities_upgraded} skipped=${identities_skipped}`)

  const { data: discoveryRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, canonical_company_id")
    .in("canonical_company_id", cohort.all_company_ids)

  for (const row of discoveryRows ?? []) {
    const company_candidate_id = asString((row as Record<string, unknown>).company_id)
    if (!company_candidate_id) continue
    await runCanonicalPersonBackfillForCompanyCandidate(admin, {
      company_candidate_id,
      canonical_company_id: asString((row as Record<string, unknown>).canonical_company_id) || null,
      mode: "apply",
    })
  }
  messages.push(`backfill_companies=${(discoveryRows ?? []).length}`)

  const { selected, rejected: rejected_emails } = await selectVerifiedEmailCandidatesForCompanyIds(
    admin,
    cohort.all_company_ids,
  )
  const benchmarkSet = new Set(cohort.benchmark_company_ids)
  const benchmark_first = [
    ...selected.filter((row) => benchmarkSet.has(row.company_id)),
    ...selected.filter((row) => !benchmarkSet.has(row.company_id)),
  ]
  const capped_selected = benchmark_first.slice(0, verify_limit)
  const resolved = await resolveLinkedEmailCandidates(admin, capped_selected)
  messages.push(`emails_selected=${resolved.length} emails_rejected=${rejected_emails.length}`)

  const person_ids = [...new Set(resolved.map((row) => row.person_id))]
  const before_verified = await countVerifiedEmails(admin, person_ids)
  const before_outreach_contacts = await countOutreachReadyContactsForPersons(admin, person_ids)
  const before_outreach_companies = await countOutreachReadyCompanies(
    admin,
    cohort.benchmark_company_ids,
  )

  const metrics: DensityScaleUpMetrics = {
    candidates_found: upgrade_candidates.length,
    candidates_rejected: upgrade_rejected.length,
    identities_upgraded,
    identities_skipped,
    emails_selected: resolved.length,
    emails_rejected: rejected_emails.length,
    emails_attempted: 0,
    emails_verified: 0,
    emails_promoted: 0,
    persons_with_new_verified_email: 0,
    benchmark_company_count: cohort.benchmark_company_count,
    icp_outside_company_count: cohort.icp_outside_company_count,
  }

  const person_results: Array<{
    full_name: string
    email: string
    company_name: string
    verified: boolean
    promoted: boolean
    execution_channel: string
    messages: string[]
  }> = []

  const promotedPersons = new Set<string>()

  if (resolved.length > 0) {
    await persistDensityScaleUpQueue(admin, {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER,
      benchmark_id: APOLLO_REPLACEMENT_BENCHMARK_ID,
      status: "scheduled",
      requested_at: new Date().toISOString(),
      completed_at: null,
      candidates: resolved,
      person_results: [],
      error: null,
    })

    const trigger = await runDeployedBenchmarkVerifiedEmailQueue({ admin })
    if (!trigger.ok) {
      messages.push(`deployed_queue_trigger_error: ${trigger.error ?? "unknown"}`)
    }

    const queue_record = await waitForDensityScaleUpQueue(admin, { poll_timeout_ms: 300_000 })
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
  }

  metrics.persons_with_new_verified_email = promotedPersons.size

  const after_verified = await countVerifiedEmails(admin, person_ids)
  const after_outreach_contacts = await countOutreachReadyContactsForPersons(admin, person_ids)
  const after_outreach_companies = await countOutreachReadyCompanies(
    admin,
    cohort.benchmark_company_ids,
  )

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_SCALE_UP_QA_MARKER,
    ok: cohort.all_company_ids.length > 0,
    cohort,
    upgrade_candidates,
    upgrade_rejected,
    naming_upgrades,
    selected_emails: capped_selected,
    rejected_emails,
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
    website_refreshes,
    messages,
  }
}

async function countVerifiedEmails(admin: SupabaseClient, person_ids: string[]): Promise<number> {
  if (person_ids.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("person_emails")
    .select("id", { count: "exact", head: true })
    .in("person_id", person_ids)
    .eq("verification_status", "verified")
  return count ?? 0
}
