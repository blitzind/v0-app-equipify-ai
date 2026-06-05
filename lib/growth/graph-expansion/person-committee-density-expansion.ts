/** Phase 7.PS-HU — Person & committee density expansion on materialized companies. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runWebsiteContactDiscoveryForCompany } from "@/lib/growth/contact-discovery/company-contact-repository"
import { GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS } from "@/lib/growth/graph-expansion/canonical-graph-materialization-types"
import {
  diffProspectGraphExpansionMetrics,
  loadProspectGraphExpansionMetrics,
} from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"
import { resolveObservedProspectSourcesFromContactMetadata } from "@/lib/growth/graph-expansion/prospect-graph-evidence-versioning"
import {
  GROWTH_PS_HE_ANCHOR_COMPANIES,
  GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_QA_MARKER,
  type PersonCommitteeDensityCohortCompany,
  type PersonCommitteeDensityCompanyResult,
  type PersonCommitteeDensityCompanySnapshot,
  type PersonCommitteeDensityExpansionMetrics,
  type PersonCommitteeDensityExpansionResult,
} from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { isGenericIdentityName } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { ensureBuyingCommitteeIntelligenceFoundation } from "@/lib/growth/prospect-search/prospect-search-buying-committee-foundation"
import { runProspectSearchHumanAcquisitionPipeline } from "@/lib/growth/prospect-search/prospect-search-human-acquisition"

const MAX_PERSONS_FOR_CHANNEL_JOBS = 2

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyMetrics(): PersonCommitteeDensityExpansionMetrics {
  return {
    companies_processed: 0,
    companies_with_evidence: 0,
    named_persons_discovered: 0,
    named_persons_promoted: 0,
    titles_discovered: 0,
    titles_promoted: 0,
    emails_discovered: 0,
    phones_discovered: 0,
    social_profiles_discovered: 0,
    committee_members_promoted: 0,
    website_contacts_synced: 0,
    discovery_contacts_total: 0,
    channel_jobs_enqueued: 0,
  }
}

function matchesIcpIndustry(industry: string | null | undefined): boolean {
  const normalized = asString(industry).toLowerCase()
  if (!normalized) return false
  return GROWTH_CANONICAL_GRAPH_MATERIALIZATION_ICP_INDUSTRY_PATTERNS.some((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  )
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

export async function loadPersonCommitteeDensityExpansionCohort(
  admin: SupabaseClient,
  input: { include_anchors?: boolean; limit?: number } = {},
): Promise<PersonCommitteeDensityCohortCompany[]> {
  const limit = input.limit ?? 40
  const cohort: PersonCommitteeDensityCohortCompany[] = []
  const seen = new Set<string>()

  const { data: discoveryRows } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, canonical_company_id, industry")
    .not("canonical_company_id", "is", null)
    .limit(Math.max(limit * 3, 120))

  const icpRows = (discoveryRows ?? []).filter((row) =>
    matchesIcpIndustry(asString((row as Record<string, unknown>).industry)),
  )

  for (const row of icpRows) {
    const canonical_company_id = asString((row as Record<string, unknown>).canonical_company_id)
    const company_candidate_id = asString((row as Record<string, unknown>).company_id)
    const company_name = asString((row as Record<string, unknown>).company_name)
    if (!canonical_company_id || !company_candidate_id || seen.has(canonical_company_id)) continue

    const { data: company } = await admin
      .schema("growth")
      .from("companies")
      .select("id, metadata")
      .eq("id", canonical_company_id)
      .maybeSingle()

    const metadata =
      company?.metadata && typeof company.metadata === "object"
        ? (company.metadata as Record<string, unknown>)
        : {}
    if (asString(metadata.first_source_table) !== "discovery_candidates") continue

    seen.add(canonical_company_id)
    cohort.push({
      company_candidate_id,
      canonical_company_id,
      company_name: company_name || "Unknown",
      search_query: "biomedical equipment service companies",
      cohort_kind: "ps_ht_new",
    })
    if (cohort.filter((c) => c.cohort_kind === "ps_ht_new").length >= limit) break
  }

  if (input.include_anchors !== false) {
    for (const anchor of GROWTH_PS_HE_ANCHOR_COMPANIES) {
      if (seen.has(anchor.canonical_company_id)) continue
      seen.add(anchor.canonical_company_id)
      cohort.push({ ...anchor })
    }
  }

  return cohort
}

export async function loadPersonCommitteeDensityCompanySnapshot(
  admin: SupabaseClient,
  input: {
    canonical_company_id: string
    company_name: string
    cohort_kind: PersonCommitteeDensityCohortCompany["cohort_kind"]
  },
): Promise<PersonCommitteeDensityCompanySnapshot> {
  const company_id = input.canonical_company_id
  let named_persons = 0
  let titled_persons = 0
  const personIds = new Set<string>()

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("canonical_person_id, full_name, title, email, phone, linkedin_url")
    .eq("company_id", company_id)
    .neq("contact_status", "archived")

  for (const row of contacts ?? []) {
    const fullName = asString((row as Record<string, unknown>).full_name)
    const title = asString((row as Record<string, unknown>).title)
    const personId = asString((row as Record<string, unknown>).canonical_person_id)
    if (fullName && !isGenericIdentityName(fullName)) named_persons += 1
    if (title) titled_persons += 1
    if (personId) personIds.add(personId)
    if (asString((row as Record<string, unknown>).email)) {
      /* counted via verified tables below */
    }
  }

  const { data: roles } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id, title")
    .eq("company_id", company_id)

  for (const row of roles ?? []) {
    const personId = asString((row as Record<string, unknown>).person_id)
    const title = asString((row as Record<string, unknown>).title)
    if (personId) personIds.add(personId)
    if (title) titled_persons += 1
  }

  if (personIds.size > 0) {
    const { data: persons } = await admin
      .schema("growth")
      .from("persons")
      .select("id, full_name")
      .in("id", [...personIds])
    for (const row of persons ?? []) {
      const name = asString((row as Record<string, unknown>).full_name)
      if (name && !isGenericIdentityName(name)) named_persons += 1
    }
  }

  let verified_emails = 0
  let verified_phones = 0
  let verified_profiles = 0
  if (personIds.size > 0) {
    const ids = [...personIds]
    const [{ count: emailCount }, { count: phoneCount }, { count: profileCount }] = await Promise.all([
      admin
        .schema("growth")
        .from("person_emails")
        .select("id", { count: "exact", head: true })
        .in("person_id", ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_phones")
        .select("id", { count: "exact", head: true })
        .in("person_id", ids)
        .eq("verification_status", "verified"),
      admin
        .schema("growth")
        .from("person_profiles")
        .select("id", { count: "exact", head: true })
        .in("person_id", ids)
        .eq("verification_status", "verified"),
    ])
    verified_emails = emailCount ?? 0
    verified_phones = phoneCount ?? 0
    verified_profiles = profileCount ?? 0
  }

  const { count: committeeCount } = await admin
    .schema("growth")
    .from("buying_committee_intelligence_members")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company_id)
    .eq("verification_status", "verified")

  const outreach_ready =
    named_persons > 0 && (verified_emails > 0 || verified_phones > 0)

  return {
    canonical_company_id: company_id,
    company_name: input.company_name,
    cohort_kind: input.cohort_kind,
    named_persons,
    titled_persons,
    committee_members_verified: committeeCount ?? 0,
    verified_emails,
    verified_phones,
    verified_profiles,
    outreach_ready,
  }
}

