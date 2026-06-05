/** Phase 7.PS-HX — Extract evidence records from public external HTML. Client-safe. */

import {
  evidenceFromPage,
  extractSectionBlocks,
  isPlausiblePersonName,
  readHeadingAndSubheading,
  splitName,
  stripHtmlTags,
} from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
  type ExternalEvidenceRecord,
  type ExternalEvidenceSourceType,
} from "@/lib/growth/external-evidence/external-evidence-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseNameTitleCompany(line: string): {
  person_name: string | null
  title: string | null
  company_name: string | null
} {
  const text = line.trim()
  const speakerMatch = text.match(
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)\s*[,\-|–—]\s*([^,|]+?)(?:\s+at\s+|\s*[,\|]\s*)(.+)$/i,
  )
  if (speakerMatch?.[1]) {
    return {
      person_name: speakerMatch[1].trim(),
      title: speakerMatch[2]?.trim() || null,
      company_name: speakerMatch[3]?.trim() || null,
    }
  }

  const dashMatch = text.match(/^(.+?)\s*[—–-]\s*(.+?)(?:\s+at\s+(.+))?$/i)
  if (dashMatch?.[1] && dashMatch[2]) {
    const left = dashMatch[1].trim()
    const mid = dashMatch[2].trim()
    const company = dashMatch[3]?.trim() || null
    if (isPlausiblePersonName(left)) {
      return { person_name: left, title: mid, company_name: company }
    }
    return { person_name: null, title: null, company_name: left }
  }

  return { person_name: null, title: null, company_name: null }
}

export function extractExternalEvidenceFromHtml(input: {
  html: string
  source_url: string
  source_type: ExternalEvidenceSourceType
}): ExternalEvidenceRecord[] {
  const records: ExternalEvidenceRecord[] = []
  const seen = new Set<string>()
  const observed_at = new Date().toISOString()
  const plain = stripHtmlTags(input.html)

  for (const block of extractSectionBlocks(input.html)) {
    const { name, title } = readHeadingAndSubheading(block)
    if (name && isPlausiblePersonName(name)) {
      const excerpt = stripHtmlTags(block).slice(0, 240)
      const companyGuess =
        plain.match(/(?:at|@)\s+([A-Z][A-Za-z0-9&.,'\-\s]{3,80})/)?.[1]?.trim() ?? ""
      const key = `${name}:${title ?? ""}:${companyGuess}`
      if (!seen.has(key)) {
        seen.add(key)
        records.push({
          company_name: companyGuess || "Unknown",
          person_name: name,
          title: title || null,
          source_url: input.source_url,
          source_type: input.source_type,
          evidence_excerpt: excerpt,
          observed_at,
          qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
        })
      }
    }
  }

  for (const line of plain.split(/\n+/)) {
    const trimmed = line.trim()
    if (trimmed.length < 8 || trimmed.length > 220) continue
    const parsed = parseNameTitleCompany(trimmed)
    if (!parsed.person_name && !parsed.company_name) continue

    const key = `${parsed.person_name ?? ""}:${parsed.title ?? ""}:${parsed.company_name ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)

    records.push({
      company_name: parsed.company_name || "Unknown",
      person_name: parsed.person_name,
      title: parsed.title,
      source_url: input.source_url,
      source_type: input.source_type,
      evidence_excerpt: trimmed.slice(0, 240),
      observed_at,
      qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
    })
  }

  const exhibitorMatches = input.html.matchAll(
    /(?:exhibitor|vendor|partner|member)[^<]{0,40}?>([A-Z][A-Za-z0-9&.,'\-\s]{3,80})</gi,
  )
  for (const match of exhibitorMatches) {
    const company_name = asString(match[1])
    if (!company_name || company_name.length < 4) continue
    const key = `company:${company_name}`
    if (seen.has(key)) continue
    seen.add(key)
    records.push({
      company_name,
      person_name: null,
      title: null,
      source_url: input.source_url,
      source_type: input.source_type,
      evidence_excerpt: (match[0] ?? "").slice(0, 240),
      observed_at,
      qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
    })
  }

  return records
}

export function extractCohortTargetedEvidenceFromHtml(input: {
  html: string
  source_url: string
  source_type: ExternalEvidenceSourceType
  cohort_companies: Array<{ company_name: string }>
}): ExternalEvidenceRecord[] {
  const records: ExternalEvidenceRecord[] = []
  const seen = new Set<string>()
  const observed_at = new Date().toISOString()
  const plain = stripHtmlTags(input.html)

  for (const target of input.cohort_companies) {
    const company_name = target.company_name.trim()
    if (!company_name) continue
    const normalized = company_name.toLowerCase()
    const idx = plain.toLowerCase().indexOf(normalized)
    if (idx < 0) continue

    const window = plain.slice(Math.max(0, idx - 320), Math.min(plain.length, idx + company_name.length + 420))
    let person_name: string | null = null
    let title: string | null = null

    for (const line of window.split(/\n+/)) {
      const parsed = parseNameTitleCompany(line.trim())
      if (parsed.person_name && parsed.company_name?.toLowerCase().includes(normalized)) {
        person_name = parsed.person_name
        title = parsed.title
        break
      }
      if (parsed.person_name && line.toLowerCase().includes(normalized)) {
        person_name = parsed.person_name
        title = parsed.title
        break
      }
    }

    if (!person_name) {
      const nearby = window.match(
        /([A-Z][a-z]+(?:\s+[A-Z][a-z'.-]+)+)\s*[,\-|–—]\s*([^,\n]{3,80})/,
      )
      if (nearby?.[1] && isPlausiblePersonName(nearby[1])) {
        person_name = nearby[1].trim()
        title = nearby[2]?.trim() || null
      }
    }

    const key = `${company_name}:${person_name ?? ""}:${title ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)

    records.push({
      company_name,
      person_name,
      title,
      source_url: input.source_url,
      source_type: input.source_type,
      evidence_excerpt: window.slice(0, 240),
      observed_at,
      qa_marker: GROWTH_EXTERNAL_EVIDENCE_QA_MARKER,
    })
  }

  return records
}

export function toContactSourceEvidence(record: ExternalEvidenceRecord) {
  return [
    evidenceFromPage({
      claim: record.person_name
        ? `external_${record.source_type}: ${record.person_name}${record.title ? ` — ${record.title}` : ""}`
        : `external_${record.source_type}: ${record.company_name}`,
      excerpt: record.evidence_excerpt,
      source: record.source_type,
      page_url: record.source_url,
    }),
  ]
}
