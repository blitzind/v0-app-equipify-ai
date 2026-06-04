import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { discoverWebsiteContacts } from "@/lib/growth/contact-discovery/website-contact-discovery"
import { searchPdlPeopleByCompany } from "@/lib/growth/providers/pdl/pdl-client"
import { mapPdlPersonToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
import { canonicalNormalizedPersonPhone } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import { personNameMatchesDiscoveryContact } from "@/lib/growth/email-discovery/email-discovery-name-match"
import {
  baseConfidenceForPhoneSource,
  confidenceTierForPhoneDiscovery,
} from "@/lib/growth/phone-discovery/phone-discovery-confidence"
import type { GrowthPhoneDiscoveryDraftCandidate } from "@/lib/growth/phone-discovery/phone-discovery-types"

export type PhoneDiscoveryPersonContext = {
  person_id: string
  company_id: string
  company_name: string
  normalized_name: string
  first_name: string | null
  last_name: string | null
  full_name: string
  primary_domain: string | null
  website_url: string | null
}

function draftFromPhone(input: {
  phone: string
  source: GrowthPhoneDiscoveryDraftCandidate["source"]
  provider_name: string
  discovery_source: string
  evidence_type: GrowthPhoneDiscoveryDraftCandidate["evidence"][number]["evidence_type"]
  evidence_text: string
  source_url?: string | null
  source_record_id?: string | null
  extraction_method?: string | null
  confidence?: number
  phone_type?: GrowthPhoneDiscoveryDraftCandidate["phone_type"]
  staging_trusted?: boolean
}): GrowthPhoneDiscoveryDraftCandidate | null {
  const normalized = canonicalNormalizedPersonPhone(input.phone)
  if (!normalized) return null

  const base = input.confidence ?? baseConfidenceForPhoneSource(input.source)
  const confidence_tier = confidenceTierForPhoneDiscovery({
    source: input.source,
    verification_status: "unverified",
    base_confidence: base,
  })

  return {
    phone: input.phone.trim(),
    normalized_phone: normalized,
    phone_type: input.phone_type ?? "unknown",
    source: input.source,
    confidence: base,
    confidence_tier,
    provider_name: input.provider_name,
    discovery_source: input.discovery_source,
    staging_trusted: input.staging_trusted,
    evidence: [
      {
        evidence_type: input.evidence_type,
        source_url: input.source_url ?? null,
        source_record_id: input.source_record_id ?? null,
        extraction_method: input.extraction_method ?? input.evidence_type,
        evidence_text: input.evidence_text,
        confidence: base,
      },
    ],
  }
}

export async function collectWebsitePhoneDiscoveryCandidates(
  ctx: PhoneDiscoveryPersonContext,
): Promise<{ drafts: GrowthPhoneDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const website = ctx.website_url?.trim() || (ctx.primary_domain ? `https://${ctx.primary_domain}` : null)
  if (!website) {
    messages.push("Website source skipped: no website URL or primary domain.")
    return { drafts: [], messages }
  }

  const discovery = await discoverWebsiteContacts(website)
  const drafts: GrowthPhoneDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  for (const contact of discovery.contacts) {
    const phone = contact.phone?.trim() || contact.branch_phone?.trim() || ""
    if (!phone) continue
    if (!personNameMatchesDiscoveryContact({
      person_normalized_name: ctx.normalized_name,
      contact_full_name: contact.full_name,
    })) {
      continue
    }

    const isStructured = contact.source_page_type === "schema_org"
    const draft = draftFromPhone({
      phone,
      source: "website",
      provider_name: "website_public_extract",
      discovery_source: contact.source_page_type ?? "website",
      evidence_type: isStructured ? "website_structured" : "tel_link",
      evidence_text:
        contact.source_evidence[0]?.evidence ??
        `Phone listed on ${contact.source_page_url ?? website} (${contact.source_page_type ?? "page"}).`,
      source_url: contact.source_page_url ?? website,
      extraction_method: isStructured ? "schema_org" : "html_extract",
      confidence: Math.min(0.92, (contact.evidence_quality_score ?? 70) / 100),
      phone_type: contact.phone_classification === "mobile" ? "mobile" : "business",
    })
    if (!draft || seen.has(draft.normalized_phone)) continue
    seen.add(draft.normalized_phone)
    drafts.push(draft)
  }

  messages.push(`Website: ${drafts.length} person-matched phone(s) from ${discovery.pages_crawled.length} page(s).`)
  return { drafts, messages }
}

function stagingPhoneTrusted(input: {
  phone_status?: string | null
  contact_status?: string | null
}): boolean {
  if (input.contact_status === "verified") return true
  if (input.phone_status === "verified") return true
  return false
}

export async function collectStagingPhoneDiscoveryCandidates(
  admin: SupabaseClient,
  ctx: PhoneDiscoveryPersonContext,
): Promise<{ drafts: GrowthPhoneDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const drafts: GrowthPhoneDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  const { data: companyContacts, error: ccErr } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, phone, full_name, source_type, phone_status, contact_status")
    .eq("canonical_person_id", ctx.person_id)
    .not("phone", "is", null)
  if (ccErr) messages.push(`company_contacts: ${ccErr.message}`)
  else {
    for (const row of companyContacts ?? []) {
      const phone = typeof row.phone === "string" ? row.phone : ""
      if (!phone.trim()) continue
      const trusted = stagingPhoneTrusted({
        phone_status: typeof row.phone_status === "string" ? row.phone_status : null,
        contact_status: typeof row.contact_status === "string" ? row.contact_status : null,
      })
      const draft = draftFromPhone({
        phone,
        source: "staging_contact",
        provider_name: "company_contacts",
        discovery_source: (typeof row.source_type === "string" && row.source_type) || "company_contacts",
        evidence_type: "staging_row",
        evidence_text: `company_contacts ${row.id} linked to canonical person.`,
        source_record_id: String(row.id),
        extraction_method: "staging_ingest",
        staging_trusted: trusted,
        confidence: trusted ? 0.9 : baseConfidenceForPhoneSource("staging_contact"),
      })
      if (!draft || seen.has(draft.normalized_phone)) continue
      seen.add(draft.normalized_phone)
      drafts.push(draft)
    }
  }

  const { data: candidates, error: candErr } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, phone, full_name, provider_name, verification_state")
    .eq("canonical_person_id", ctx.person_id)
    .not("phone", "is", null)
  if (candErr) messages.push(`contact_candidates: ${candErr.message}`)
  else {
    for (const row of candidates ?? []) {
      const phone = typeof row.phone === "string" ? row.phone : ""
      if (!phone.trim()) continue
      const trusted = row.verification_state === "verified" || row.verification_state === "operator_verified"
      const draft = draftFromPhone({
        phone,
        source: "staging_contact",
        provider_name: (typeof row.provider_name === "string" && row.provider_name) || "contact_candidates",
        discovery_source: "contact_candidates",
        evidence_type: "staging_row",
        evidence_text: `contact_candidates ${row.id} linked to canonical person.`,
        source_record_id: String(row.id),
        extraction_method: "staging_ingest",
        staging_trusted: trusted,
      })
      if (!draft || seen.has(draft.normalized_phone)) continue
      seen.add(draft.normalized_phone)
      drafts.push(draft)
    }
  }

  const { data: decisionMakers, error: dmErr } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, phone, full_name, source")
    .eq("canonical_person_id", ctx.person_id)
    .not("phone", "is", null)
  if (dmErr) messages.push(`lead_decision_makers: ${dmErr.message}`)
  else {
    for (const row of decisionMakers ?? []) {
      const phone = typeof row.phone === "string" ? row.phone : ""
      if (!phone.trim()) continue
      const draft = draftFromPhone({
        phone,
        source: "staging_contact",
        provider_name: "lead_decision_makers",
        discovery_source: (typeof row.source === "string" && row.source) || "lead_decision_makers",
        evidence_type: "staging_row",
        evidence_text: `lead_decision_makers ${row.id} linked to canonical person.`,
        source_record_id: String(row.id),
        extraction_method: "staging_ingest",
      })
      if (!draft || seen.has(draft.normalized_phone)) continue
      seen.add(draft.normalized_phone)
      drafts.push(draft)
    }
  }

  messages.push(`Staging: ${drafts.length} phone(s) from linked ingestion rows.`)
  return { drafts, messages }
}

export async function collectCanonicalChannelPhoneDiscoveryCandidates(
  admin: SupabaseClient,
  ctx: PhoneDiscoveryPersonContext,
): Promise<{ drafts: GrowthPhoneDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const drafts: GrowthPhoneDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  const { data: rows } = await admin
    .schema("growth")
    .from("person_phones")
    .select("id, phone, normalized_phone, phone_type, verification_status, source_table")
    .eq("person_id", ctx.person_id)

  for (const row of rows ?? []) {
    const phone = typeof row.phone === "string" ? row.phone : ""
    if (!phone.trim()) continue
    const trusted =
      row.verification_status === "verified" || row.verification_status === "operator_verified"
    const draft = draftFromPhone({
      phone,
      source: "canonical_channel",
      provider_name: "person_phones",
      discovery_source: (typeof row.source_table === "string" && row.source_table) || "person_phones",
      evidence_type: "canonical_channel",
      evidence_text: `Existing person_phones ${row.id} on canonical person (re-evaluation).`,
      source_record_id: String(row.id),
      extraction_method: "canonical_channel_read",
      staging_trusted: trusted,
      phone_type:
        row.phone_type === "mobile" || row.phone_type === "business" ? row.phone_type : "unknown",
      confidence: trusted ? 0.9 : 0.75,
    })
    if (!draft || seen.has(draft.normalized_phone)) continue
    seen.add(draft.normalized_phone)
    drafts.push(draft)
  }

  messages.push(`Canonical channel: ${drafts.length} existing person_phones row(s).`)
  return { drafts, messages }
}

export async function collectPdlPhoneDiscoveryCandidates(
  ctx: PhoneDiscoveryPersonContext,
): Promise<{ drafts: GrowthPhoneDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  if (!ctx.primary_domain && !ctx.full_name) {
    messages.push("PDL source skipped: missing company domain and name.")
    return { drafts: [], messages }
  }

  const result = await searchPdlPeopleByCompany({
    company_name: ctx.company_name,
    domain: ctx.primary_domain,
    limit: 25,
    prefer_reachable: true,
  })

  if (result.status !== "success") {
    messages.push(`PDL: ${result.status} — ${result.message ?? "no results"}`)
    return { drafts: [], messages }
  }

  const drafts: GrowthPhoneDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  for (const person of result.people) {
    const raw = mapPdlPersonToContactDiscoveryRaw(person, {
      company_name: ctx.company_name,
      domain: ctx.primary_domain,
      sandbox: result.sandbox,
    })
    if (!raw?.phone) continue
    if (!personNameMatchesDiscoveryContact({
      person_normalized_name: ctx.normalized_name,
      contact_full_name: raw.full_name,
    })) {
      continue
    }

    const draft = draftFromPhone({
      phone: raw.phone,
      source: "pdl",
      provider_name: "people_data_labs",
      discovery_source: "pdl_person_search",
      evidence_type: "provider_response",
      evidence_text: raw.source_evidence[0]?.evidence ?? "PDL person record phone_numbers/mobile_phone",
      extraction_method: "pdl_person_search",
      confidence: baseConfidenceForPhoneSource("pdl"),
      phone_type: "mobile",
    })
    if (!draft || seen.has(draft.normalized_phone)) continue
    seen.add(draft.normalized_phone)
    drafts.push(draft)
  }

  messages.push(`PDL: ${drafts.length} person-matched phone(s).`)
  return { drafts, messages }
}
