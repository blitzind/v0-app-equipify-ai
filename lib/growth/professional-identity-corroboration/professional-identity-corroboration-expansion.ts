/** Phase 7.PS-HY — Professional identity corroboration orchestrator. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  countOutreachReadyCompanies,
  loadPersonCommitteeDensityExpansionCohort,
} from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import type { PersonCommitteeDensityCohortCompany } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import {
  diffProspectGraphExpansionMetrics,
  loadProspectGraphExpansionMetrics,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"
import { acquireProfessionalIdentityCorroborationSignals } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-acquisition"
import {
  loadEvidenceBackedPersonTargets,
  reconcileProfessionalIdentityCorroboration,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-reconciliation"
import {
  GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
  type ProfessionalIdentityCorroborationMetrics,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"

function emptyMetrics(): ProfessionalIdentityCorroborationMetrics {
  return {
    persons_processed: 0,
    persons_corroborated: 0,
    titles_strengthened: 0,
    linkedin_urls_discovered: 0,
    committee_members_promoted: 0,
    channel_jobs_enqueued: 0,
    verified_channels_promoted: 0,
  }
}

async function countCommitteeVerified(admin: SupabaseClient, company_ids: string[]): Promise<number> {
  if (company_ids.length === 0) return 0
  const { count } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id", { count: "exact", head: true })
    .in("company_id", company_ids)
    .eq("verification_status", "verified")
  return count ?? 0
}

async function enqueueChannelJobsForCorroboratedPerson(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<number> {
  const [
    { enqueueEmailDiscoveryJob, processEmailDiscoveryJobQueue },
    { enqueuePhoneDiscoveryJob, processPhoneDiscoveryJobQueue },
    { enqueueSocialProfileDiscoveryJob, processSocialProfileDiscoveryJobQueue },
  ] = await Promise.all([
    import("@/lib/growth/email-discovery/email-discovery-queue"),
    import("@/lib/growth/phone-discovery/phone-discovery-queue"),
    import("@/lib/growth/social-profile-discovery/social-profile-discovery-queue"),
  ])

  let enqueued = 0
  const email = await enqueueEmailDiscoveryJob(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    promote_on_complete: true,
    trigger_source: "manual",
  })
  if (email.enqueued) enqueued += 1

  const phone = await enqueuePhoneDiscoveryJob(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    promote_on_complete: true,
    trigger_source: "manual",
  })
  if (phone.enqueued) enqueued += 1

  const social = await enqueueSocialProfileDiscoveryJob(admin, {
    company_id: input.company_id,
    person_id: input.person_id,
    discovery_scope: "person",
    promote_on_complete: true,
    trigger_source: "manual",
  })
  if (social.enqueued) enqueued += 1

  if (enqueued > 0) {
    await processEmailDiscoveryJobQueue(admin, 8)
    await processPhoneDiscoveryJobQueue(admin, 8)
    await processSocialProfileDiscoveryJobQueue(admin, 8)
  }

  return enqueued
}

export async function runProfessionalIdentityCorroborationExpansion(
  admin: SupabaseClient,
  input: {
    cohort?: PersonCommitteeDensityCohortCompany[]
    include_anchors?: boolean
    limit?: number
  } = {},
): Promise<{
  qa_marker: typeof GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER
  ok: boolean
  cohort: PersonCommitteeDensityCohortCompany[]
  targets: Awaited<ReturnType<typeof loadEvidenceBackedPersonTargets>>
  metrics: ProfessionalIdentityCorroborationMetrics
  before: {
    committee_members_verified: number
    outreach_ready_companies: number
    graph_metrics: Awaited<ReturnType<typeof loadProspectGraphExpansionMetrics>>["metrics"]
  }
  after: {
    committee_members_verified: number
    outreach_ready_companies: number
    graph_metrics: Awaited<ReturnType<typeof loadProspectGraphExpansionMetrics>>["metrics"]
  }
  graph_delta: ReturnType<typeof diffProspectGraphExpansionMetrics>
  person_results: Array<{
    full_name: string
    company_name: string
    person_id: string
    corroborated: boolean
    titles_strengthened: number
    linkedin_urls_discovered: number
    signals_accepted: number
    messages: string[]
  }>
  messages: string[]
}> {
  const metrics = emptyMetrics()
  const messages: string[] = []
  const person_results: Array<{
    full_name: string
    company_name: string
    person_id: string
    corroborated: boolean
    titles_strengthened: number
    linkedin_urls_discovered: number
    signals_accepted: number
    messages: string[]
  }> = []

  const cohort =
    input.cohort ??
    (await loadPersonCommitteeDensityExpansionCohort(admin, {
      include_anchors: input.include_anchors,
      limit: input.limit,
    }))

  const companyIds = cohort.map((c) => c.canonical_company_id)
  const graph_before = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const committee_before = await countCommitteeVerified(admin, companyIds)
  const outreach_before = await countOutreachReadyCompanies(admin, companyIds)
  const verified_channels_before =
    graph_before.metrics.verified_emails_total + graph_before.metrics.verified_phones_total

  const targets = await loadEvidenceBackedPersonTargets(admin, cohort)
  messages.push(`targets: ${targets.length} evidence-backed person(s)`)

  const corroboratedCompanies = new Set<string>()

  for (const target of targets) {
    metrics.persons_processed += 1
    const acquisition = await acquireProfessionalIdentityCorroborationSignals(target)
    const reconciliation = await reconcileProfessionalIdentityCorroboration(admin, {
      target,
      signals: acquisition.signals,
    })

    if (reconciliation.corroborated) {
      metrics.persons_corroborated += 1
      corroboratedCompanies.add(target.company_id)
    }
    metrics.titles_strengthened += reconciliation.titles_strengthened
    metrics.linkedin_urls_discovered += reconciliation.linkedin_urls_discovered

    let channel_jobs = 0
    if (reconciliation.corroborated) {
      channel_jobs = await enqueueChannelJobsForCorroboratedPerson(admin, {
        company_id: target.company_id,
        person_id: target.person_id,
      })
      metrics.channel_jobs_enqueued += channel_jobs
    }

    person_results.push({
      full_name: target.full_name,
      company_name: target.company_name,
      person_id: target.person_id,
      corroborated: reconciliation.corroborated,
      titles_strengthened: reconciliation.titles_strengthened,
      linkedin_urls_discovered: reconciliation.linkedin_urls_discovered,
      signals_accepted: reconciliation.accepted_signals.length,
      messages: [...acquisition.messages, `reconcile: accepted=${reconciliation.accepted_signals.length}`],
    })

    messages.push(
      `${target.full_name}@${target.company_name}: signals=${acquisition.signals.length} corroborated=${reconciliation.corroborated} titles=${reconciliation.titles_strengthened}`,
    )
  }

  if (metrics.titles_strengthened > 0 || metrics.persons_corroborated > 0) {
    for (const company_id of corroboratedCompanies) {
      const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
        company_id,
        force: true,
      })
      metrics.committee_members_promoted += committee.promoted_count
    }
    messages.push(`committee: promoted=${metrics.committee_members_promoted}`)
  } else {
    messages.push("committee: skipped — no corroborated title evidence")
  }

  const graph_after = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const committee_after = await countCommitteeVerified(admin, companyIds)
  const outreach_after = await countOutreachReadyCompanies(admin, companyIds)
  const verified_channels_after =
    graph_after.metrics.verified_emails_total + graph_after.metrics.verified_phones_total

  metrics.verified_channels_promoted = Math.max(
    0,
    verified_channels_after - verified_channels_before,
  )

  const identity_confidence_improved =
    metrics.persons_corroborated > 0 ||
    metrics.titles_strengthened > 0 ||
    metrics.linkedin_urls_discovered > 0
  const channel_readiness_improved =
    metrics.verified_channels_promoted > 0 || outreach_after > outreach_before

  const ok =
    metrics.persons_processed > 0 &&
    identity_confidence_improved &&
    (identity_confidence_improved || channel_readiness_improved)

  return {
    qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
    ok,
    cohort,
    targets,
    metrics,
    before: {
      committee_members_verified: committee_before,
      outreach_ready_companies: outreach_before,
      graph_metrics: graph_before.metrics,
    },
    after: {
      committee_members_verified: committee_after,
      outreach_ready_companies: outreach_after,
      graph_metrics: graph_after.metrics,
    },
    graph_delta: diffProspectGraphExpansionMetrics(graph_before.metrics, graph_after.metrics),
    person_results,
    messages,
  }
}
