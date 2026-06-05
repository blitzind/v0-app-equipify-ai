/** Phase 7.PS-HY — Extract professional identity corroboration from public pages. Client-safe. */

import {
  extractLinkedInProfileReferences,
  extractLinkedInCompanyReferences,
} from "@/lib/growth/contact-discovery/website-profile-references"
import {
  isPlausiblePersonName,
  stripHtmlTags,
} from "@/lib/growth/contact-discovery/extract/extract-shared"
import { personNameMatchesDiscoveryContact } from "@/lib/growth/email-discovery/email-discovery-name-match"
import {
  GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
  type TitleRoleEvidenceRecord,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-types"
import {
  GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
  type EvidenceBackedPersonTarget,
  type ProfessionalIdentityCorroborationSignal,
  type ProfessionalIdentityCorroborationSourceType,
} from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function companyCorroborates(snippet: string, company_name: string): boolean {
  const hay = normalizeCompanyName(snippet)
  const needle = normalizeCompanyName(company_name)
  if (!needle) return false
  if (hay.includes(needle)) return true
  const tokens = needle.split(" ").filter((t) => t.length > 3)
  return tokens.length >= 2 && tokens.every((t) => hay.includes(t))
}

function parseTitleNearName(text: string, full_name: string): string | null {
  const escaped = full_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`${escaped}\\s*(?:[—–\\-|,]|,)\\s*([^\\n|,.]{3,80})`, "i"),
    new RegExp(`${escaped}\\s+(?:is|as)\\s+(?:the\\s+)?([^\\n,.]{3,80})`, "i"),
    new RegExp(`([^\\n,.]{3,80})\\s+at\\s+`, "i"),
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const candidate = asString(match?.[1])
    if (!candidate || candidate.length < 3) continue
    if (candidate.toLowerCase().includes(full_name.toLowerCase())) continue
    if (/^(ceo|president|owner|director|manager|engineer|technician|vp|chief)/i.test(candidate)) {
      return candidate
    }
    if (candidate.split(/\s+/).length <= 8) return candidate
  }
  return null
}

export function confidenceContributionForSource(
  source_type: ProfessionalIdentityCorroborationSourceType,
): number {
  switch (source_type) {
    case "company_website_reference":
      return 28
    case "public_linkedin_url_reference":
      return 24
    case "association_page":
      return 20
    case "conference_page":
      return 18
    case "public_search_snippet":
      return 16
    default:
      return 12
  }
}

export function extractPublicSearchResultSnippets(html: string): Array<{
  result_url: string
  result_title: string
  snippet: string
}> {
  const results: Array<{ result_url: string; result_title: string; snippet: string }> = []
  const blocks = html.matchAll(
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
  )
  for (const block of blocks) {
    const result_url = asString(block[1])
    const result_title = stripHtmlTags(block[2] ?? "")
    const snippet = stripHtmlTags(block[3] ?? "")
    if (!snippet) continue
    results.push({ result_url, result_title, snippet })
  }

  if (results.length === 0) {
    const plain = stripHtmlTags(html)
    for (const line of plain.split(/\n+/)) {
      const trimmed = line.trim()
      if (trimmed.length < 24 || trimmed.length > 320) continue
      results.push({ result_url: "", result_title: "", snippet: trimmed })
    }
  }

  return results.slice(0, 12)
}

export function extractCorroborationFromPublicPage(input: {
  html: string
  source_url: string
  source_type: ProfessionalIdentityCorroborationSourceType
  target: EvidenceBackedPersonTarget
}): ProfessionalIdentityCorroborationSignal | null {
  const plain = stripHtmlTags(input.html)
  if (!plain.toLowerCase().includes(input.target.full_name.toLowerCase().split(" ")[0] ?? "")) {
    return null
  }

  const firstToken = input.target.full_name.toLowerCase().split(/\s+/)[0] ?? ""
  const namePresent =
    plain.toLowerCase().includes(input.target.full_name.toLowerCase()) ||
    plain.toLowerCase().includes(input.target.normalized_name) ||
    (firstToken.length > 2 && plain.toLowerCase().includes(firstToken))

  if (!namePresent) return null
  if (!companyCorroborates(plain, input.target.company_name)) return null

  const idx = plain.toLowerCase().indexOf(input.target.full_name.toLowerCase())
  const window =
    idx >= 0
      ? plain.slice(Math.max(0, idx - 180), Math.min(plain.length, idx + 280))
      : plain.slice(0, 400)

  const matched_title =
    parseTitleNearName(window, input.target.full_name) ||
    (input.target.title && window.toLowerCase().includes(input.target.title.toLowerCase())
      ? input.target.title
      : null)

  const linkedinCandidates = extractLinkedInProfileReferences(window)
  const linkedin_url = linkedinCandidates.find((url) => {
    const near = plain.slice(
      Math.max(0, plain.indexOf(url) - 120),
      Math.min(plain.length, plain.indexOf(url) + 120),
    )
    return near.toLowerCase().includes(input.target.full_name.toLowerCase().split(" ")[0] ?? "")
  }) ?? null

  return {
    source_url: input.source_url,
    source_type: linkedin_url ? "public_linkedin_url_reference" : input.source_type,
    matched_name: input.target.full_name,
    matched_company: input.target.company_name,
    matched_title,
    confidence_contribution: confidenceContributionForSource(
      linkedin_url ? "public_linkedin_url_reference" : input.source_type,
    ),
    evidence_excerpt: window.slice(0, 240),
    linkedin_url,
    observed_at: new Date().toISOString(),
    qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
  }
}

