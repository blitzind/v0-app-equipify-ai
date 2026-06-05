/** Evidence helpers for human identity review. Client-safe where noted. */

import { GROWTH_HUMAN_IDENTITY_GENERIC_NAMES } from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

export function isGenericIdentityName(name: string | null | undefined): boolean {
  const normalized = (name ?? "").trim().toLowerCase()
  if (!normalized) return true
  return (GROWTH_HUMAN_IDENTITY_GENERIC_NAMES as readonly string[]).includes(normalized)
}

export function resolveCompanyContactSourceUrl(input: {
  source_evidence: Array<{ page_url?: string | null }>
  metadata: Record<string, unknown>
}): string | null {
  for (const row of input.source_evidence) {
    const url = typeof row.page_url === "string" ? row.page_url.trim() : ""
    if (url) return url
  }
  const metaUrl =
    typeof input.metadata.source_page_url === "string" ? input.metadata.source_page_url.trim() : ""
  return metaUrl || null
}

export function evidenceCorpus(input: {
  source_evidence: Array<{ claim?: string; evidence?: string; page_url?: string | null }>
  metadata: Record<string, unknown>
}): string {
  const parts: string[] = []
  for (const row of input.source_evidence) {
    if (row.claim) parts.push(row.claim)
    if (row.evidence) parts.push(row.evidence)
    if (row.page_url) parts.push(row.page_url)
  }
  const metaUrl =
    typeof input.metadata.source_page_url === "string" ? input.metadata.source_page_url : ""
  if (metaUrl) parts.push(metaUrl)
  return parts.join(" ").toLowerCase()
}

export function assertValueSupportedByEvidence(input: {
  value: string
  evidence_corpus: string
  field_label: string
}): { ok: true } | { ok: false; message: string } {
  const value = input.value.trim()
  if (!value) {
    return { ok: false, message: `${input.field_label} cannot be empty.` }
  }
  if (isGenericIdentityName(value)) {
    return { ok: false, message: `${input.field_label} cannot remain a generic placeholder.` }
  }
  const corpus = input.evidence_corpus
  const normalized = value.toLowerCase()
  if (!corpus.includes(normalized)) {
    const tokens = normalized.split(/\s+/).filter((t) => t.length > 2)
    const matched = tokens.filter((t) => corpus.includes(t))
    if (matched.length < Math.min(2, tokens.length)) {
      return {
        ok: false,
        message: `${input.field_label} must appear in source evidence — verification without evidence is not allowed.`,
      }
    }
  }
  return { ok: true }
}

export function contactHasReviewableEvidence(input: {
  source_evidence: unknown[]
  metadata: Record<string, unknown>
  phone: string | null
  email: string | null
}): { ok: true; source_url: string | null } | { ok: false; message: string } {
  const hasEvidenceArray = Array.isArray(input.source_evidence) && input.source_evidence.length > 0
  const source_url = resolveCompanyContactSourceUrl({
    source_evidence: (input.source_evidence ?? []) as Array<{ page_url?: string | null }>,
    metadata: input.metadata,
  })
  if (!hasEvidenceArray && !source_url) {
    return { ok: false, message: "Source evidence or source URL is required before verification." }
  }
  if (!input.phone?.trim() && !input.email?.trim()) {
    return { ok: false, message: "Cannot verify a contact with no existing phone or email channel." }
  }
  return { ok: true, source_url }
}
