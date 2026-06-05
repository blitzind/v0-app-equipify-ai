/** Phase 7.PS-HW — Evidence-backed title extraction. Client-safe. */

import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import { assertValueSupportedByEvidence } from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import { buildIdentityEvidenceCorpus } from "@/lib/growth/human-identity-evidence/human-identity-evidence-naming-extract"
import {
  GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
  type TitleRoleEvidenceRecord,
  type TitleRoleEvidenceSource,
} from "@/lib/growth/human-identity-evidence/title-role-evidence-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

const GENERIC_TITLES = new Set([
  "team member",
  "staff",
  "employee",
  "contact",
  "member",
  "n/a",
  "unknown",
])

function mapEvidenceSource(raw: string, pageType: string | null): TitleRoleEvidenceSource {
  const source = raw.toLowerCase()
  const page = (pageType ?? "").toLowerCase()
  if (source.includes("schema")) return "schema_org"
  if (source.includes("leadership") || page === "leadership") return "leadership_page"
  if (source.includes("author") || page === "blog_author") return "author_byline"
  if (source.includes("staff") || page === "staff") return "staff_directory"
  if (source.includes("contact_card") || source.includes("contact_card")) return "contact_card"
  if (source.includes("about")) return "about_page"
  if (source.includes("team") || page === "team" || page === "staff") return "team_page"
  if (source.includes("structured") || source.includes("metadata")) return "structured_metadata"
  return "team_page"
}

function parseNameTitleFromClaim(claim: string, evidence: string): { name: string; title: string } | null {
  const text = `${claim} ${evidence}`.trim()
  const patterns = [
    /^(?:schema\.org person|leadership|team_page|about_page|author_byline|staff_directory|contact_card):\s*(.+?)\s*[—–-]\s*(.+)$/i,
    /^(.+?)\s*[—–-]\s*(.+)$/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1] || !match[2]) continue
    const name = match[1].trim()
    const title = match[2].trim()
    if (!isPlausiblePersonName(name) || !title || title.length < 3) continue
    if (GENERIC_TITLES.has(title.toLowerCase())) continue
    return { name, title }
  }
  return null
}

function isEvidenceBackedTitle(input: {
  title: string
  full_name: string
  source_evidence: Array<{ claim?: string; evidence?: string; page_url?: string | null }>
  metadata: Record<string, unknown>
}): boolean {
  const corpus = buildIdentityEvidenceCorpus({
    source_evidence: input.source_evidence,
    metadata: input.metadata,
  })
  const check = assertValueSupportedByEvidence({
    value: input.title,
    evidence_corpus: corpus,
    field_label: "Title",
  })
  return check.ok
}

export function collectTitleEvidenceForContact(input: {
  full_name: string
  title?: string | null
  source_evidence: Array<{
    claim?: string
    evidence?: string
    source?: string
    page_url?: string | null
  }>
  metadata: Record<string, unknown>
  company_contact_id?: string | null
  person_id?: string | null
  company_id?: string | null
  observed_at?: string | null
}): TitleRoleEvidenceRecord[] {
  const full_name = asString(input.full_name)
  if (!full_name || !isPlausiblePersonName(full_name)) return []

  const pageType = asString(input.metadata.source_page_type)
  const records: TitleRoleEvidenceRecord[] = []
  const seen = new Set<string>()
  const observed_at = input.observed_at ?? new Date().toISOString()

  const directTitle = asString(input.title)
  if (directTitle && !GENERIC_TITLES.has(directTitle.toLowerCase())) {
    if (
      isEvidenceBackedTitle({
        title: directTitle,
        full_name,
        source_evidence: input.source_evidence,
        metadata: input.metadata,
      })
    ) {
      const key = directTitle.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        records.push({
          title: directTitle,
          source: mapEvidenceSource(asString(input.source_evidence[0]?.source), pageType),
          source_url:
            asString(input.metadata.source_page_url) ||
            asString(input.source_evidence[0]?.page_url) ||
            null,
          evidence_excerpt: asString(input.source_evidence[0]?.evidence).slice(0, 240),
          claim: asString(input.source_evidence[0]?.claim) || `${full_name} — ${directTitle}`,
          observed_at,
          qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
          person_id: input.person_id ?? null,
          company_id: input.company_id ?? null,
          company_contact_id: input.company_contact_id ?? null,
        })
      }
    }
  }

  for (const row of input.source_evidence) {
    const claim = asString(row.claim)
    const evidence = asString(row.evidence)
    const parsed = parseNameTitleFromClaim(claim, evidence)
    if (!parsed) continue
    if (parsed.name.toLowerCase() !== full_name.toLowerCase()) continue
    if (GENERIC_TITLES.has(parsed.title.toLowerCase())) continue
    if (
      !isEvidenceBackedTitle({
        title: parsed.title,
        full_name,
        source_evidence: input.source_evidence,
        metadata: input.metadata,
      })
    ) {
      continue
    }
    const key = parsed.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    records.push({
      title: parsed.title,
      source: mapEvidenceSource(asString(row.source), pageType),
      source_url: asString(row.page_url) || asString(input.metadata.source_page_url) || null,
      evidence_excerpt: evidence.slice(0, 240) || claim.slice(0, 240),
      claim: claim || `${parsed.name} — ${parsed.title}`,
      observed_at,
      qa_marker: GROWTH_TITLE_ROLE_EVIDENCE_QA_MARKER,
      person_id: input.person_id ?? null,
      company_id: input.company_id ?? null,
      company_contact_id: input.company_contact_id ?? null,
    })
  }

  return records
}

export function selectBestTitleEvidence(
  records: TitleRoleEvidenceRecord[],
): TitleRoleEvidenceRecord | null {
  if (records.length === 0) return null
  const priority: Record<TitleRoleEvidenceSource, number> = {
    schema_org: 100,
    leadership_page: 90,
    team_page: 80,
    staff_directory: 75,
    about_page: 70,
    author_byline: 65,
    contact_card: 60,
    structured_metadata: 55,
  }
  return [...records].sort((a, b) => (priority[b.source] ?? 0) - (priority[a.source] ?? 0))[0] ?? null
}
