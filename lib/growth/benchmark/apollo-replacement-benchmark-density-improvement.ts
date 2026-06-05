/** Phase 7.PS-IK — Benchmark-gated targeted density improvement. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { runCorroboratedContactChannelCompletion } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-expansion"
import {
  auditApolloReplacementBenchmarkCohort,
  selectApolloBenchmarkDensityTargets,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-audit"
import {
  APOLLO_BENCHMARK_DENSITY_DEFAULT_MAX_TARGETS,
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER,
  type ApolloBenchmarkDensityImprovementMetrics,
  type ApolloBenchmarkDensityTargetRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-improvement-types"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { loadPersonCommitteeDensityCompanySnapshot } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { upgradeGenericIdentitiesBatch } from "@/lib/growth/human-identity-evidence/human-identity-evidence-identity-upgrade"
import { acquireProfessionalIdentityCorroborationSignals } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-acquisition"
import {
  loadEvidenceBackedPersonTargets,
  reconcileProfessionalIdentityCorroboration,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-reconciliation"
import { refreshCompanyContactVerification } from "@/lib/growth/contact-discovery/company-contact-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function resolveCandidateMap(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<Map<string, { company_candidate_id: string; company_name: string }>> {
  const map = new Map<string, { company_candidate_id: string; company_name: string }>()
  if (company_ids.length === 0) return map

  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, canonical_company_id")
    .in("canonical_company_id", company_ids)

  for (const row of data ?? []) {
    const record = row as Record<string, unknown>
    const canonical_company_id = asString(record.canonical_company_id)
    const company_candidate_id = asString(record.company_id) || asString(record.id)
    const company_name = asString(record.company_name)
    if (!canonical_company_id || !company_candidate_id) continue
    if (!map.has(canonical_company_id)) {
      map.set(canonical_company_id, { company_candidate_id, company_name })
    }
  }
  return map
}

export async function runApolloReplacementBenchmarkDensityImprovement(
  admin: SupabaseClient,
  input: { max_targets?: number } = {},
): Promise<{
  qa_marker: typeof GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER
  ok: boolean
  selected_blocker: string
  blocker_rationale: string
  segmentation: Awaited<ReturnType<typeof auditApolloReplacementBenchmarkCohort>>["segmentation"]
  targets: ApolloBenchmarkDensityTargetRow[]
  metrics: ApolloBenchmarkDensityImprovementMetrics
  naming_upgrades: Awaited<ReturnType<typeof upgradeGenericIdentitiesBatch>>
  company_results: Array<{
    canonical_company_id: string
    company_name: string
    ok: boolean
    named_persons_added: number
    verified_emails_added: number
    messages: string[]
  }>
  messages: string[]
}> {
  const messages: string[] = []
  const max_targets = input.max_targets ?? APOLLO_BENCHMARK_DENSITY_DEFAULT_MAX_TARGETS

  const cohort =
    (await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)) ?? null
  if (!cohort || cohort.company_ids.length === 0) {
    return {
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER,
      ok: false,
      selected_blocker: "missing_benchmark_cohort",
      blocker_rationale: "Benchmark cohort not found.",
      segmentation: {
        no_contacts: 0,
        generic_channels_only: 0,
        named_without_verified_channel: 0,
        titled_without_committee: 0,
        verified_channel_not_outreach_ready: 0,
        outreach_ready: 0,
      },
      targets: [],
      metrics: {
        targets_selected: 0,
        targets_processed: 0,
        targets_succeeded: 0,
        named_persons_added: 0,
        verified_emails_added: 0,
        outreach_ready_companies_added: 0,
        external_evidence_sources: 0,
        website_fetches: 0,
      },
      naming_upgrades: [],
      company_results: [],
      messages: ["benchmark_cohort_missing"],
    }
  }

  const audit = await auditApolloReplacementBenchmarkCohort(admin, cohort.company_ids)
  messages.push(
    `segmentation generic_only=${audit.segmentation.generic_channels_only} no_contacts=${audit.segmentation.no_contacts}`,
  )

  const naming_upgrades = await upgradeGenericIdentitiesBatch(admin, {
    company_ids: cohort.company_ids,
    limit: 54,
    require_canonical_person_id: false,
  })
  const upgradedContacts = naming_upgrades.filter((row) => row.upgraded)
  messages.push(`naming_upgrades=${upgradedContacts.length}`)

  const candidateByCanonical = await resolveCandidateMap(admin, cohort.company_ids)
  const upgradedCompanyIds = new Set<string>()
  if (upgradedContacts.length > 0) {
    const upgradedContactIds = upgradedContacts.map((row) => row.company_contact_id)
    const { data: upgradedRows } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, company_id")
      .in("id", upgradedContactIds)
    for (const row of upgradedRows ?? []) {
      upgradedCompanyIds.add(asString((row as Record<string, unknown>).company_id))
    }
  }

  const targets = selectApolloBenchmarkDensityTargets(audit.companies, candidateByCanonical, {
    max_targets,
  })

  const processTargets = [
    ...targets,
    ...[...upgradedCompanyIds]
      .filter((company_id) => !targets.some((t) => t.canonical_company_id === company_id))
      .map((canonical_company_id) => {
        const candidate = candidateByCanonical.get(canonical_company_id)
        const auditRow = audit.companies.find((row) => row.canonical_company_id === canonical_company_id)
        return candidate && auditRow
          ? {
              canonical_company_id,
              company_candidate_id: candidate.company_candidate_id,
              company_name: auditRow.company_name,
              segment: auditRow.segment,
              service_shop_score: auditRow.service_shop_score,
              is_ps_he_anchor: auditRow.is_ps_he_anchor,
              has_website: auditRow.has_website,
              contact_count: auditRow.contact_count,
            }
          : null
      })
      .filter((row): row is ApolloBenchmarkDensityTargetRow => row !== null),
  ]

  messages.push(`targets_selected=${processTargets.length}`)

  const metrics: ApolloBenchmarkDensityImprovementMetrics = {
    targets_selected: processTargets.length,
    targets_processed: 0,
    targets_succeeded: 0,
    named_persons_added: 0,
    verified_emails_added: 0,
    outreach_ready_companies_added: 0,
    external_evidence_sources: 0,
    website_fetches: 0,
  }

  const company_results: Array<{
    canonical_company_id: string
    company_name: string
    ok: boolean
    named_persons_added: number
    verified_emails_added: number
    messages: string[]
  }> = []

  for (const target of processTargets) {
    metrics.targets_processed += 1
    const resultMessages: string[] = []

    const before = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: target.canonical_company_id,
      company_name: target.company_name,
      cohort_kind: target.is_ps_he_anchor ? "ps_he_anchor" : "ps_ht_new",
    })

    try {
      const backfill = await runCanonicalPersonBackfillForCompanyCandidate(admin, {
        company_candidate_id: target.company_candidate_id,
      })
      resultMessages.push(`backfill: persons_linked=${backfill.persons_linked}`)

      const { data: namedContacts } = await admin
        .schema("growth")
        .from("company_contacts")
        .select("id, email")
        .eq("company_id", target.canonical_company_id)
        .neq("contact_status", "archived")
        .not("email", "is", null)

      for (const row of namedContacts ?? []) {
        await refreshCompanyContactVerification(admin, asString((row as Record<string, unknown>).id))
      }

      const evidenceTargets = (
        await loadEvidenceBackedPersonTargets(admin, [
          {
            company_candidate_id: target.company_candidate_id,
            canonical_company_id: target.canonical_company_id,
            company_name: target.company_name,
            search_query: "biomedical equipment service companies",
            cohort_kind: target.is_ps_he_anchor ? "ps_he_anchor" : "ps_ht_new",
          },
        ])
      ).filter((row) => row.company_id === target.canonical_company_id)

      let corroborated = 0
      for (const evidenceTarget of evidenceTargets.slice(0, 3)) {
        const signals = await acquireProfessionalIdentityCorroborationSignals(evidenceTarget)
        const reconciliation = await reconcileProfessionalIdentityCorroboration(admin, {
          target: evidenceTarget,
          signals: signals.signals,
        })
        if (reconciliation.corroborated) {
          corroborated += 1
          resultMessages.push(`corroboration: ${evidenceTarget.full_name}`)
        }
      }

      if (corroborated > 0 || upgradedCompanyIds.has(target.canonical_company_id)) {
        const channel = await runCorroboratedContactChannelCompletion(admin, {
          cohort: [
            {
              company_candidate_id: target.company_candidate_id,
              canonical_company_id: target.canonical_company_id,
              company_name: target.company_name,
              search_query: "biomedical equipment service companies",
              cohort_kind: target.is_ps_he_anchor ? "ps_he_anchor" : "ps_ht_new",
            },
          ],
          limit: 2,
        })
        resultMessages.push(
          `channel_completion: verified_channels=${channel.metrics.verified_channels_promoted}`,
        )
      }

      const after = await loadPersonCommitteeDensityCompanySnapshot(admin, {
        canonical_company_id: target.canonical_company_id,
        company_name: target.company_name,
        cohort_kind: target.is_ps_he_anchor ? "ps_he_anchor" : "ps_ht_new",
      })

      const named_delta = Math.max(0, after.named_persons - before.named_persons)
      const email_delta = Math.max(0, after.verified_emails - before.verified_emails)
      const outreach_delta = !before.outreach_ready && after.outreach_ready ? 1 : 0

      metrics.named_persons_added += named_delta
      metrics.verified_emails_added += email_delta
      metrics.outreach_ready_companies_added += outreach_delta
      metrics.targets_succeeded += 1

      company_results.push({
        canonical_company_id: target.canonical_company_id,
        company_name: target.company_name,
        ok: true,
        named_persons_added: named_delta,
        verified_emails_added: email_delta,
        messages: resultMessages,
      })
      messages.push(
        `processed ${target.company_name}: named+${named_delta} email+${email_delta} outreach+${outreach_delta}`,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : "processing_failed"
      company_results.push({
        canonical_company_id: target.canonical_company_id,
        company_name: target.company_name,
        ok: false,
        named_persons_added: 0,
        verified_emails_added: 0,
        messages: [...resultMessages, reason],
      })
      messages.push(`failed ${target.company_name}: ${reason}`)
    }
  }

  return {
    qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_DENSITY_IMPROVEMENT_QA_MARKER,
    ok: processTargets.length > 0,
    selected_blocker: "generic_channels_only_unlinked_personal_email",
    blocker_rationale:
      `${audit.segmentation.generic_channels_only} benchmark companies store personal emails under generic "Company contact" shells without canonical person linkage — evidence-backed email local-part naming unlocks named persons without inventing data.`,
    segmentation: audit.segmentation,
    targets: processTargets,
    metrics,
    naming_upgrades: upgradedContacts,
    company_results,
    messages,
  }
}
