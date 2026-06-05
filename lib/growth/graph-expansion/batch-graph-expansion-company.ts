/** Phase 7.PS-IB — Per-company batch graph expansion pipeline. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runCanonicalPersonBackfillForCompanyCandidate } from "@/lib/growth/canonical-persons/canonical-person-backfill"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { loadCorroboratedPersonTargets } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-loader"
import {
  resolveCorroboratedChannelRuntimeContext,
  runEmailDiscoveryForCorroboratedPerson,
} from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-runtime"
import { countVerifiedChannelsForPerson } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"
import { acquireExternalEvidenceFromRegistry } from "@/lib/growth/external-evidence/external-evidence-acquisition"
import { reconcileExternalEvidenceRecords } from "@/lib/growth/external-evidence/external-evidence-reconciliation"
import type { BatchGraphExpansionCohortCompany } from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import {
  DEFAULT_BATCH_GRAPH_EXPANSION_COMPANY_TIMEOUT_MS,
  type BatchGraphExpansionCompanyMetrics,
  type BatchGraphExpansionProviderCounters,
} from "@/lib/growth/graph-expansion/batch-graph-expansion-types"
import { loadPersonCommitteeDensityCompanySnapshot } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { runGenericContactContainment } from "@/lib/growth/human-identity-evidence/generic-contact-containment"
import { acquireProfessionalIdentityCorroborationSignals } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-acquisition"
import { reconcileProfessionalIdentityCorroboration } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-reconciliation"
import { loadEvidenceBackedPersonTargets } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-reconciliation"
import { runProspectSearchHumanAcquisitionPipeline } from "@/lib/growth/prospect-search/prospect-search-human-acquisition"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function loadCompanyWebsite(
  admin: SupabaseClient,
  company_id: string,
): Promise<string | null> {
  const { data } = await admin
    .schema("growth")
    .from("companies")
    .select("website, primary_domain")
    .eq("id", company_id)
    .maybeSingle()
  const website = asString(data?.website) || asString(data?.primary_domain)
  if (!website) return null
  return website.startsWith("http") ? website : `https://${website}`
}

async function withCompanyTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function runBatchGraphExpansionForCompany(
  admin: SupabaseClient,
  input: {
    company: BatchGraphExpansionCohortCompany
    provider_counters: BatchGraphExpansionProviderCounters
    company_timeout_ms?: number
    run_external_evidence?: boolean
    run_channel_completion?: boolean
  },
): Promise<{
  ok: boolean
  metrics: BatchGraphExpansionCompanyMetrics
  messages: string[]
}> {
  const started = Date.now()
  const messages: string[] = []
  const timeoutMs = input.company_timeout_ms ?? DEFAULT_BATCH_GRAPH_EXPANSION_COMPANY_TIMEOUT_MS
  let fetch_errors = 0

  const before = await loadPersonCommitteeDensityCompanySnapshot(admin, {
    canonical_company_id: input.company.canonical_company_id,
    company_name: input.company.company_name,
    cohort_kind: input.company.cohort_kind === "ps_he_anchor" ? "ps_he_anchor" : "ps_ht_new",
  })

  const emptyMetrics = (): BatchGraphExpansionCompanyMetrics => ({
    contacts_discovered: 0,
    named_persons_added: 0,
    titles_added: 0,
    verified_emails_added: 0,
    verified_phones_added: 0,
    generic_shells_contained: 0,
    corroborated_persons: 0,
    runtime_ms: Date.now() - started,
    fetch_errors,
    failure_reason: null,
  })

  try {
    await withCompanyTimeout(
      (async () => {
        const website = await loadCompanyWebsite(admin, input.company.canonical_company_id)
        if (website) {
          input.provider_counters.website_fetches += 1
          const snapshot = await runWebsiteContactDiscoveryForCompany(admin, {
            company_id: input.company.canonical_company_id,
            website,
          })
          messages.push(`website_crawl: ${snapshot.contacts.length} contact row(s)`)
        } else {
          messages.push("website_crawl: skipped — no website")
        }

        const acquisition = await runProspectSearchHumanAcquisitionPipeline(admin, {
          company_candidate_id: input.company.company_candidate_id,
          canonical_company_id: input.company.canonical_company_id,
          run_discovery: true,
          search_query: input.company.search_query,
        })
        messages.push(
          `human_acquisition: discovery=${acquisition.discovery_contacts} persons=${acquisition.backfill_persons_linked}`,
        )

        await runCanonicalPersonBackfillForCompanyCandidate(admin, {
          company_candidate_id: input.company.company_candidate_id,
        })

        if (input.run_external_evidence !== false) {
          const external = await acquireExternalEvidenceFromRegistry({
            max_sources: 2,
            cohort: [{ company_name: input.company.company_name }],
          })
          input.provider_counters.external_evidence_sources += external.sources_queried
          if (external.records.length > 0) {
            const reconciliation = await reconcileExternalEvidenceRecords(admin, {
              records: external.records,
              cohort: [
                {
                  company_candidate_id: input.company.company_candidate_id,
                  canonical_company_id: input.company.canonical_company_id,
                  company_name: input.company.company_name,
                  search_query: input.company.search_query,
                  cohort_kind: "ps_ht_new",
                },
              ],
            })
            messages.push(
              `external_evidence: records=${external.records.length} names=${reconciliation.names_discovered}`,
            )
          }
        }

        const corroborationTargets = (
          await loadEvidenceBackedPersonTargets(admin, [
            {
              company_candidate_id: input.company.company_candidate_id,
              canonical_company_id: input.company.canonical_company_id,
              company_name: input.company.company_name,
              search_query: input.company.search_query,
              cohort_kind: "ps_ht_new",
            },
          ])
        ).filter((target) => target.company_id === input.company.canonical_company_id)

        for (const target of corroborationTargets.slice(0, 3)) {
          const signals = await acquireProfessionalIdentityCorroborationSignals(target)
          const reconciliation = await reconcileProfessionalIdentityCorroboration(admin, {
            target,
            signals: signals.signals,
          })
          if (reconciliation.corroborated) {
            messages.push(`corroboration: ${target.full_name}`)
          }
        }

        const containment = await runGenericContactContainment(admin, {
          company_ids: [input.company.canonical_company_id],
          mode: "apply",
          limit: 40,
        })
        messages.push(`generic_containment: unlinked=${containment.metrics.contacts_unlinked}`)

        if (input.run_channel_completion !== false) {
          const runtime_context = await resolveCorroboratedChannelRuntimeContext(admin)
          const channelTargets = (
            await loadCorroboratedPersonTargets(admin, [
              {
                company_candidate_id: input.company.company_candidate_id,
                canonical_company_id: input.company.canonical_company_id,
                company_name: input.company.company_name,
                search_query: input.company.search_query,
                cohort_kind: "ps_ht_new",
              },
            ])
          ).filter((target) => target.company_id === input.company.canonical_company_id)

          for (const target of channelTargets.slice(0, 2)) {
            input.provider_counters.channel_completion_persons += 1
            const verified_before = await countVerifiedChannelsForPerson(admin, target.person_id)
            const emailResult = await runEmailDiscoveryForCorroboratedPerson({
              admin,
              target,
              runtime_context,
            })
            if (emailResult.attempted) {
              input.provider_counters.zerobounce_calls += 1
            }
            const verified_after = await countVerifiedChannelsForPerson(admin, target.person_id)
            if (verified_after > verified_before) {
              messages.push(`channel_completion: verified+ for ${target.full_name}`)
            }
          }
        }
      })(),
      timeoutMs,
      input.company.company_name,
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : "company_pipeline_failed"
    if (reason.includes("timeout")) fetch_errors += 1
    return {
      ok: false,
      metrics: {
        ...emptyMetrics(),
        failure_reason: reason,
        fetch_errors,
      },
      messages: [...messages, reason],
    }
  }

  const after = await loadPersonCommitteeDensityCompanySnapshot(admin, {
    canonical_company_id: input.company.canonical_company_id,
    company_name: input.company.company_name,
    cohort_kind: input.company.cohort_kind === "ps_he_anchor" ? "ps_he_anchor" : "ps_ht_new",
  })

  const { data: contactRows } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id")
    .eq("company_id", input.company.canonical_company_id)
    .neq("contact_status", "archived")

  return {
    ok: true,
    metrics: {
      contacts_discovered: Math.max(0, (contactRows?.length ?? 0) - input.company.contact_count),
      named_persons_added: Math.max(0, after.named_persons - before.named_persons),
      titles_added: Math.max(0, after.titled_persons - before.titled_persons),
      verified_emails_added: Math.max(0, after.verified_emails - before.verified_emails),
      verified_phones_added: Math.max(0, after.verified_phones - before.verified_phones),
      generic_shells_contained: 0,
      corroborated_persons: 0,
      runtime_ms: Date.now() - started,
      fetch_errors,
      failure_reason: null,
    },
    messages,
  }
}
