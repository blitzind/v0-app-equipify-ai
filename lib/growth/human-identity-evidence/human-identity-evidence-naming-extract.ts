/** Evidence-backed identity naming extraction (7.PS-HN). Client-safe. */

import { isPlausiblePersonName } from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  evidenceCorpus,
  isGenericIdentityName,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "contact",
  "sales",
  "support",
  "hello",
  "admin",
  "office",
  "service",
  "dispatch",
  "billing",
  "hr",
  "careers",
  "help",
  "team",
  "noreply",
  "no-reply",
])

export type EvidenceBackedIdentityCandidate = {
  full_name: string
  title: string | null
  method:
    | "structured_claim"
    | "team_page_claim"
    | "email_local_part"
  evidence_ref: string
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function capitalizeToken(token: string): string {
  if (!token) return ""
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

function nameFromEmailLocalPart(email: string): string | null {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? ""
  if (!local || local.length < 3 || ROLE_LOCAL_PARTS.has(local)) return null

  if (local.includes(".")) {
    const parts = local.split(".").filter((p) => p.length >= 2 && !ROLE_LOCAL_PARTS.has(p))
    if (parts.length >= 2) {
      const full = parts.map(capitalizeToken).join(" ")
      if (full.length >= 4) return full
    }
  }

  if (/^[a-z][a-z'-]{2,}$/i.test(local)) {
    return capitalizeToken(local)
  }
  return null
}

function parseStructuredClaim(claim: string, evidence: string): { full_name: string; title: string | null } | null {
  const text = `${claim} ${evidence}`.trim()
  const patterns = [
    /^(?:schema\.org person|leadership|team_page):\s*(.+?)\s*[—–-]\s*(.+)$/i,
    /^(.+?)\s*[—–-]\s*(.+)$/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const full_name = match[1].trim()
    const title = match[2]?.trim() || null
    if (isPlausiblePersonName(full_name)) {
      return { full_name, title: title && title.length > 2 ? title : null }
    }
  }
  return null
}

export function buildIdentityEvidenceCorpus(input: {
  source_evidence: Array<{ claim?: string; evidence?: string; page_url?: string | null }>
  metadata: Record<string, unknown>
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
}): string {
  const base = evidenceCorpus({
    source_evidence: input.source_evidence,
    metadata: input.metadata,
  })
  const extras = [input.email, input.phone, input.linkedin_url].map(asString).filter(Boolean)
  return [base, ...extras].join(" ").toLowerCase()
}

export function extractEvidenceBackedIdentity(input: {
  full_name: string
  title?: string | null
  email?: string | null
  source_evidence: Array<{ claim?: string; evidence?: string; page_url?: string | null; source?: string }>
  metadata: Record<string, unknown>
}): EvidenceBackedIdentityCandidate | null {
  if (!isGenericIdentityName(input.full_name)) return null

  for (const row of input.source_evidence) {
    const claim = asString(row.claim)
    const evidence = asString(row.evidence)
    if (!claim && !evidence) continue
    const parsed = parseStructuredClaim(claim, evidence)
    if (parsed) {
      return {
        full_name: parsed.full_name,
        title: parsed.title ?? (asString(input.title) || null),
        method: asString(row.source).includes("team") ? "team_page_claim" : "structured_claim",
        evidence_ref: claim || evidence,
      }
    }
  }

  const email = asString(input.email)
  if (email) {
    const derived = nameFromEmailLocalPart(email)
    if (derived) {
      const corpus = buildIdentityEvidenceCorpus({
        source_evidence: input.source_evidence,
        metadata: input.metadata,
        email,
      })
      const normalized = derived.toLowerCase()
      if (
        corpus.includes(normalized) ||
        corpus.includes(email.toLowerCase()) ||
        normalized.split(/\s+/).every((t) => corpus.includes(t))
      ) {
        return {
          full_name: derived,
          title: asString(input.title) || null,
          method: "email_local_part",
          evidence_ref: email,
        }
      }
    }
  }

  return null
}

export function countGenericIdentities(
  rows: Array<{ full_name?: string | null }>,
): number {
  return rows.filter((row) => isGenericIdentityName(row.full_name)).length
}
