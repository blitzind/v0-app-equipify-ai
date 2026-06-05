/** Shared extraction utilities for website contact discovery. Client-safe. */

import type {
  GrowthCompanyContactEvidence,
  GrowthCompanyContactSourceType,
} from "@/lib/growth/contact-discovery/company-contact-types"
import type {
  WebsiteEmailClassification,
  WebsiteEvidenceQualityLabel,
  WebsitePageType,
  WebsitePhoneClassification,
} from "@/lib/growth/contact-discovery/website-extraction-acquisition-types"

export type ExtractedWebsiteContact = {
  full_name: string
  first_name: string | null
  last_name: string | null
  title: string | null
  department: string | null
  department_label: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  linkedin_company_url: string | null
  source_type: GrowthCompanyContactSourceType
  source_evidence: GrowthCompanyContactEvidence[]
  leadership_indicator: boolean
  source_page_type: WebsitePageType | null
  source_page_url: string | null
  email_classification: WebsiteEmailClassification | null
  phone_classification: WebsitePhoneClassification | null
  email_classification_confidence: number | null
  phone_classification_confidence: number | null
  evidence_quality_score: number | null
  evidence_quality_label: WebsiteEvidenceQualityLabel | null
  evidence_quality_reasons: string[]
  extraction_risks: string[]
  branch_name: string | null
  branch_city: string | null
  branch_state: string | null
  branch_phone: string | null
  location_confidence: number | null
  linkedin_reference_label: string | null
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g
const LINKEDIN_PATTERN = /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/in\/[\w%-]+/gi

export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function splitName(fullName: string): { first_name: string | null; last_name: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: null, last_name: null }
  if (parts.length === 1) return { first_name: parts[0] ?? null, last_name: null }
  return { first_name: parts[0] ?? null, last_name: parts.slice(1).join(" ") || null }
}

const JOB_TITLE_HINT_RE =
  /\b(ceo|owner|president|founder|director|manager|vice president|vp|chief|technician|engineer|coordinator|specialist|supervisor|lead|head of|partner|principal|administrator|consultant)\b/i

