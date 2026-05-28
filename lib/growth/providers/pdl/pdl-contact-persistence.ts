import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { companyContactDedupeHash } from "@/lib/growth/contact-discovery/website-contact-discovery"
import { scoreDecisionMakerTitle } from "@/lib/growth/contact-discovery/decision-maker-score"
import {
  GROWTH_COMPANY_CONTACTS_QA_MARKER,
} from "@/lib/growth/contact-discovery/company-contact-types"
import { isGrowthCompanyContactsSchemaReady } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import type { GrowthContactDiscoveryProviderRawContact } from "@/lib/growth/contact-discovery/contact-discovery-provider-types"
import { filterNewContacts, findExistingContactDedupeHashes } from "@/lib/growth/contact-discovery/contact-dedupe"
import {
  dedupeNormalizedContacts,
  normalizeContactCandidate,
} from "@/lib/growth/contact-discovery/contact-normalizer"
import { GROWTH_PDL_PROVIDER_QA_MARKER } from "@/lib/growth/providers/pdl/pdl-types"

function providerContactToCompanyRow(input: {
  company_id: string
  growth_lead_id?: string | null
  provider_name: string
  provider_type: string
  contact: GrowthContactDiscoveryProviderRawContact
}): Record<string, unknown> {
  const score = scoreDecisionMakerTitle({
    title: input.contact.job_title,
    source_type: "public_record",
    evidence_count: input.contact.evidence.length,
    has_website_evidence: false,
    exact_title_match: Boolean(input.contact.job_title),
  })

  const dedupe_hash = companyContactDedupeHash({
    company_id: input.company_id,
    full_name: input.contact.full_name,
    title: input.contact.job_title ?? null,
    email: input.contact.email ?? null,
  })

  return {
    company_id: input.company_id,
    growth_lead_id: input.growth_lead_id ?? null,
    full_name: input.contact.full_name,
    first_name: input.contact.first_name ?? null,
    last_name: input.contact.last_name ?? null,
    title: input.contact.job_title ?? null,
    department: input.contact.department ?? null,
    email: input.contact.email ?? null,
    email_status: input.contact.email ? "discovered" : "unknown",
    phone: input.contact.phone ?? null,
    phone_status: input.contact.phone ? "unknown" : "unknown",
    linkedin_url: input.contact.linkedin_url ?? null,
    confidence_score: Math.max(score.confidence_score, input.contact.confidence ?? 0),
    decision_maker_score: score.decision_maker_score,
    source_type: "public_record",
    source_evidence: input.contact.evidence.map((item) => ({
      claim: item.claim,
      evidence: item.evidence,
      source: item.source,
    })),
    contact_status: "candidate",
    dedupe_hash,
    metadata: {
      qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
      pdl_provider_qa_marker: GROWTH_PDL_PROVIDER_QA_MARKER,
      discovery_provider: input.provider_name,
      provider_type: input.provider_type,
      ...(input.contact.metadata ?? {}),
    },
  }
}

export async function upsertProviderCompanyContacts(
  admin: SupabaseClient,
  input: {
    company_id: string
    growth_lead_id?: string | null
    provider_type: string
    provider_name: string
    contacts: GrowthContactDiscoveryProviderRawContact[]
  },
): Promise<number> {
  if (!(await isGrowthCompanyContactsSchemaReady(admin))) return 0
  let stored = 0
  const nowIso = new Date().toISOString()

  for (const contact of input.contacts) {
    const row = providerContactToCompanyRow({
      company_id: input.company_id,
      growth_lead_id: input.growth_lead_id,
      provider_name: input.provider_name,
      provider_type: input.provider_type,
      contact,
    })
    const dedupe_hash = String(row.dedupe_hash ?? "")

    const { data: existing } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", input.company_id)
      .eq("dedupe_hash", dedupe_hash)
      .maybeSingle()

    if (existing) {
      const prior = existing as Record<string, unknown>
      const { data, error } = await admin
        .schema("growth")
        .from("company_contacts")
        .update({
          email: prior.email ?? row.email,
          phone: prior.phone ?? row.phone,
          linkedin_url: prior.linkedin_url ?? row.linkedin_url,
          title: prior.title ?? row.title,
          confidence_score: Math.max(
            Number(prior.confidence_score ?? 0),
            Number(row.confidence_score ?? 0),
          ),
          updated_at: nowIso,
          metadata: {
            ...(prior.metadata && typeof prior.metadata === "object"
              ? (prior.metadata as Record<string, unknown>)
              : {}),
            ...(row.metadata as Record<string, unknown>),
            last_checked_at: nowIso,
            discovery_provider: input.provider_name,
          },
        })
        .eq("id", prior.id)
        .select("*")
        .single()
      if (!error && data) stored += 1
      continue
    }

    const { data, error } = await admin
      .schema("growth")
      .from("company_contacts")
      .insert({
        ...row,
        metadata: {
          ...(row.metadata as Record<string, unknown>),
          last_checked_at: nowIso,
          discovery_provider: input.provider_name,
        },
      })
      .select("*")
      .single()

    if (!error) stored += 1
  }

  return stored
}

export async function persistPdlContactsToCandidates(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    provider_name: string
    provider_type: string
    contacts: GrowthContactDiscoveryProviderRawContact[]
  },
): Promise<number> {
  const normalized = input.contacts
    .map((raw) => normalizeContactCandidate(raw, input.provider_name, input.provider_type, input.company_candidate_id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  if (normalized.length === 0) return 0

  const deduped = dedupeNormalizedContacts(normalized)
  const existingHashes = await findExistingContactDedupeHashes(
    admin,
    input.company_candidate_id,
    deduped.map((row) => row.dedupe_hash),
  )
  const toInsert = filterNewContacts(deduped, existingHashes)
  if (toInsert.length === 0) return 0

  const { error } = await admin.schema("growth").from("contact_candidates").insert(
    toInsert.map((row) => ({
      company_candidate_id: input.company_candidate_id,
      provider_name: input.provider_name,
      provider_type: input.provider_type,
      full_name: row.full_name,
      first_name: row.first_name,
      last_name: row.last_name,
      job_title: row.job_title,
      department: row.department,
      seniority: row.seniority,
      linkedin_url: row.linkedin_url,
      email: row.email,
      phone: row.phone,
      verification_state: row.verification_state,
      confidence: row.confidence,
      source_attribution: row.source_attribution,
      evidence: row.evidence,
      dedupe_hash: row.dedupe_hash,
      metadata: row.metadata,
    })),
  )

  if (error) throw new Error(error.message)
  return toInsert.length
}
