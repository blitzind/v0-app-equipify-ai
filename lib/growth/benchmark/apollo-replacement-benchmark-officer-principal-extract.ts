/** Phase 7.PS-IP — Extract officer/principal evidence from company-specific public pages. Client-safe. */

import {
  isPlausiblePersonName,
  stripHtmlTags,
} from "@/lib/growth/contact-discovery/extract/extract-shared"
import { extractPublicSearchResultSnippets } from "@/lib/growth/professional-identity-corroboration/professional-identity-corroboration-extract"
import {
  GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER,
  type BenchmarkOfficerPrincipalEvidenceRecord,
  type BenchmarkOfficerPrincipalRecordKind,
  type BenchmarkOfficerPrincipalSourceType,
} from "@/lib/growth/benchmark/apollo-replacement-benchmark-officer-principal-types"

const PRINCIPAL_TITLE_TOKENS =
  /\b(owner|founder|president|ceo|chief executive|managing member|principal|member|manager)\b/i

const OFFICER_TITLE_TOKENS =
  /\b(officer|director|registered agent|operations manager|service manager|biomedical manager|htm director|vice president|vp)\b/i

const TITLE_BEFORE_NAME =
  /(?:^|[\n\r]|>|\s)(owner|founder|president|ceo|chief executive(?:\s+officer)?|managing member|principal|registered agent|officer|manager|member|director|operations manager|service manager|biomedical manager|htm director)\s*[:\-–—]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)/gi

const NAME_BEFORE_TITLE =
  /([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)\s*[,;\-–—]\s*(owner|founder|president|ceo|chief executive(?:\s+officer)?|managing member|principal|registered agent|officer|manager|member|director|operations manager|service manager|biomedical manager|htm director)/gi

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function companyAppearsInText(text: string, company_name: string): boolean {
  const hay = normalizeCompanyName(text)
  const needle = normalizeCompanyName(company_name)
  if (!needle) return false
  if (hay.includes(needle)) return true
  const tokens = needle.split(" ").filter((t) => t.length > 3)
  return tokens.length >= 2 && tokens.every((t) => hay.includes(t))
}

function inferRecordKind(title: string | null): BenchmarkOfficerPrincipalRecordKind {
  const normalized = (title ?? "").trim()
  if (!normalized) return "officer"
  if (PRINCIPAL_TITLE_TOKENS.test(normalized)) return "principal"
  if (OFFICER_TITLE_TOKENS.test(normalized)) return "officer"
  return "officer"
}

function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bCeo\b/g, "CEO")
    .replace(/\bVp\b/g, "VP")
}

