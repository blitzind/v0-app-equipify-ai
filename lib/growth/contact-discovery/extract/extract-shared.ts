/** Shared extraction utilities for website contact discovery. Client-safe. */

import type {
  GrowthCompanyContactEvidence,
  GrowthCompanyContactSourceType,
} from "@/lib/growth/contact-discovery/company-contact-types"

export type ExtractedWebsiteContact = {
  full_name: string
  first_name: string | null
  last_name: string | null
  title: string | null
  department: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  source_type: GrowthCompanyContactSourceType
  source_evidence: GrowthCompanyContactEvidence[]
  leadership_indicator: boolean
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

export function isPlausiblePersonName(value: string): boolean {
  const name = value.trim()
  if (name.length < 4 || name.length > 80) return false
  if (/\d/.test(name)) return false
  if (/@|https?:\/\//i.test(name)) return false
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  return words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word))
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
  return [...html.matchAll(/<(?:article|li|div)[^>]*class="[^"]*(?:team|member|staff|person|leadership|employee)[^"]*"[^>]*>([\s\S]{0,2000}?)<\/(?:article|li|div)>/gi)]
    .map((match) => match[1] ?? "")
    .filter(Boolean)
}

export function readHeadingAndSubheading(block: string): { name: string | null; title: string | null } {
  const nameMatch =
    block.match(/<h[2-6][^>]*>([^<]{3,80})<\/h[2-6]>/i) ??
    block.match(/class="[^"]*name[^"]*"[^>]*>([^<]{3,80})</i)
  const titleMatch =
    block.match(/<p[^>]*class="[^"]*(?:title|role|position)[^"]*"[^>]*>([^<]{3,120})<\/p>/i) ??
    block.match(/<(?:span|p)[^>]*>([^<]{4,120})<\/(?:span|p)>/i)
  const name = nameMatch?.[1] ? stripHtmlTags(nameMatch[1]) : null
  const title = titleMatch?.[1] ? stripHtmlTags(titleMatch[1]) : null
  return { name, title }
}

export function leadershipIndicatorFromTitle(title: string | null): boolean {
  if (!title) return false
  return /\b(ceo|owner|president|founder|director|vp|vice president|chief|manager)\b/i.test(title)
}
