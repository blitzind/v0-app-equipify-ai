import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { discoverWebsiteContacts } from "@/lib/growth/contact-discovery/website-contact-discovery"
import { personNameMatchesDiscoveryContact } from "@/lib/growth/email-discovery/email-discovery-name-match"
import {
  baseConfidenceForSocialProfileSource,
  confidenceTierForSocialProfileDiscovery,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-confidence"
import { normalizeSocialProfileUrl } from "@/lib/growth/social-profile-discovery/social-profile-normalize"
import {
  GROWTH_SOCIAL_PROFILE_COMPANY_TYPES,
  GROWTH_SOCIAL_PROFILE_PERSON_TYPES,
  type GrowthSocialProfileDiscoveryDraftCandidate,
  type GrowthSocialProfileDiscoveryProfileType,
  type GrowthSocialProfileDiscoveryScope,
  type GrowthSocialProfileDiscoverySource,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export type SocialProfileDiscoveryContext = {
  company_id: string
  person_id: string | null
  discovery_scope: GrowthSocialProfileDiscoveryScope
  company_name: string
  normalized_name: string
  full_name: string
  primary_domain: string | null
  website_url: string | null
}

function stagingNameMatchesPerson(
  ctx: SocialProfileDiscoveryContext,
  contactFullName: string | null | undefined,
): boolean {
  const name = typeof contactFullName === "string" ? contactFullName.trim() : ""
  if (!name) return true
  if (!ctx.normalized_name) return true
  return personNameMatchesDiscoveryContact({
    person_normalized_name: ctx.normalized_name,
    contact_full_name: name,
  })
}

function draftFromUrl(input: {
  profile_type: GrowthSocialProfileDiscoveryProfileType
  profile_url: string
  source: GrowthSocialProfileDiscoverySource
  provider_name: string
  discovery_source: string
  evidence_type: GrowthSocialProfileDiscoveryDraftCandidate["evidence"][number]["evidence_type"]
  evidence_text: string
  source_url?: string | null
  source_record_id?: string | null
  extraction_method?: string | null
  confidence?: number
  staging_trusted?: boolean
}): GrowthSocialProfileDiscoveryDraftCandidate | null {
  const normalized = normalizeSocialProfileUrl(input.profile_type, input.profile_url)
  if (!normalized) return null

  const base = input.confidence ?? baseConfidenceForSocialProfileSource(input.source)
  return {
    profile_type: input.profile_type,
    profile_url: normalized.profile_url,
    normalized_profile_key: normalized.normalized_profile_key,
    source: input.source,
    confidence: base,
    confidence_tier: confidenceTierForSocialProfileDiscovery({
      source: input.source,
      verification_status: "unverified",
      base_confidence: base,
    }),
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

function scopeAllowsType(
  ctx: SocialProfileDiscoveryContext,
  profile_type: GrowthSocialProfileDiscoveryProfileType,
): boolean {
  if (ctx.discovery_scope === "person") {
    return (GROWTH_SOCIAL_PROFILE_PERSON_TYPES as readonly string[]).includes(profile_type)
  }
  return (GROWTH_SOCIAL_PROFILE_COMPANY_TYPES as readonly string[]).includes(profile_type)
}

export async function collectWebsiteSocialProfileDiscoveryCandidates(
  ctx: SocialProfileDiscoveryContext,
): Promise<{ drafts: GrowthSocialProfileDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const website = ctx.website_url?.trim() || (ctx.primary_domain ? `https://${ctx.primary_domain}` : null)
  if (!website) {
    messages.push("Website source skipped: no website URL or primary domain.")
    return { drafts: [], messages }
  }

  const discovery = await discoverWebsiteContacts(website)
  const drafts: GrowthSocialProfileDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  for (const contact of discovery.contacts) {
    if (ctx.discovery_scope === "person" && !stagingNameMatchesPerson(ctx, contact.full_name)) continue

    const urls: Array<{ profile_type: GrowthSocialProfileDiscoveryProfileType; url: string }> = []
    if (contact.linkedin_url) urls.push({ profile_type: "linkedin_person", url: contact.linkedin_url })
    if (contact.linkedin_company_url) {
      urls.push({ profile_type: "linkedin_company", url: contact.linkedin_company_url })
    }

    for (const { profile_type, url } of urls) {
      if (!scopeAllowsType(ctx, profile_type)) continue
      const draft = draftFromUrl({
        profile_type,
        profile_url: url,
        source: "website",
        provider_name: "website_public_extract",
        discovery_source: contact.source_page_type ?? "website",
        evidence_type: "social_link",
        evidence_text: `Social profile link on ${contact.source_page_url ?? website} (${contact.source_page_type ?? "page"}).`,
        source_url: contact.source_page_url ?? website,
        extraction_method: "html_extract",
        confidence: Math.min(0.92, (contact.evidence_quality_score ?? 70) / 100),
      })
      if (!draft || seen.has(draft.normalized_profile_key)) continue
      seen.add(draft.normalized_profile_key)
      drafts.push(draft)
    }
  }

  if (ctx.discovery_scope === "company") {
    for (const companyUrl of discovery.linkedin_company_urls ?? []) {
      if (!companyUrl?.trim()) continue
      const draft = draftFromUrl({
        profile_type: "linkedin_company",
        profile_url: companyUrl,
        source: "website",
        provider_name: "website_public_extract",
        discovery_source: "company_linkedin_reference",
        evidence_type: "social_link",
        evidence_text: `Company LinkedIn reference on crawled website (${discovery.pages_crawled.length} page(s)).`,
        source_url: website,
        extraction_method: "html_extract",
      })
      if (!draft || seen.has(draft.normalized_profile_key)) continue
      seen.add(draft.normalized_profile_key)
      drafts.push(draft)
    }
  }

  messages.push(`Website: ${drafts.length} profile URL(s) from ${discovery.pages_crawled.length} page(s).`)
  return { drafts, messages }
}

export async function collectStagingSocialProfileDiscoveryCandidates(
  admin: SupabaseClient,
  ctx: SocialProfileDiscoveryContext,
): Promise<{ drafts: GrowthSocialProfileDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const drafts: GrowthSocialProfileDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  if (ctx.discovery_scope === "person" && ctx.person_id) {
    const { data: companyContacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, linkedin_url, full_name, contact_status")
      .eq("canonical_person_id", ctx.person_id)
      .not("linkedin_url", "is", null)

    for (const row of companyContacts ?? []) {
      const url = typeof row.linkedin_url === "string" ? row.linkedin_url : ""
      if (!url.trim()) continue
      if (!stagingNameMatchesPerson(ctx, row.full_name)) continue
      const trusted = row.contact_status === "verified"
      const draft = draftFromUrl({
        profile_type: "linkedin_person",
        profile_url: url,
        source: "staging_contact",
        provider_name: "company_contacts",
        discovery_source: "company_contacts",
        evidence_type: "staging_row",
        evidence_text: `company_contacts ${row.id} linked to canonical person.`,
        source_record_id: String(row.id),
        extraction_method: "staging_ingest",
        staging_trusted: trusted,
        confidence: trusted ? 0.9 : baseConfidenceForSocialProfileSource("staging_contact"),
      })
      if (!draft || seen.has(draft.normalized_profile_key)) continue
      seen.add(draft.normalized_profile_key)
      drafts.push(draft)
    }

    const { data: candidates } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("id, linkedin_url, full_name, verification_state")
      .eq("canonical_person_id", ctx.person_id)
      .not("linkedin_url", "is", null)

    for (const row of candidates ?? []) {
      const url = typeof row.linkedin_url === "string" ? row.linkedin_url : ""
      if (!url.trim()) continue
      if (!stagingNameMatchesPerson(ctx, row.full_name)) continue
      const trusted =
        row.verification_state === "verified" || row.verification_state === "operator_verified"
      const draft = draftFromUrl({
        profile_type: "linkedin_person",
        profile_url: url,
        source: "staging_contact",
        provider_name: "contact_candidates",
        discovery_source: "contact_candidates",
        evidence_type: "staging_row",
        evidence_text: `contact_candidates ${row.id} linked to canonical person.`,
        source_record_id: String(row.id),
        staging_trusted: trusted,
      })
      if (!draft || seen.has(draft.normalized_profile_key)) continue
      seen.add(draft.normalized_profile_key)
      drafts.push(draft)
    }

    const { data: dms } = await admin
      .schema("growth")
      .from("lead_decision_makers")
      .select("id, linkedin_url, full_name")
      .eq("canonical_person_id", ctx.person_id)
      .not("linkedin_url", "is", null)

    for (const row of dms ?? []) {
      const url = typeof row.linkedin_url === "string" ? row.linkedin_url : ""
      if (!url.trim()) continue
      if (!stagingNameMatchesPerson(ctx, row.full_name)) continue
      const draft = draftFromUrl({
        profile_type: "linkedin_person",
        profile_url: url,
        source: "staging_contact",
        provider_name: "lead_decision_makers",
        discovery_source: "lead_decision_makers",
        evidence_type: "staging_row",
        evidence_text: `lead_decision_makers ${row.id} linked to canonical person.`,
        source_record_id: String(row.id),
      })
      if (!draft || seen.has(draft.normalized_profile_key)) continue
      seen.add(draft.normalized_profile_key)
      drafts.push(draft)
    }
  }

  if (ctx.discovery_scope === "company") {
    const { data: contacts } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, linkedin_url, metadata")
      .eq("canonical_company_id", ctx.company_id)

    for (const row of contacts ?? []) {
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {}
      const companyUrl =
        (typeof meta.linkedin_company_url === "string" && meta.linkedin_company_url.trim()) ||
        (typeof meta.linkedin_company === "string" && meta.linkedin_company.trim()) ||
        null
      if (companyUrl) {
        const draft = draftFromUrl({
          profile_type: "linkedin_company",
          profile_url: companyUrl,
          source: "staging_contact",
          provider_name: "company_contacts",
          discovery_source: "company_contacts",
          evidence_type: "staging_row",
          evidence_text: `company_contacts ${row.id} company LinkedIn reference.`,
          source_record_id: String(row.id),
        })
        if (draft && !seen.has(draft.normalized_profile_key)) {
          seen.add(draft.normalized_profile_key)
          drafts.push(draft)
        }
      }
    }
  }

  messages.push(`Staging: ${drafts.length} profile URL(s) from linked ingestion rows.`)
  return { drafts, messages }
}

export async function collectCanonicalChannelSocialProfileDiscoveryCandidates(
  admin: SupabaseClient,
  ctx: SocialProfileDiscoveryContext,
): Promise<{ drafts: GrowthSocialProfileDiscoveryDraftCandidate[]; messages: string[] }> {
  const messages: string[] = []
  const drafts: GrowthSocialProfileDiscoveryDraftCandidate[] = []
  const seen = new Set<string>()

  if (ctx.discovery_scope === "person" && ctx.person_id) {
    const { data: profiles } = await admin
      .schema("growth")
      .from("person_profiles")
      .select("id, profile_type, profile_url, normalized_profile_key, confidence")
      .eq("person_id", ctx.person_id)

    for (const row of profiles ?? []) {
      const profile_url = typeof row.profile_url === "string" ? row.profile_url : ""
      if (!profile_url.trim()) continue
      const rawType = typeof row.profile_type === "string" ? row.profile_type : "linkedin"
      const profile_type: GrowthSocialProfileDiscoveryProfileType =
        rawType === "linkedin" || rawType === "linkedin_person"
          ? "linkedin_person"
          : rawType === "twitter"
            ? "twitter"
            : rawType === "facebook"
              ? "facebook"
              : rawType === "instagram"
                ? "instagram"
                : "linkedin_person"
      if (!scopeAllowsType(ctx, profile_type)) continue

      const draft = draftFromUrl({
        profile_type,
        profile_url,
        source: "canonical_channel",
        provider_name: "person_profiles",
        discovery_source: "person_profiles",
        evidence_type: "canonical_channel",
        evidence_text: `Existing person_profiles ${row.id} on canonical person.`,
        source_record_id: String(row.id),
        confidence:
          typeof row.confidence === "number" ? row.confidence : baseConfidenceForSocialProfileSource("canonical_channel"),
      })
      if (!draft || seen.has(draft.normalized_profile_key)) continue
      seen.add(draft.normalized_profile_key)
      drafts.push(draft)
    }
  }

  if (ctx.discovery_scope === "company") {
    const { data: profiles, error } = await admin
      .schema("growth")
      .from("company_profiles")
      .select("id, profile_type, profile_url, normalized_profile_key, confidence")
      .eq("company_id", ctx.company_id)

    if (!error) {
      for (const row of profiles ?? []) {
        const profile_url = typeof row.profile_url === "string" ? row.profile_url : ""
        if (!profile_url.trim()) continue
        const profile_type =
          (typeof row.profile_type === "string" ? row.profile_type : "linkedin_company") as GrowthSocialProfileDiscoveryProfileType
        if (!scopeAllowsType(ctx, profile_type)) continue

        const draft = draftFromUrl({
          profile_type,
          profile_url,
          source: "canonical_channel",
          provider_name: "company_profiles",
          discovery_source: "company_profiles",
          evidence_type: "canonical_channel",
          evidence_text: `Existing company_profiles ${row.id} on canonical company.`,
          source_record_id: String(row.id),
        })
        if (!draft || seen.has(draft.normalized_profile_key)) continue
        seen.add(draft.normalized_profile_key)
        drafts.push(draft)
      }
    }
  }

  messages.push(`Canonical channel: ${drafts.length} profile URL(s).`)
  return { drafts, messages }
}