function isValidOfficerName(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length < 4) return false
  if (/\d|@|https?:\/\//i.test(trimmed)) return false
  if (isPlausiblePersonName(trimmed)) return true
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  return tokens.length >= 2 && tokens.every((t) => /^[A-Z][a-z'.-]+$/.test(t))
}

export function extractBbbProfileUrlsForCompany(html: string, company_name: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/href="(\/us\/[^"]*\/profile\/[^"]+)"/gi)) {
    const path = match[1]?.trim()
    if (!path || seen.has(path)) continue
    seen.add(path)
    urls.push(`https://www.bbb.org${path}`)
  }
  if (urls.length > 0) return urls.slice(0, 2)
  const plain = stripHtmlTags(html)
  if (!companyAppearsInText(plain, company_name)) return []
  for (const match of html.matchAll(/href="(https:\/\/www\.bbb\.org\/us\/[^"]*profile[^"]*)"/gi)) {
    const url = match[1]?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls.slice(0, 2)
}

function extractFromTextWindow(input: {
  text: string
  source_url: string
  source_type: BenchmarkOfficerPrincipalSourceType
  company_id: string
  company_name: string
  discovered_at: string
  seen: Set<string>
}): BenchmarkOfficerPrincipalEvidenceRecord[] {
  const records: BenchmarkOfficerPrincipalEvidenceRecord[] = []

  const pushRecord = (person_name: string, title: string | null, excerpt: string) => {
    const name = person_name.trim()
    const normalizedTitle = title ? normalizeTitle(title) : null
    if (!isValidOfficerName(name)) return
    if (!companyAppearsInText(excerpt, input.company_name)) return
    if (!excerpt.toLowerCase().includes(name.toLowerCase().split(" ")[0] ?? "")) return

    const key = `${input.company_id}:${name}:${normalizedTitle ?? ""}`
    if (input.seen.has(key)) return
    input.seen.add(key)

    records.push({
      company_id: input.company_id,
      company_name: input.company_name,
      person_name: name,
      title: normalizedTitle,
      record_kind: inferRecordKind(normalizedTitle),
      source_type: input.source_type,
      source_url: input.source_url,
      evidence_excerpt: excerpt.slice(0, 280),
      discovered_at: input.discovered_at,
      qa_marker: GROWTH_APOLLO_REPLACEMENT_BENCHMARK_OFFICER_PRINCIPAL_QA_MARKER,
    })
  }

  for (const line of input.text.split(/\n+/)) {
    const trimmed = line.trim()
    if (trimmed.length < 8 || trimmed.length > 240) continue

    let titleBefore = TITLE_BEFORE_NAME.exec(trimmed)
    TITLE_BEFORE_NAME.lastIndex = 0
    while (titleBefore) {
      const title = normalizeTitle(titleBefore[1] ?? "")
      const name = (titleBefore[2] ?? "").trim()
      if (name && title) pushRecord(name, title, trimmed)
      titleBefore = TITLE_BEFORE_NAME.exec(trimmed)
    }

    let nameBefore = NAME_BEFORE_TITLE.exec(trimmed)
    NAME_BEFORE_TITLE.lastIndex = 0
    while (nameBefore) {
      const name = (nameBefore[1] ?? "").trim()
      const title = normalizeTitle(nameBefore[2] ?? "")
      if (name && title) pushRecord(name, title, trimmed)
      nameBefore = NAME_BEFORE_TITLE.exec(trimmed)
    }
  }

  for (const match of input.text.matchAll(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)\s+(?:is|as)\s+(?:the\s+)?(owner|founder|president|ceo|managing member|principal|officer|manager|director)/gi,
  )) {
    const name = (match[1] ?? "").trim()
    const title = normalizeTitle(match[2] ?? "")
    if (name && title) pushRecord(name, title, match[0])
  }

  return records
}

export function extractOfficerPrincipalEvidenceFromHtml(input: {
  html: string
  source_url: string
  source_type: BenchmarkOfficerPrincipalSourceType
  company_id: string
  company_name: string
}): BenchmarkOfficerPrincipalEvidenceRecord[] {
  const plain = stripHtmlTags(input.html)
  const discovered_at = new Date().toISOString()
  const seen = new Set<string>()
  const records: BenchmarkOfficerPrincipalEvidenceRecord[] = []

  const normalized = normalizeCompanyName(input.company_name)
  const idx = plain.toLowerCase().indexOf(normalized)
  const windows: string[] = []
  if (idx >= 0) {
    windows.push(
      plain.slice(Math.max(0, idx - 640), Math.min(plain.length, idx + input.company_name.length + 840)),
    )
  }
  windows.push(plain)

  for (const text of windows) {
    records.push(
      ...extractFromTextWindow({
        text,
        source_url: input.source_url,
        source_type: input.source_type,
        company_id: input.company_id,
        company_name: input.company_name,
        discovered_at,
        seen,
      }),
    )
  }

  for (const snippet of extractPublicSearchResultSnippets(input.html)) {
    const text = `${snippet.result_title} ${snippet.snippet}`.trim()
    if (!companyAppearsInText(text, input.company_name)) continue
    records.push(
      ...extractFromTextWindow({
        text,
        source_url: snippet.result_url || input.source_url,
        source_type: input.source_type,
        company_id: input.company_id,
        company_name: input.company_name,
        discovered_at,
        seen,
      }),
    )
  }

  return records
}
