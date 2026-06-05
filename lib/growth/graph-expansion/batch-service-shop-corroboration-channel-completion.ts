/** Phase 7.PS-IH — Service-shop corroboration + channel completion orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { runCorroboratedContactChannelCompletion } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-expansion"
import { loadOutreachReadinessSnapshot } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"
import { loadCorroboratedPersonTargets } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-loader"
import {
  GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER,
  SERVICE_SHOP_CORROBORATION_DEFAULT_TIMEOUT_MS,
  SERVICE_SHOP_CORROBORATION_EXTENDED_TIMEOUT_MS,
  type ServiceShopCorroborationChannelCompletionResult,
} from "@/lib/growth/graph-expansion/service-shop-corroboration-types"
import { loadServiceShopCorroborationTargets } from "@/lib/growth/graph-expansion/service-shop-corroboration-targets"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { acquireProfessionalIdentityCorroborationSignals } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-acquisition"
import {
  loadEvidenceBackedPersonTargets,
  reconcileProfessionalIdentityCorroboration,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-reconciliation"
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

async function withTargetTimeout<T>(
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

export async function runBatchServiceShopCorroborationChannelCompletion(
  admin: SupabaseClient,
  input: { scan_limit?: number } = {},
): Promise<ServiceShopCorroborationChannelCompletionResult> {
  const messages: string[] = []
  const person_results: ServiceShopCorroborationChannelCompletionResult["person_results"] = []

  const { selected, rejected } = await loadServiceShopCorroborationTargets(admin, {
    scan_limit: input.scan_limit,
  })

  const personIds = selected.map((t) => t.person_id)
  const companyIds = [...new Set(selected.map((t) => t.canonical_company_id))]

  const before = await loadOutreachReadinessSnapshot(admin, {
    person_ids: personIds,
    company_ids: companyIds,
  })

  if (selected.length === 0) {
    return {
      qa_marker: GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER,
      ok: false,
      selected_targets: [],
      rejected_targets: rejected,
      metrics: {
        named_persons_selected: 0,
        persons_rejected_fragments: rejected.filter((r) => r.rejection_reason === "company_name_fragment")
          .length,
        persons_rejected_other: rejected.length,
        corroborated_persons: 0,
        verified_emails: before.verified_emails,
        verified_phones: before.verified_phones,
        verified_profiles: 0,
        outreach_ready_contacts: before.outreach_ready_contacts,
        outreach_ready_companies: before.outreach_ready_companies,
        extended_timeout_targets: 0,
      },
      before,
      after: before,
      outreach_ready_delta: { contacts: 0, companies: 0 },
      person_results: [],
      messages: ["no_selected_targets"],
    }
  }

  const extendedCompanyIds = [
    ...new Set(
      selected.filter((t) => t.extended_timeout).map((t) => t.canonical_company_id),
    ),
  ]
  messages.push(`extended_timeout_companies=${extendedCompanyIds.length}`)

  for (const company_id of extendedCompanyIds) {
    const target = selected.find((t) => t.canonical_company_id === company_id)
    if (!target) continue
    const website = await loadCompanyWebsite(admin, company_id)
    try {
      await withTargetTimeout(
        (async () => {
          if (website) {
            await runWebsiteContactDiscoveryForCompany(admin, {
              company_id,
              website,
            })
          }
          await runProspectSearchHumanAcquisitionPipeline(admin, {
            company_candidate_id: target.company_candidate_id,
            canonical_company_id: company_id,
            run_discovery: true,
            search_query: "biomedical equipment service companies",
          })
        })(),
        SERVICE_SHOP_CORROBORATION_EXTENDED_TIMEOUT_MS,
        target.company_name,
      )
      messages.push(`extended_enrichment_ok: ${target.company_name}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "extended_enrichment_failed"
      messages.push(`extended_enrichment_failed: ${target.company_name} ${reason}`)
    }
  }

  const cohort: PersonCommitteeDensityCohortCompany[] = [
    ...new Map(
      selected.map((t) => [
        t.canonical_company_id,
        {
          company_candidate_id: t.company_candidate_id,
          canonical_company_id: t.canonical_company_id,
          company_name: t.company_name,
          search_query: "biomedical equipment service companies",
          cohort_kind: t.is_ps_he_anchor ? ("ps_he_anchor" as const) : ("ps_ht_new" as const),
        },
      ]),
    ).values(),
  ]

  const evidenceTargets = (
    await loadEvidenceBackedPersonTargets(admin, cohort)
  ).filter((target) => personIds.includes(target.person_id))

  let corroborated_persons = 0

  for (const target of evidenceTargets) {
    try {
      const signals = await withTargetTimeout(
        acquireProfessionalIdentityCorroborationSignals(target),
        SERVICE_SHOP_CORROBORATION_DEFAULT_TIMEOUT_MS,
        target.full_name,
      )
      const reconciliation = await reconcileProfessionalIdentityCorroboration(admin, {
        target,
        signals: signals.signals,
      })
      if (reconciliation.corroborated) {
        corroborated_persons += 1
        messages.push(`corroborated: ${target.full_name}@${target.company_name}`)
      } else {
        messages.push(`not_corroborated: ${target.full_name}@${target.company_name}`)
      }
      person_results.push({
        full_name: target.full_name,
        company_name: target.company_name,
        corroborated: reconciliation.corroborated,
        gained_verified_channel: false,
        verified_channels_after: 0,
        messages: signals.messages,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : "corroboration_failed"
      messages.push(`corroboration_error: ${target.full_name} ${reason}`)
      person_results.push({
        full_name: target.full_name,
        company_name: target.company_name,
        corroborated: false,
        gained_verified_channel: false,
        verified_channels_after: 0,
        messages: [reason],
      })
    }
  }

  const corroboratedTargets = (
    await loadCorroboratedPersonTargets(admin, cohort)
  ).filter((target) => personIds.includes(target.person_id))

  const channelCompletion = await runCorroboratedContactChannelCompletion(admin, {
    cohort,
    targets: corroboratedTargets,
  })

  messages.push(...channelCompletion.messages)

  for (const result of channelCompletion.person_results) {
    const existing = person_results.find(
      (row) => row.full_name === result.full_name && row.company_name === result.company_name,
    )
    if (existing) {
      existing.gained_verified_channel = result.gained_verified_channel
      existing.verified_channels_after = result.verified_channels_after
      existing.messages.push(...result.messages)
    } else {
      person_results.push({
        full_name: result.full_name,
        company_name: result.company_name,
        corroborated: true,
        gained_verified_channel: result.gained_verified_channel,
        verified_channels_after: result.verified_channels_after,
        messages: result.messages,
      })
    }
  }

  const after = channelCompletion.after
  const fragmentRejections = rejected.filter(
    (row) => row.rejection_reason === "company_name_fragment",
  ).length

  return {
    qa_marker: GROWTH_SERVICE_SHOP_CORROBORATION_CHANNEL_COMPLETION_QA_MARKER,
    ok:
      selected.length > 0 &&
      (after.outreach_ready_contacts > before.outreach_ready_contacts ||
        channelCompletion.metrics.persons_with_new_verified_channel > 0 ||
        corroborated_persons > 0),
    selected_targets: selected,
    rejected_targets: rejected,
    metrics: {
      named_persons_selected: selected.length,
      persons_rejected_fragments: fragmentRejections,
      persons_rejected_other: rejected.length - fragmentRejections,
      corroborated_persons,
      verified_emails: after.verified_emails,
      verified_phones: after.verified_phones,
      verified_profiles: after.verified_profiles,
      outreach_ready_contacts: after.outreach_ready_contacts,
      outreach_ready_companies: after.outreach_ready_companies,
      extended_timeout_targets: extendedCompanyIds.length,
    },
    before,
    after,
    outreach_ready_delta: {
      contacts: after.outreach_ready_contacts - before.outreach_ready_contacts,
      companies: after.outreach_ready_companies - before.outreach_ready_companies,
    },
    person_results,
    messages,
  }
}
