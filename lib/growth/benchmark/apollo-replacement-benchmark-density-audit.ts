/** Phase 7.PS-IK — Benchmark cohort segmentation audit. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { scoreServiceShopFit } from "@/lib/growth/graph-expansion/service-shop-score"
import { evaluateServiceShopPersonCandidate } from "@/lib/growth/graph-expansion/service-shop-person-fragment-rejection"
import { GROWTH_PS_HE_ANCHOR_COMPANIES } from "@/lib/growth/graph-expansion/person-committee-density-expansion-types"
import { loadPersonCommitteeDensityCompanySnapshot } from "@/lib/growth/graph-expansion/person-committee-density-expansion"
import { personHasVerifiedReachableChannel } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-metrics"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import type {
  ApolloBenchmarkCohortSegment,
  ApolloBenchmarkCohortSegmentation,
  ApolloBenchmarkDensityTargetRow,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-improvement-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const anchorIds = new Set(GROWTH_PS_HE_ANCHOR_COMPANIES.map((a) => a.canonical_company_id))
const anchorNameById = new Map(
  GROWTH_PS_HE_ANCHOR_COMPANIES.map((a) => [a.canonical_company_id, a.company_name]),
)

export type ApolloBenchmarkCompanyAuditRow = {
  canonical_company_id: string
  company_name: string
  segment: ApolloBenchmarkCohortSegment
  service_shop_score: number
  is_ps_he_anchor: boolean
  has_website: boolean
  contact_count: number
  named_person_count: number
  has_real_named_person: boolean
}

async function resolveCompanyCandidateIds(
  admin: SupabaseClient,
  canonical_company_ids: string[],
): Promise<Map<string, { company_candidate_id: string; company_name: string }>> {
  const map = new Map<string, { company_candidate_id: string; company_name: string }>()
  if (canonical_company_ids.length === 0) return map

  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("id, company_id, company_name, canonical_company_id")
    .in("canonical_company_id", canonical_company_ids)

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

export async function auditApolloReplacementBenchmarkCohort(
  admin: SupabaseClient,
  company_ids: string[],
): Promise<{
  segmentation: ApolloBenchmarkCohortSegmentation
  companies: ApolloBenchmarkCompanyAuditRow[]
  selected_blocker: "generic_channels_only_no_named_persons"
  blocker_rationale: string
}> {
  const segmentation: ApolloBenchmarkCohortSegmentation = {
    no_contacts: 0,
    generic_channels_only: 0,
    named_without_verified_channel: 0,
    titled_without_committee: 0,
    verified_channel_not_outreach_ready: 0,
    outreach_ready: 0,
  }

  const candidateByCanonical = await resolveCompanyCandidateIds(admin, company_ids)

  const { data: companies } = await admin
    .schema("growth")
    .from("companies")
    .select("id, website, primary_domain, industry")
    .in("id", company_ids)

  const metaById = new Map<string, { website: string | null; industry: string | null }>()
  for (const row of companies ?? []) {
    const id = asString((row as Record<string, unknown>).id)
    metaById.set(id, {
      website:
        asString((row as Record<string, unknown>).website) ||
        asString((row as Record<string, unknown>).primary_domain) ||
        null,
      industry: asString((row as Record<string, unknown>).industry) || null,
    })
  }

  const { data: contacts } = await admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type, metadata",
    )
    .in("company_id", company_ids)
    .neq("contact_status", "archived")

  const contactsByCompany = new Map<string, Array<Record<string, unknown>>>()
  for (const row of contacts ?? []) {
    const record = row as Record<string, unknown>
    const company_id = asString(record.company_id)
    if (!contactsByCompany.has(company_id)) contactsByCompany.set(company_id, [])
    contactsByCompany.get(company_id)!.push(record)
  }

  const auditRows: ApolloBenchmarkCompanyAuditRow[] = []

  for (const canonical_company_id of company_ids) {
    const meta = metaById.get(canonical_company_id)
    const candidate = candidateByCanonical.get(canonical_company_id)
    const company_name =
      anchorNameById.get(canonical_company_id) ||
      candidate?.company_name ||
      canonical_company_id
    const has_website = Boolean(meta?.website)
    const rows = contactsByCompany.get(canonical_company_id) ?? []
    const is_ps_he_anchor = anchorIds.has(canonical_company_id)

    const shopScore = scoreServiceShopFit({
      company_name,
      industry: meta?.industry ?? "biomedical equipment service",
      source_tags: is_ps_he_anchor ? ["ps_he_anchor"] : [],
      website: meta?.website ?? null,
      domain: null,
      anchor_bonus: is_ps_he_anchor,
    })

    let segment: ApolloBenchmarkCohortSegment = "generic_channels_only"
    let has_real_named_person = false
    let named_without_verified = 0

    if (rows.length === 0) {
      segment = "no_contacts"
      segmentation.no_contacts += 1
    } else {
      let genericOnly = true
      for (const row of rows) {
        const identity = classifyContactIdentity({
          full_name: asString(row.full_name),
          title: asString(row.title),
          email: asString(row.email),
          phone: asString(row.phone),
          linkedin_url: asString(row.linkedin_url),
          source_type: asString(row.source_type),
        })
        if (
          identity.classification !== "company_channel" &&
          identity.classification !== "generic_placeholder"
        ) {
          genericOnly = false
        }

        const fragmentEval = evaluateServiceShopPersonCandidate({
          full_name: asString(row.full_name),
          company_name,
          title: asString(row.title),
          service_shop_score: shopScore.score,
          is_ps_he_anchor,
        })
        if (identity.classification === "named_person" && fragmentEval.accepted) {
          has_real_named_person = true
          const person_id = asString(row.canonical_person_id)
          if (person_id) {
            const verified = await personHasVerifiedReachableChannel(admin, person_id)
            if (!verified) named_without_verified += 1
          }
        }
      }

      const snapshot = await loadPersonCommitteeDensityCompanySnapshot(admin, {
        canonical_company_id,
        company_name,
        cohort_kind: is_ps_he_anchor ? "ps_he_anchor" : "ps_ht_new",
      })

      if (snapshot.outreach_ready) {
        segment = "outreach_ready"
        segmentation.outreach_ready += 1
      } else if (named_without_verified > 0) {
        segment = "named_without_verified_channel"
        segmentation.named_without_verified_channel += 1
      } else if (genericOnly) {
        segment = "generic_channels_only"
        segmentation.generic_channels_only += 1
      } else if (snapshot.titled_persons > 0 && snapshot.committee_members_verified === 0) {
        segment = "titled_without_committee"
        segmentation.titled_without_committee += 1
      } else if (
        (snapshot.verified_emails > 0 || snapshot.verified_phones > 0) &&
        !snapshot.outreach_ready
      ) {
        segment = "verified_channel_not_outreach_ready"
        segmentation.verified_channel_not_outreach_ready += 1
      } else {
        segment = "generic_channels_only"
        segmentation.generic_channels_only += 1
      }
    }

    auditRows.push({
      canonical_company_id,
      company_name,
      segment,
      service_shop_score: shopScore.score,
      is_ps_he_anchor,
      has_website,
      contact_count: rows.length,
      named_person_count: rows.filter(
        (r) =>
          classifyContactIdentity({
            full_name: asString(r.full_name),
            title: asString(r.title),
          }).classification === "named_person",
      ).length,
      has_real_named_person,
    })
  }

  return {
    segmentation,
    companies: auditRows,
    selected_blocker: "generic_channels_only_no_named_persons",
    blocker_rationale:
      `${segmentation.generic_channels_only} of ${company_ids.length} benchmark companies have only generic company-channel contacts and no evidence-backed named person — the largest gap versus named-person and outreach-ready benchmark targets.`,
  }
}

export function selectApolloBenchmarkDensityTargets(
  audit: ApolloBenchmarkCompanyAuditRow[],
  candidateByCanonical: Map<string, { company_candidate_id: string; company_name: string }>,
  input: { max_targets?: number } = {},
): ApolloBenchmarkDensityTargetRow[] {
  const max_targets = input.max_targets ?? 8

  const eligible = audit.filter(
    (row) =>
      !row.has_real_named_person &&
      row.segment !== "outreach_ready" &&
      candidateByCanonical.has(row.canonical_company_id),
  )

  const ranked = [...eligible].sort((a, b) => {
    if (a.is_ps_he_anchor !== b.is_ps_he_anchor) return a.is_ps_he_anchor ? -1 : 1
    if (a.has_website !== b.has_website) return a.has_website ? -1 : 1
    if (a.segment === "no_contacts" && b.segment !== "no_contacts") return 1
    if (b.segment === "no_contacts" && a.segment !== "no_contacts") return -1
    return b.service_shop_score - a.service_shop_score
  })

  return ranked.slice(0, max_targets).map((row) => {
    const candidate = candidateByCanonical.get(row.canonical_company_id)!
    return {
      canonical_company_id: row.canonical_company_id,
      company_candidate_id: candidate.company_candidate_id,
      company_name: row.company_name || candidate.company_name,
      segment: row.segment,
      service_shop_score: row.service_shop_score,
      is_ps_he_anchor: row.is_ps_he_anchor,
      has_website: row.has_website,
      contact_count: row.contact_count,
    }
  })
}