export async function countOutreachReadyCompanies(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<number> {
  let ready = 0
  for (const company_id of company_ids) {
    const snapshot = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: company_id,
      company_name: "",
      cohort_kind: "ps_ht_new",
    })
    if (snapshot.outreach_ready) ready += 1
  }
  return ready
}

async function runChannelJobsForCompany(
  admin: SupabaseClient,
  input: { canonical_company_id: string; person_ids: string[] },
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
  for (const person_id of input.person_ids.slice(0, MAX_PERSONS_FOR_CHANNEL_JOBS)) {
    const email = await enqueueEmailDiscoveryJob(admin, {
      company_id: input.canonical_company_id,
      person_id,
      promote_on_complete: true,
      trigger_source: "manual",
    })
    if (email.enqueued) enqueued += 1

    const phone = await enqueuePhoneDiscoveryJob(admin, {
      company_id: input.canonical_company_id,
      person_id,
      promote_on_complete: true,
      trigger_source: "manual",
    })
    if (phone.enqueued) enqueued += 1

    const social = await enqueueSocialProfileDiscoveryJob(admin, {
      company_id: input.canonical_company_id,
      person_id,
      discovery_scope: "person",
      promote_on_complete: true,
      trigger_source: "manual",
    })
    if (social.enqueued) enqueued += 1
  }

  await processEmailDiscoveryJobQueue(admin, 8)
  await processPhoneDiscoveryJobQueue(admin, 8)
  await processSocialProfileDiscoveryJobQueue(admin, 8)
  return enqueued
}