export function looksLikeJobTitle(value: string): boolean {
  const text = value.trim()
  if (!text || text.length > 120) return false
  const words = text.split(/\s+/).filter(Boolean)

  // "Jane Owner" — Owner is a surname, not a title label.
  if (
    words.length === 2 &&
    /^[A-Z][A-Za-z.'-]*$/.test(words[0] ?? "") &&
    words[1]?.toLowerCase() === "owner" &&
    !JOB_TITLE_HINT_RE.test(words[0] ?? "")
  ) {
    return false
  }

  if (words.length === 2 && JOB_TITLE_HINT_RE.test(words[0] ?? "") && !JOB_TITLE_HINT_RE.test(words[1] ?? "")) {
    return true
  }

  if (JOB_TITLE_HINT_RE.test(text)) return true
  if (/\b(of|and|&|for|at)\b/i.test(text) && words.length <= 6) return true
  return false
}

function escapeRegexToken(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function nameTokenLooksValid(token: string): boolean {
  return token.length >= 2 && /^[A-Za-z][A-Za-z.'-]*$/.test(token)
}

export function isPlausiblePersonName(value: string): boolean {
  const name = value.trim()
  if (name.length < 4 || name.length > 80) return false
  if (/\d/.test(name)) return false
  if (/@|https?:\/\//i.test(name)) return false
  if (SECTION_HEADING_RE.test(name)) return false
  if (looksLikeJobTitle(name)) return false
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  return words.every((word) => nameTokenLooksValid(word))
}

/** Single-token names allowed only with visible team-card evidence (not email inference alone). */
export function isEvidenceBackedSingleTokenTeamName(name: string, block: string): boolean {
  const token = name.trim()
  if (token.length < 3 || token.length > 40) return false
  if (!/^[A-Za-z][A-Za-z.'-]*$/.test(token)) return false
  if (looksLikeJobTitle(token)) return false

  const plain = stripHtmlTags(block)
  if (!new RegExp(`\\b${escapeRegexToken(token)}\\b`, "i").test(plain)) return false

  const mailtoLocal =
    block.match(/mailto:([^"'>\s]+)/i)?.[1]?.split("@")[0]?.trim().toLowerCase() ?? ""
  const mailtoCorroborates = mailtoLocal.length >= 3 && mailtoLocal === token.toLowerCase()
  const hasLinkedIn = /linkedin\.com\/in\//i.test(block)
  const hasTitleCue = looksLikeJobTitle(plain)

  return mailtoCorroborates || hasLinkedIn || hasTitleCue
}

export function isPlausibleTeamPagePersonName(name: string, block: string): boolean {
  if (isPlausiblePersonName(name)) return true
  return isEvidenceBackedSingleTokenTeamName(name, block)
}

export function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_PATTERN) ?? []).map((item) => item.toLowerCase()))]
}

export function extractPhones(text: string): string[] {
  return [...new Set((text.match(PHONE_PATTERN) ?? []).map((item) => item.trim()))]
}

export function extractLinkedInUrls(text: string): string[] {
  return [...new Set((text.match(LINKEDIN_PATTERN) ?? []).map((item) => item.split("?")[0] ?? item))]
}

export function evidenceFromPage(input: {
  claim: string
  excerpt: string
  source: string
  page_url: string
}): GrowthCompanyContactEvidence {
  return {
    claim: input.claim,
    evidence: input.excerpt.slice(0, 240),
    source: input.source,
    page_url: input.page_url,
  }
}

export function dedupeExtractedContacts(contacts: ExtractedWebsiteContact[]): ExtractedWebsiteContact[] {
  const seen = new Set<string>()
  const result: ExtractedWebsiteContact[] = []
  for (const contact of contacts) {
    const key = [
      contact.full_name.toLowerCase(),
      (contact.title ?? "").toLowerCase(),
      (contact.email ?? "").toLowerCase(),
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    result.push(contact)
  }
  return result
}

export function extractCardBlocks(html: string): string[] {
  const cardClassPattern =
    /(?:team|member|staff|person|leadership|employee|profile|bio|people|elementor-team|staff-member|team-member|person-card|member-card)/i
  const blocks = [
    ...html.matchAll(
      /<(?:article|li|div|section)[^>]*class="[^"]*(?:team|member|staff|person|leadership|employee|profile|bio|people|elementor-team|staff-member|team-member|person-card|member-card)[^"]*"[^>]*>([\s\S]{0,3000}?)<\/(?:article|li|div|section)>/gi,
    ),
    ...html.matchAll(/<div[^>]*class="[^"]*elementor-team-member[^"]*"[^>]*>([\s\S]{0,2000})/gi),
  ]
    .map((match) => match[1] ?? "")
    .filter(Boolean)

  const seen = new Set<string>()
  const unique: string[] = []
  for (const block of blocks) {
    if (
      !cardClassPattern.test(block) &&
      !/<h[1-6][^>]*>/i.test(block) &&
      !/elementor-heading-title/i.test(block)
    ) {
      continue
    }
    const key = block.slice(0, 180)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(block)
  }
  return unique
}

function readNameCandidates(block: string): string[] {
  const candidates: string[] = []
  const patterns = [
    /<h[1-6][^>]*>([^<]{2,80})<\/h[1-6]>/gi,
    /class="[^"]*(?:member-name|team-name|person-name|staff-name|employee-name)[^"]*"[^>]*>([^<]{2,80})</gi,
    /class="[^"]*\bname\b[^"]*"[^>]*>([^<]{2,80})</gi,
    /<strong[^>]*>([^<]{2,60})<\/strong>/gi,
    /<div[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>([^<]{2,80})<\/div>/gi,
  ]
  for (const pattern of patterns) {
    for (const match of block.matchAll(pattern)) {
      const value = stripHtmlTags(match[1] ?? "")
      if (value) candidates.push(value)
    }
  }
  return candidates
}

function readTitleCandidates(block: string): string[] {
  const candidates: string[] = []
  const patterns = [
    /<p[^>]*class="[^"]*(?:title|role|position|job)[^"]*"[^>]*>([^<]{3,120})<\/p>/gi,
    /<(?:span|div|p)[^>]*class="[^"]*(?:title|role|position|job)[^"]*"[^>]*>([^<]{3,120})<\/(?:span|div|p)>/gi,
    /<div[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>([^<]{3,120})<\/div>/gi,
  ]
  for (const pattern of patterns) {
    for (const match of block.matchAll(pattern)) {
      const value = stripHtmlTags(match[1] ?? "")
      if (value) candidates.push(value)
    }
  }
  return candidates
}

function pickBestNameTitlePair(
  names: string[],
  titles: string[],
): { name: string | null; title: string | null } {
  let name: string | null = null
  let title: string | null = null

  for (const candidate of names) {
    if (looksLikeJobTitle(candidate)) {
      if (!title) title = candidate
      continue
    }
    if (!name) name = candidate
  }

  for (const candidate of titles) {
    if (looksLikeJobTitle(candidate)) {
      if (!title) title = candidate
      continue
    }
    if (!name && !looksLikeJobTitle(candidate)) name = candidate
  }

  if (name && looksLikeJobTitle(name) && title && !looksLikeJobTitle(title)) {
    return { name: title, title: name }
  }
  if (name && looksLikeJobTitle(name) && !title) {
    return { name: null, title: name }
  }
  return { name, title }
}

export function readHeadingAndSubheading(block: string): { name: string | null; title: string | null } {
  const names = readNameCandidates(block)
  const titles = readTitleCandidates(block)
  const picked = pickBestNameTitlePair(names, titles)

  const personTitleCandidate = titles.find(
    (candidate) => isPlausiblePersonName(candidate) && !looksLikeJobTitle(candidate),
  )
  if (
    personTitleCandidate &&
    (!picked.name || (looksLikeJobTitle(picked.name) && !isPlausiblePersonName(picked.name)))
  ) {
    const resolvedTitle =
      picked.name && looksLikeJobTitle(picked.name)
        ? picked.name
        : picked.title ?? titles.find((candidate) => looksLikeJobTitle(candidate)) ?? null
    return { name: personTitleCandidate, title: resolvedTitle }
  }

  if (picked.name && !looksLikeJobTitle(picked.name)) return picked

  const fallbackParagraph = block.match(/<p[^>]*>([^<]{4,120})<\/p>/i)?.[1]
  const fallback = fallbackParagraph ? stripHtmlTags(fallbackParagraph) : null
  if (fallback && !looksLikeJobTitle(fallback) && isPlausiblePersonName(fallback)) {
    return {
      name: fallback,
      title:
        picked.name && looksLikeJobTitle(picked.name)
          ? picked.name
          : picked.title ?? titles.find((candidate) => looksLikeJobTitle(candidate)) ?? null,
    }
  }
  return picked
}

export function leadershipIndicatorFromTitle(title: string | null): boolean {
  if (!title) return false
  return /\b(ceo|owner|president|founder|director|vp|vice president|chief|manager|operations)\b/i.test(title)
}

export function inferDepartmentLabelFromTitle(title: string | null, pageText?: string): string | null {
  const combined = `${title ?? ""} ${pageText ?? ""}`.toLowerCase()
  if (/\bdispatch\b/.test(combined)) return "Dispatch"
  if (/\bservice department\b|\bservice manager\b/.test(combined)) return "Service"
  if (/\bsales\b/.test(combined)) return "Sales"
  if (/\bsupport\b/.test(combined)) return "Support"
  if (/\boperations\b/.test(combined)) return "Operations"
  if (/\boffice\b/.test(combined)) return "Office"
  return null
}

const SECTION_HEADING_RE =
  /(?:meet the team|our team|leadership|our staff|management team|service department|dispatch|contact us|locations|our locations)/i

export function extractSectionBlocks(html: string): string[] {
  const blocks = extractCardBlocks(html)
  if (blocks.length > 0) return blocks
  const sections: string[] = []
  for (const match of html.matchAll(/<(?:section|div)[^>]*>([\s\S]{0,5000}?)<\/(?:section|div)>/gi)) {
    const block = match[1] ?? ""
    if (SECTION_HEADING_RE.test(block)) sections.push(block)
  }
  if (sections.length > 0) return sections
  if (SECTION_HEADING_RE.test(html)) return [html]
  return sections
}

export function extractBranchLocationFromPage(plainText: string): {
  branch_name: string | null
  branch_city: string | null
  branch_state: string | null
  location_confidence: number
} {
  const branchMatch = plainText.match(
    /(?:branch|location|office)\s*(?:in|:|-)?\s*([A-Za-z][A-Za-z\s.'-]{2,40})(?:,\s*([A-Z]{2}))?/i,
  )
  const cityStateMatch = plainText.match(/\b([A-Za-z][A-Za-z\s.'-]{2,30}),\s*([A-Z]{2})\b/)
  if (branchMatch) {
    return {
      branch_name: branchMatch[0]?.trim() ?? null,
      branch_city: branchMatch[1]?.trim() ?? cityStateMatch?.[1]?.trim() ?? null,
      branch_state: branchMatch[2]?.trim() ?? cityStateMatch?.[2]?.trim() ?? null,
      location_confidence: 0.72,
    }
  }
  if (cityStateMatch) {
    return {
      branch_name: null,
      branch_city: cityStateMatch[1]?.trim() ?? null,
      branch_state: cityStateMatch[2]?.trim() ?? null,
      location_confidence: 0.55,
    }
  }
  return { branch_name: null, branch_city: null, branch_state: null, location_confidence: 0 }
}

export function baseExtractedContact(
  partial: Omit<
    ExtractedWebsiteContact,
    | "source_page_type"
    | "source_page_url"
    | "email_classification"
    | "phone_classification"
    | "email_classification_confidence"
    | "phone_classification_confidence"
    | "evidence_quality_score"
    | "evidence_quality_label"
    | "evidence_quality_reasons"
    | "extraction_risks"
    | "branch_name"
    | "branch_city"
    | "branch_state"
    | "branch_phone"
    | "location_confidence"
    | "linkedin_company_url"
    | "linkedin_reference_label"
    | "department_label"
  > & {
    source_page_type?: WebsitePageType | null
    source_page_url?: string | null
    department_label?: string | null
  },
): ExtractedWebsiteContact {
  return {
    department_label: partial.department_label ?? partial.department,
    source_page_type: partial.source_page_type ?? null,
    source_page_url: partial.source_page_url ?? partial.source_evidence[0]?.page_url ?? null,
    email_classification: null,
    phone_classification: null,
    email_classification_confidence: null,
    phone_classification_confidence: null,
    evidence_quality_score: null,
    evidence_quality_label: null,
    evidence_quality_reasons: [],
    extraction_risks: [],
    branch_name: null,
    branch_city: null,
    branch_state: null,
    branch_phone: null,
    location_confidence: null,
    linkedin_company_url: null,
    linkedin_reference_label: null,
    ...partial,
  }
}
