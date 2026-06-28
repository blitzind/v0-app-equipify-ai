/** Cross-provider contact merge for Prospect Search intelligence. Client-safe. */

import { normalizeEmail } from "@/lib/growth/import/normalize"
import type { ProspectSearchContactIntelligenceInputContact } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizePhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? ""
  if (digits.length < 10) return null
  return digits.slice(-10)
}

function contactScore(contact: ProspectSearchContactIntelligenceInputContact): number {
  return (
    contact.confidence +
    contact.source_evidence.length * 0.03 +
    (contact.is_primary ? 0.2 : 0) +
    (contact.email ? 0.05 : 0) +
    (contact.phone ? 0.05 : 0)
  )
}

function mergeEvidence(
  left: ProspectSearchContactIntelligenceInputContact["source_evidence"],
  right: ProspectSearchContactIntelligenceInputContact["source_evidence"],
): ProspectSearchContactIntelligenceInputContact["source_evidence"] {
  const merged = [...left]
  for (const item of right) {
    const duplicate = merged.some(
      (existing) =>
        existing.claim === item.claim &&
        existing.evidence === item.evidence &&
        existing.source === item.source,
    )
    if (!duplicate) merged.push(item)
  }
  return merged
}

function mergePair(
  left: ProspectSearchContactIntelligenceInputContact,
  right: ProspectSearchContactIntelligenceInputContact,
): ProspectSearchContactIntelligenceInputContact {
  const leftScore = contactScore(left)
  const rightScore = contactScore(right)
  const primary = leftScore >= rightScore ? left : right
  const secondary = primary === left ? right : left

  return {
    id: primary.id,
    full_name: primary.full_name,
    title: primary.title ?? secondary.title ?? null,
    email: primary.email ?? secondary.email ?? null,
    phone: primary.phone ?? secondary.phone ?? null,
    linkedin_url: primary.linkedin_url ?? secondary.linkedin_url ?? null,
    confidence: Math.max(primary.confidence, secondary.confidence),
    role_type: primary.role_type ?? secondary.role_type ?? null,
    is_primary: primary.is_primary || secondary.is_primary,
    source_evidence: mergeEvidence(primary.source_evidence, secondary.source_evidence),
    source_page_url: primary.source_page_url ?? secondary.source_page_url ?? null,
    last_checked_at: primary.last_checked_at ?? secondary.last_checked_at ?? null,
    verification_status: primary.verification_status ?? secondary.verification_status ?? null,
    discovery_sources: [
      ...new Set([...(primary.discovery_sources ?? []), ...(secondary.discovery_sources ?? [])]),
    ],
  }
}

function identityKeys(contact: ProspectSearchContactIntelligenceInputContact): string[] {
  const keys: string[] = []
  const nameKey = normalizeName(contact.full_name)
  if (nameKey) keys.push(`name:${nameKey}`)
  const emailKey = normalizeEmail(contact.email)
  if (emailKey) keys.push(`email:${emailKey}`)
  const phoneKey = normalizePhone(contact.phone)
  if (phoneKey) keys.push(`phone:${phoneKey}`)
  return keys
}

export function mergeProspectSearchContactInputs(
  contacts: ProspectSearchContactIntelligenceInputContact[],
): ProspectSearchContactIntelligenceInputContact[] {
  const merged: ProspectSearchContactIntelligenceInputContact[] = []

  for (const contact of contacts) {
    const keys = identityKeys(contact)
    if (keys.length === 0) continue

    let matchIndex = -1
    for (let index = 0; index < merged.length; index += 1) {
      const candidateKeys = identityKeys(merged[index]!)
      if (keys.some((key) => candidateKeys.includes(key))) {
        matchIndex = index
        break
      }
    }

    if (matchIndex === -1) {
      merged.push(contact)
      continue
    }

    merged[matchIndex] = mergePair(merged[matchIndex]!, contact)
  }

  return merged
}