async function loadPersonIdsForCompany(
  admin: SupabaseClient,
  company_id: string,
): Promise<string[]> {
  const { data: roles } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("person_id")
    .eq("company_id", company_id)
  return [...new Set((roles ?? []).map((r) => asString(r.person_id)).filter(Boolean))]
}

export async function runPersonCommitteeDensityExpansion(
  admin: SupabaseClient,
  input: {
    cohort?: PersonCommitteeDensityCohortCompany[]
    include_anchors?: boolean
    run_channel_jobs?: boolean
    limit?: number
  } = {},
): Promise<PersonCommitteeDensityExpansionResult> {
  const messages: string[] = []
  const metrics = emptyMetrics()
  const company_results: PersonCommitteeDensityCompanyResult[] = []

  const cohort =
    input.cohort ??
    (await loadPersonCommitteeDensityExpansionCohort(admin, {
      include_anchors: input.include_anchors,
      limit: input.limit,
    }))

  const companyIds = cohort.map((c) => c.canonical_company_id)
  const cohort_before = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const outreach_before = await countOutreachReadyCompanies(admin, companyIds)

  for (const target of cohort) {
    metrics.companies_processed += 1
    const before = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: target.canonical_company_id,
      company_name: target.company_name,
      cohort_kind: target.cohort_kind,
    })

    const resultMessages: string[] = []
    let website_contacts_synced = 0

    const website = await loadCompanyWebsite(admin, target.canonical_company_id)
    if (website) {
      const websiteSnapshot = await runWebsiteContactDiscoveryForCompany(admin, {
        company_id: target.canonical_company_id,
        website,
      })
      website_contacts_synced = websiteSnapshot.contacts.length
      metrics.website_contacts_synced += website_contacts_synced
      resultMessages.push(
        `website_crawl: ${website_contacts_synced} contact row(s) from team/about/leadership/contact/schema pages`,
      )
    } else {
      resultMessages.push("website_crawl: skipped — no website on canonical company")
    }

    const acquisition = await runProspectSearchHumanAcquisitionPipeline(admin, {
      company_candidate_id: target.company_candidate_id,
      canonical_company_id: target.canonical_company_id,
      run_discovery: true,
      search_query: target.search_query,
    })

    metrics.discovery_contacts_total += acquisition.discovery_contacts
    metrics.named_persons_promoted += acquisition.backfill_persons_linked
    metrics.named_persons_discovered += acquisition.discovery_contacts

    if (acquisition.discovery_contacts > 0 || website_contacts_synced > 0) {
      metrics.companies_with_evidence += 1
    }

    const { data: contactRows } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("title, email, phone, linkedin_url, source_type, source_evidence, metadata")
      .eq("company_id", target.canonical_company_id)
      .neq("contact_status", "archived")

    const sourceTypes = new Set<string>()
    for (const row of contactRows ?? []) {
      const title = asString((row as Record<string, unknown>).title)
      if (title) metrics.titles_discovered += 1
      if (asString((row as Record<string, unknown>).email)) metrics.emails_discovered += 1
      if (asString((row as Record<string, unknown>).phone)) metrics.phones_discovered += 1
      if (asString((row as Record<string, unknown>).linkedin_url)) metrics.social_profiles_discovered += 1

      for (const source of resolveObservedProspectSourcesFromContactMetadata({
        source_type: asString((row as Record<string, unknown>).source_type),
        metadata:
          (row as Record<string, unknown>).metadata &&
          typeof (row as Record<string, unknown>).metadata === "object"
            ? ((row as Record<string, unknown>).metadata as Record<string, unknown>)
            : {},
        source_evidence: Array.isArray((row as Record<string, unknown>).source_evidence)
          ? ((row as Record<string, unknown>).source_evidence as Array<{ source?: string }>)
          : [],
      })) {
        sourceTypes.add(source)
      }
    }

    let channel_jobs_enqueued = 0
    if (input.run_channel_jobs !== false && acquisition.backfill_persons_linked > 0) {
      const person_ids = await loadPersonIdsForCompany(admin, target.canonical_company_id)
      channel_jobs_enqueued = await runChannelJobsForCompany(admin, {
        canonical_company_id: target.canonical_company_id,
        person_ids,
      })
      metrics.channel_jobs_enqueued += channel_jobs_enqueued
    }

    const committee = await ensureBuyingCommitteeIntelligenceFoundation(admin, {
      company_id: target.canonical_company_id,
    })
    metrics.committee_members_promoted += committee.promoted_count

    const after = await loadPersonCommitteeDensityCompanySnapshot(admin, {
      canonical_company_id: target.canonical_company_id,
      company_name: target.company_name,
      cohort_kind: target.cohort_kind,
    })

    metrics.titles_promoted += Math.max(0, after.titled_persons - before.titled_persons)

    company_results.push({
      company_name: target.company_name,
      canonical_company_id: target.canonical_company_id,
      cohort_kind: target.cohort_kind,
      ok: acquisition.ok || website_contacts_synced > 0 || committee.promoted_count > 0,
      before,
      after,
      acquisition: {
        discovery_contacts: acquisition.discovery_contacts,
        website_contacts_synced,
        persons_linked: acquisition.backfill_persons_linked,
        company_contacts_synced: acquisition.company_contacts_synced,
      },
      committee: {
        ran: committee.ran,
        skipped_reason: committee.skipped_reason,
        verified_member_count: committee.verified_member_count,
        promoted_count: committee.promoted_count,
      },
      source_types_observed: [...sourceTypes],
      messages: [...resultMessages, acquisition.message],
    })

    messages.push(
      `${target.company_name}: discovery=${acquisition.discovery_contacts} persons=${acquisition.backfill_persons_linked} committee=${committee.promoted_count}`,
    )
  }

  const cohort_after = await loadProspectGraphExpansionMetrics(admin, { company_ids: companyIds })
  const outreach_after = await countOutreachReadyCompanies(admin, companyIds)

  const ok =
    metrics.companies_processed > 0 &&
    (metrics.named_persons_promoted > 0 ||
      metrics.committee_members_promoted > 0 ||
      metrics.companies_with_evidence > 0)

  return {
    qa_marker: GROWTH_PERSON_COMMITTEE_DENSITY_EXPANSION_QA_MARKER,
    ok,
    cohort,
    metrics,
    company_results,
    cohort_metrics: {
      before: cohort_before.metrics,
      after: cohort_after.metrics,
      delta: diffProspectGraphExpansionMetrics(cohort_before.metrics, cohort_after.metrics),
    },
    outreach_ready_companies: {
      before: outreach_before,
      after: outreach_after,
      delta: outreach_after - outreach_before,
    },
    messages,
  }
}
