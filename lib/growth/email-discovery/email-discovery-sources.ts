import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { discoverWebsiteContacts } from "@/lib/growth/contact-discovery/website-contact-discovery"
import { searchPdlPeopleByCompany } from "@/lib/growth/providers/pdl/pdl-client"
import { mapPdlPersonToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
import { canonicalNormalizedPersonEmail } from "@/lib/growth/canonical-persons/canonical-person-normalize"
import { generateWorkEmailPatterns } from "@/lib/growth/email-discovery/email-discovery-patterns"
import { personNameMatchesDiscoveryContact } from "@/lib/growth/email-discovery/email-discovery-name-match"
import {
  baseConfidenceForSource,
  confidenceTierForEmailDiscovery,
} from "@/lib/growth/email-discovery/email-discovery-confidence"
import { shadowCompareNativeLegacyConfidenceDrift } from "@/lib/growth/contact-verification/confidence-signals-shadow"
import type { GrowthEmailDiscoveryDraftCandidate } from "@/lib/growth/email-discovery/email-discovery-types"

export type EmailDiscoveryPersonContext = {
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

function draftFromEmail(input: {
  email: string
  source: GrowthEmailDiscoveryDraftCandidate["source"]
  provider_name: string
  discovery_source: string
  evidence_type: GrowthEmailDiscoveryDraftCandidate["evidence"][number]["evidence_type"]
  evidence_text: string
  source_url?: string | null
  confidence?: number
}): GrowthEmailDiscoveryDraftCandidate | null {
  const normalized = canonicalNormalizedPersonEmail(input.email)
  if (!normalized) return null

  const base = input.confidence ?? baseConfidenceForSource(input.source)
  const confidence_tier = confidenceTierForEmailDiscovery({
    source: input.source,
    verification_status: "unverified",
    base_confidence: base,
  })

  shadowCompareNativeLegacyConfidenceDrift({
    integration: "draftFromEmail",
    legacy_score: base,
    email: input.email,
    discoverySource: input.source,
  })

  return {
    email: input.email.trim().toLowerCase(),
    normalized_email: normalized,
    source: input.source,
    confidence: base,
    confidence_tier,
    provider_name: input.provider_name,
    discovery_source: input.discovery_source,
    evidence: [
      {
        evidence_type: input.evidence_type,
        source_url: input.source_url ?? null,
        evidence_text: input.evidence_text,
        confidence: base,
      },
    ],
  }
}

export async function collectWebsiteEmailDiscoveryCandidates(
  ctx: EmailDiscoveryPersonContext,
): Promise<{ drafts: GrowthEmailDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const website = ctx.website_url?.trim() || (ctx.primary_domain ? `https://${ctx.primary_domain}` : null)
  if (!website) {
    messages.push("Website source skipped: no website URL or primary domain.")
    return { drafts: [], messages }
  }

  const discovery = await discoverWebsiteContacts(website)
  const drafts: GrowthEmailDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  for (const contact of discovery.contacts) {
    if (!contact.email?.trim()) continue
    if (!personNameMatchesDiscoveryContact({
      person_normalized_name: ctx.normalized_name,
      contact_full_name: contact.full_name,
    })) {
      continue
    }
    const draft = draftFromEmail({
      email: contact.email,
      source: "website",
      provider_name: "website_public_extract",
      discovery_source: contact.source_page_type ?? "website",
      evidence_type: contact.source_page_type === "schema_org" ? "website_structured" : "website_page",
      evidence_text: contact.source_evidence[0]?.evidence ?? `Email listed on ${contact.source_page_url ?? website}`,
      source_url: contact.source_page_url ?? website,
      confidence: Math.min(0.95, (contact.evidence_quality_score ?? 70) / 100),
    })
    if (!draft || seen.has(draft.normalized_email)) continue
    seen.add(draft.normalized_email)
    drafts.push(draft)
  }

  messages.push(`Website: ${drafts.length} person-matched email(s) from ${discovery.pages_crawled.length} page(s).`)
  return { drafts, messages }
}

export async function collectStagingEmailDiscoveryCandidates(
  admin: SupabaseClient,
  ctx: EmailDiscoveryPersonContext,
): Promise<{ drafts: GrowthEmailDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const drafts: GrowthEmailDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  const { data: companyContacts, error: ccErr } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id, email, full_name, source_type")
    .eq("canonical_person_id", ctx.person_id)
    .not("email", "is", null)
  if (ccErr) messages.push(`company_contacts: ${ccErr.message}`)
  else {
    for (const row of companyContacts ?? []) {
      const email = typeof row.email === "string" ? row.email : ""
      if (!email.trim()) continue
      const draft = draftFromEmail({
        email,
        source: "staging_contact",
        provider_name: "company_contacts",
        discovery_source: (typeof row.source_type === "string" && row.source_type) || "company_contacts",
        evidence_type: "staging_row",
        evidence_text: `company_contacts ${row.id} linked to canonical person.`,
        confidence: baseConfidenceForSource("staging_contact"),
      })
      if (!draft || seen.has(draft.normalized_email)) continue
      seen.add(draft.normalized_email)
      drafts.push(draft)
    }
  }

  const { data: candidates, error: candErr } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, email, full_name, provider_name, metadata")
    .eq("canonical_person_id", ctx.person_id)
    .not("email", "is", null)
  if (candErr) messages.push(`contact_candidates: ${candErr.message}`)
  else {
    for (const row of candidates ?? []) {
      const email = typeof row.email === "string" ? row.email : ""
      if (!email.trim()) continue
      const draft = draftFromEmail({
        email,
        source: "staging_contact",
        provider_name: (typeof row.provider_name === "string" && row.provider_name) || "contact_candidates",
        discovery_source: "contact_candidates",
        evidence_type: "staging_row",
        evidence_text: `contact_candidates ${row.id} linked to canonical person.`,
        confidence: baseConfidenceForSource("staging_contact"),
      })
      if (!draft || seen.has(draft.normalized_email)) continue
      seen.add(draft.normalized_email)
      drafts.push(draft)
    }
  }

  const { data: decisionMakers, error: dmErr } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, email, full_name, source")
    .eq("canonical_person_id", ctx.person_id)
    .not("email", "is", null)
  if (dmErr) messages.push(`lead_decision_makers: ${dmErr.message}`)
  else {
    for (const row of decisionMakers ?? []) {
      const email = typeof row.email === "string" ? row.email : ""
      if (!email.trim()) continue
      const draft = draftFromEmail({
        email,
        source: "staging_contact",
        provider_name: "lead_decision_makers",
        discovery_source: (typeof row.source === "string" && row.source) || "lead_decision_makers",
        evidence_type: "staging_row",
        evidence_text: `lead_decision_makers ${row.id} linked to canonical person.`,
        confidence: baseConfidenceForSource("staging_contact"),
      })
      if (!draft || seen.has(draft.normalized_email)) continue
      seen.add(draft.normalized_email)
      drafts.push(draft)
    }
  }

  messages.push(`Staging: ${drafts.length} email(s) from linked ingestion rows.`)
  return { drafts, messages }
}

export async function collectPdlEmailDiscoveryCandidates(
  ctx: EmailDiscoveryPersonContext,
): Promise<{ drafts: GrowthEmailDiscoveryDraftCandidate[]; messages: string[] }> {
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

  const drafts: GrowthEmailDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  for (const person of result.people) {
    const raw = mapPdlPersonToContactDiscoveryRaw(person, {
      company_name: ctx.company_name,
      domain: ctx.primary_domain,
      sandbox: result.sandbox,
    })
    if (!raw?.email) continue
    if (!personNameMatchesDiscoveryContact({
      person_normalized_name: ctx.normalized_name,
      contact_full_name: raw.full_name,
    })) {
      continue
    }

    const draft = draftFromEmail({
      email: raw.email,
      source: "pdl",
      provider_name: "people_data_labs",
      discovery_source: "pdl_person_search",
      evidence_type: "provider_response",
      evidence_text: raw.source_evidence[0]?.evidence ?? "PDL person record",
      confidence: baseConfidenceForSource("pdl"),
    })
    if (!draft || seen.has(draft.normalized_email)) continue
    seen.add(draft.normalized_email)
    drafts.push(draft)
  }

  messages.push(`PDL: ${drafts.length} person-matched email(s).`)
  return { drafts, messages }
}

export function collectPatternEmailDiscoveryCandidates(
  ctx: EmailDiscoveryPersonContext,
): { drafts: GrowthEmailDiscoveryDraftCandidate[]; messages: string[] } {
  const domain = ctx.primary_domain?.trim().toLowerCase().replace(/^www\./, "") ?? ""
  if (!domain) {
    return { drafts: [], messages: ["Pattern source skipped: no company primary domain."] }
  }

  const patterns = generateWorkEmailPatterns({
    first_name: ctx.first_name,
    last_name: ctx.last_name,
    full_name: ctx.full_name,
    domain,
  })

  const drafts: GrowthEmailDiscoveryDraftCandidate[] = []
  for (const email of patterns) {
    const draft = draftFromEmail({
      email,
      source: "pattern",
      provider_name: "internal_growth",
      discovery_source: "email_pattern",
      evidence_type: "pattern_generation",
      evidence_text: `Generated from name + domain pattern (${domain}). Not valid until verification.`,
      confidence: baseConfidenceForSource("pattern"),
    })
    if (draft) drafts.push(draft)
  }

  return {
    drafts,
    messages: [`Pattern: ${drafts.length} candidate(s) generated (unverified).`],
  }
}