export function extractCorroborationFromSearchSnippets(input: {
  snippets: Array<{ result_url: string; result_title: string; snippet: string }>
  target: EvidenceBackedPersonTarget
}): ProfessionalIdentityCorroborationSignal[] {
  const signals: ProfessionalIdentityCorroborationSignal[] = []
  const seen = new Set<string>()

  for (const row of input.snippets) {
    const text = `${row.result_title} ${row.snippet}`.trim()
    if (!text.toLowerCase().includes(input.target.full_name.toLowerCase().split(" ")[0] ?? "")) {
      continue
    }
    if (!companyCorroborates(text, input.target.company_name)) continue

    const nameMatch =
      text.toLowerCase().includes(input.target.full_name.toLowerCase()) ||
      personNameMatchesDiscoveryContact({
        person_normalized_name: input.target.normalized_name,
        contact_full_name: text,
      })
    if (!nameMatch) continue

    const matched_title = parseTitleNearName(text, input.target.full_name)
    const linkedin_url =
      extractLinkedInProfileReferences(text).find((url) =>
        text.toLowerCase().includes(input.target.full_name.toLowerCase().split(" ")[0] ?? ""),
      ) ?? null

    const key = `${row.result_url}:${matched_title ?? ""}:${linkedin_url ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)

    signals.push({
      source_url: row.result_url || "https://html.duckduckgo.com/html/",
      source_type: linkedin_url ? "public_linkedin_url_reference" : "public_search_snippet",
      matched_name: input.target.full_name,
      matched_company: input.target.company_name,
      matched_title,
      confidence_contribution: confidenceContributionForSource(
        linkedin_url ? "public_linkedin_url_reference" : "public_search_snippet",
      ),
      evidence_excerpt: text.slice(0, 240),
      linkedin_url,
      observed_at: new Date().toISOString(),
      qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
    })
  }

  return signals
}

export function extractLinkedInReferencesFromPublicPage(input: {
  html: string
  source_url: string
  target: EvidenceBackedPersonTarget
}): ProfessionalIdentityCorroborationSignal[] {
  const plain = stripHtmlTags(input.html)
  const signals: ProfessionalIdentityCorroborationSignal[] = []
  const profiles = extractLinkedInProfileReferences(input.html)

  for (const linkedin_url of profiles) {
    const idx = plain.indexOf(linkedin_url.split("/in/")[1] ?? linkedin_url)
    const window = plain.slice(Math.max(0, idx - 160), Math.min(plain.length, idx + 200))
    if (!window.toLowerCase().includes(input.target.full_name.toLowerCase().split(" ")[0] ?? "")) {
      continue
    }
    if (!companyCorroborates(plain, input.target.company_name)) continue

    signals.push({
      source_url: input.source_url,
      source_type: "public_linkedin_url_reference",
      matched_name: input.target.full_name,
      matched_company: input.target.company_name,
      matched_title: parseTitleNearName(window, input.target.full_name),
      confidence_contribution: confidenceContributionForSource("public_linkedin_url_reference"),
      evidence_excerpt: window.slice(0, 240),
      linkedin_url,
      observed_at: new Date().toISOString(),
      qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
    })
  }

  const companies = extractLinkedInCompanyReferences(input.html)
  if (companies.length > 0 && companyCorroborates(plain, input.target.company_name)) {
    for (const companyUrl of companies.slice(0, 1)) {
      signals.push({
        source_url: input.source_url,
        source_type: "company_website_reference",
        matched_name: input.target.full_name,
        matched_company: input.target.company_name,
        matched_title: null,
        confidence_contribution: confidenceContributionForSource("company_website_reference"),
        evidence_excerpt: `LinkedIn company reference ${companyUrl}`.slice(0, 240),
        linkedin_url: null,
        observed_at: new Date().toISOString(),
        qa_marker: GROWTH_PROFESSIONAL_IDENTITY_CORROBORATION_QA_MARKER,
      })
    }
  }

  return signals
}

export function isEvidenceBackedTitleMatch(input: {
  title: string | null
  excerpt: string
  full_name: string
}): boolean {
  const title = asString(input.title)
  if (!title) return false
  const hay = `${input.excerpt} ${input.full_name}`.toLowerCase()
  return hay.includes(title.toLowerCase())
}

export function corroborationToTitleEvidence(
  signal: ProfessionalIdentityCorroborationSignal,
  target: EvidenceBackedPersonTarget,
): TitleRoleEvidenceRecord | null {
  const title = asString(signal.matched_title)
  if (!title || !isEvidenceBackedTitleMatch({ title, excerpt: signal.evidence_excerpt, full_name: target.full_name })) {
    return null
  }
  if (!isPlausiblePersonName(target.full_name)) return null

  const source =
    signal.source_type === "company_website_reference"
      ? "team_page"
      : signal.source_type === "association_page"
        ? "about_page"
        : signal.source_type === "conference_page"
          ? "leadership_page"
          : "structured_metadata"

  return {
    title,
    source,
    source_url: signal.source_url,
    evidence_excerpt: signal.evidence_excerpt,
    claim: `corroboration_${signal.source_type}: ${target.full_name} — ${title}`,
    observed_at: signal.observed_at,
    qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
    person_id: target.person_id,
    company_id: target.company_id,
    company_contact_id: target.company_contact_id,
  }
}
