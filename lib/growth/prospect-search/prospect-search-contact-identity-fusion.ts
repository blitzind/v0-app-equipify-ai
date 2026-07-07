/** Multi-source contact identity fusion + conflict detection. Client-safe. */

import type { ProspectSearchContactIntelligenceInputContact } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import {
  buildContactIdentityAnchorKey,
  contactIdentityTitlesSimilar,
  isGenericRoleEmail,
  normalizeContactIdentityEmail,
  normalizeContactIdentityLinkedIn,
  normalizeContactIdentityName,
  normalizeContactIdentityPhone,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-normalize"
import {
  GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER,
  GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER,
  GROWTH_EVIDENCE_FUSION_QA_MARKER,
  type ProspectSearchContactCanonicalSnapshot,
  type ProspectSearchContactIdentityConflict,
  type ProspectSearchContactIdentityResolution,
  type ProspectSearchContactIdentitySourceRecord,
  type ProspectSearchContactConflictStatus,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-types"
import { buildProspectSearchContactIdentityTimeline } from "@/lib/growth/prospect-search/prospect-search-contact-identity-timeline"
import { buildProspectSearchContactCanonicalSnapshot } from "@/lib/growth/prospect-search/prospect-search-contact-identity-canonical"

type MergeStrength = "strong" | "moderate" | "weak" | "none" | "conflict"

function sourceRecordFromContact(
  contact: ProspectSearchContactIntelligenceInputContact,
): ProspectSearchContactIdentitySourceRecord {
  return {
    contact_id: contact.id,
    provider: contact.discovery_sources?.[0] ?? "unknown",
    full_name: contact.full_name,
    title: contact.title ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    linkedin_url: contact.linkedin_url ?? null,
    branch_name: contact.branch_name ?? null,
    branch_city: contact.branch_city ?? null,
    branch_state: contact.branch_state ?? null,
    source_page_url: contact.source_page_url ?? null,
    confidence: contact.confidence,
    evidence_quality_label: contact.evidence_quality_label ?? null,
    discovered_at: contact.discovered_at ?? contact.last_checked_at ?? null,
  }
}

function mergeStrength(
  left: ProspectSearchContactIntelligenceInputContact,
  right: ProspectSearchContactIntelligenceInputContact,
): { strength: MergeStrength; reasons: string[] } {
  const reasons: string[] = []
  const leftEmail = normalizeContactIdentityEmail(left.email)
  const rightEmail = normalizeContactIdentityEmail(right.email)
  if (leftEmail && rightEmail) {
    if (leftEmail === rightEmail) {
      reasons.push("Exact email match")
      const leftName = normalizeContactIdentityName(left.full_name)
      const rightName = normalizeContactIdentityName(right.full_name)
      if (leftName && rightName && leftName !== rightName) {
        return { strength: "conflict", reasons: [...reasons, "Same email with different names"] }
      }
      return { strength: "strong", reasons }
    }
    return { strength: "none", reasons: ["Different emails"] }
  }

  const leftPhone = normalizeContactIdentityPhone(left.phone)
  const rightPhone = normalizeContactIdentityPhone(right.phone)
  if (leftPhone && rightPhone) {
    if (leftPhone === rightPhone) {
      reasons.push("Exact normalized phone match")
      const leftName = normalizeContactIdentityName(left.full_name)
      const rightName = normalizeContactIdentityName(right.full_name)
      if (leftName && rightName && leftName !== rightName) {
        return { strength: "conflict", reasons: [...reasons, "Same phone with different names"] }
      }
      return { strength: "strong", reasons }
    }
    return { strength: "none", reasons: ["Different phones"] }
  }

  const leftLinkedIn = normalizeContactIdentityLinkedIn(left.linkedin_url)
  const rightLinkedIn = normalizeContactIdentityLinkedIn(right.linkedin_url)
  if (leftLinkedIn && rightLinkedIn && leftLinkedIn === rightLinkedIn) {
    reasons.push("LinkedIn profile URL match from company website")
    return { strength: "strong", reasons }
  }

  const leftName = normalizeContactIdentityName(left.full_name)
  const rightName = normalizeContactIdentityName(right.full_name)
  if (leftName && rightName && leftName === rightName) {
    if (contactIdentityTitlesSimilar(left.title, right.title)) {
      reasons.push("Same name with similar title evidence")
      return { strength: "moderate", reasons }
    }
    if (left.title?.trim() && right.title?.trim() && !contactIdentityTitlesSimilar(left.title, right.title)) {
      return {
        strength: "conflict",
        reasons: ["Same name with conflicting titles"],
      }
    }
    reasons.push("Name-only match — review recommended")
    return { strength: "weak", reasons }
  }

  return { strength: "none", reasons: [] }
}

class IdentityUnionFind {
  private parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index)
  }

  find(index: number): number {
    if (this.parent[index] === index) return index
    this.parent[index] = this.find(this.parent[index]!)
    return this.parent[index]!
  }

  union(a: number, b: number): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent[rootB] = rootA
  }
}

function contactScore(contact: ProspectSearchContactIntelligenceInputContact): number {
  return (
    contact.confidence +
    (contact.evidence_quality_score ?? 0) / 1000 +
    contact.source_evidence.length * 0.03 +
    (contact.is_primary ? 0.2 : 0) +
    (contact.email && !isGenericRoleEmail(contact.email) ? 0.06 : 0) +
    (contact.phone ? 0.05 : 0) +
    (contact.linkedin_url ? 0.04 : 0)
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
        existing.source === item.source &&
        (existing.page_url ?? null) === (item.page_url ?? null),
    )
    if (!duplicate) merged.push(item)
  }
  return merged
}

function mergeContactsInGroup(
  contacts: ProspectSearchContactIntelligenceInputContact[],
): ProspectSearchContactIntelligenceInputContact {
  const sorted = [...contacts].sort((a, b) => contactScore(b) - contactScore(a))
  return sorted.slice(1).reduce((primary, secondary) => {
    return {
      ...primary,
      id: primary.id,
      full_name: primary.full_name || secondary.full_name,
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
      source_page_type: primary.source_page_type ?? secondary.source_page_type ?? null,
      email_classification: primary.email_classification ?? secondary.email_classification ?? null,
      phone_classification: primary.phone_classification ?? secondary.phone_classification ?? null,
      evidence_quality_score:
        Math.max(primary.evidence_quality_score ?? 0, secondary.evidence_quality_score ?? 0) || null,
      evidence_quality_label:
        primary.evidence_quality_label ?? secondary.evidence_quality_label ?? null,
      evidence_quality_reasons: [
        ...new Set([
          ...(primary.evidence_quality_reasons ?? []),
          ...(secondary.evidence_quality_reasons ?? []),
        ]),
      ],
      extraction_risks: [
        ...new Set([...(primary.extraction_risks ?? []), ...(secondary.extraction_risks ?? [])]),
      ],
      branch_name: primary.branch_name ?? secondary.branch_name ?? null,
      branch_city: primary.branch_city ?? secondary.branch_city ?? null,
      branch_state: primary.branch_state ?? secondary.branch_state ?? null,
      branch_phone: primary.branch_phone ?? secondary.branch_phone ?? null,
      location_confidence: primary.location_confidence ?? secondary.location_confidence ?? null,
      linkedin_company_url: primary.linkedin_company_url ?? secondary.linkedin_company_url ?? null,
      linkedin_reference_label:
        primary.linkedin_reference_label ?? secondary.linkedin_reference_label ?? null,
    }
  }, sorted[0]!)
}

function detectGroupConflicts(
  contacts: ProspectSearchContactIntelligenceInputContact[],
  mergeReasons: string[],
): ProspectSearchContactIdentityConflict[] {
  const conflicts: ProspectSearchContactIdentityConflict[] = []
  const emails = new Map<string, Set<string>>()
  const phones = new Map<string, Set<string>>()

  for (const contact of contacts) {
    const email = normalizeContactIdentityEmail(contact.email)
    if (email) {
      const names = emails.get(email) ?? new Set<string>()
      names.add(normalizeContactIdentityName(contact.full_name))
      emails.set(email, names)
    }
    const phone = normalizeContactIdentityPhone(contact.phone)
    if (phone) {
      const names = phones.get(phone) ?? new Set<string>()
      names.add(normalizeContactIdentityName(contact.full_name))
      phones.set(phone, names)
    }
  }

  for (const [email, names] of emails.entries()) {
    if (names.size > 1) {
      conflicts.push({
        status: "channel_conflict",
        label: "Email shared across different names",
        detail: `${email} appears with ${names.size} different name variants`,
        source_contact_ids: contacts.filter((c) => normalizeContactIdentityEmail(c.email) === email).map((c) => c.id),
      })
    }
    if (isGenericRoleEmail(email)) {
      conflicts.push({
        status: "needs_review",
        label: "Generic role email attached to named contact",
        detail: `${email} may be a shared inbox rather than a personal channel`,
        source_contact_ids: contacts.filter((c) => normalizeContactIdentityEmail(c.email) === email).map((c) => c.id),
      })
    }
  }

  for (const [phone, names] of phones.entries()) {
    if (names.size > 1) {
      conflicts.push({
        status: "channel_conflict",
        label: "Phone shared across different names",
        detail: `Phone ending ${phone.slice(-4)} appears with ${names.size} different name variants`,
        source_contact_ids: contacts.filter((c) => normalizeContactIdentityPhone(c.phone) === phone).map((c) => c.id),
      })
    }
  }

  const branches = new Set(
    contacts
      .map((contact) =>
        [contact.branch_city, contact.branch_state].filter(Boolean).join(", ").trim(),
      )
      .filter(Boolean),
  )
  if (branches.size > 1) {
    conflicts.push({
      status: "branch_conflict",
      label: "Branch/location evidence conflicts",
      detail: `Observed ${branches.size} different branch/location contexts across merged sources`,
      source_contact_ids: contacts.map((contact) => contact.id),
    })
  }

  if (mergeReasons.some((reason) => reason.includes("Name-only"))) {
    conflicts.push({
      status: "needs_review",
      label: "Name-only merge evidence",
      detail: "Identity merged on name similarity without strong channel anchor",
      source_contact_ids: contacts.map((contact) => contact.id),
    })
  }

  return conflicts
}

function resolveConflictStatus(
  conflicts: ProspectSearchContactIdentityConflict[],
  mergeConfidence: number,
): ProspectSearchContactConflictStatus {
  if (conflicts.some((conflict) => conflict.status === "channel_conflict")) return "channel_conflict"
  if (conflicts.some((conflict) => conflict.status === "branch_conflict")) return "branch_conflict"
  if (conflicts.some((conflict) => conflict.status === "likely_different_people")) {
    return "likely_different_people"
  }
  if (conflicts.length > 0) return "needs_review"
  if (mergeConfidence >= 0.82) return "no_conflict"
  if (mergeConfidence >= 0.65) return "likely_same_person"
  return "needs_review"
}

function computeMergeConfidence(input: {
  groupSize: number
  strongestReasons: string[]
  conflicts: ProspectSearchContactIdentityConflict[]
}): number {
  let score = 0.45
  if (input.strongestReasons.some((reason) => reason.includes("Exact email"))) score += 0.28
  else if (input.strongestReasons.some((reason) => reason.includes("phone"))) score += 0.22
  else if (input.strongestReasons.some((reason) => reason.includes("LinkedIn"))) score += 0.2
  else if (input.strongestReasons.some((reason) => reason.includes("similar title"))) score += 0.12
  else score += 0.04

  if (input.groupSize > 1) score += Math.min(0.12, (input.groupSize - 1) * 0.04)
  if (input.conflicts.some((conflict) => conflict.status === "channel_conflict")) score -= 0.25
  if (input.conflicts.some((conflict) => conflict.status === "branch_conflict")) score -= 0.08
  if (input.conflicts.some((conflict) => conflict.label.includes("Name-only"))) score -= 0.12
  return Number(Math.min(0.98, Math.max(0.15, score)).toFixed(3))
}

function computeIdentityConfidence(input: {
  mergeConfidence: number
  canonical: ProspectSearchContactCanonicalSnapshot
  conflictStatus: ProspectSearchContactConflictStatus
  operatorConfirmed: boolean
}): number {
  let score = input.mergeConfidence * 0.55 + input.canonical.confidence * 0.45
  if (input.operatorConfirmed) score += 0.12
  if (input.conflictStatus === "channel_conflict") score -= 0.18
  if (input.conflictStatus === "needs_review") score -= 0.08
  if (input.canonical.best_email.value && !isGenericRoleEmail(input.canonical.best_email.value)) score += 0.04
  if (input.canonical.best_linkedin.value) score += 0.03
  return Number(Math.min(0.99, Math.max(0.1, score)).toFixed(3))
}

export function resolveProspectSearchContactIdentities(input: {
  company_id: string
  company_domain?: string | null
  contacts: ProspectSearchContactIntelligenceInputContact[]
}): {
  qa_marker: typeof GROWTH_EVIDENCE_FUSION_QA_MARKER
  merged_contacts: ProspectSearchContactIntelligenceInputContact[]
  resolutions: ProspectSearchContactIdentityResolution[]
  resolutions_by_contact_id: Map<string, ProspectSearchContactIdentityResolution>
} {
  const contacts = input.contacts.filter(
    (contact) => (contact.full_name ?? "").trim().length > 0,
  )
  if (contacts.length === 0) {
    return {
      qa_marker: GROWTH_EVIDENCE_FUSION_QA_MARKER,
      merged_contacts: [],
      resolutions: [],
      resolutions_by_contact_id: new Map(),
    }
  }

  const uf = new IdentityUnionFind(contacts.length)
  const pairReasons = new Map<string, string[]>()

  for (let i = 0; i < contacts.length; i += 1) {
    for (let j = i + 1; j < contacts.length; j += 1) {
      const evaluation = mergeStrength(contacts[i]!, contacts[j]!)
      if (evaluation.strength === "strong" || evaluation.strength === "moderate") {
        uf.union(i, j)
        pairReasons.set(`${i}:${j}`, evaluation.reasons)
      }
    }
  }

  const groups = new Map<number, ProspectSearchContactIntelligenceInputContact[]>()
  for (let index = 0; index < contacts.length; index += 1) {
    const root = uf.find(index)
    const list = groups.get(root) ?? []
    list.push(contacts[index]!)
    groups.set(root, list)
  }

  const merged_contacts: ProspectSearchContactIntelligenceInputContact[] = []
  const resolutions: ProspectSearchContactIdentityResolution[] = []
  const resolutions_by_contact_id = new Map<string, ProspectSearchContactIdentityResolution>()

  for (const group of groups.values()) {
    const merged = mergeContactsInGroup(group)
    const source_records = group.map(sourceRecordFromContact)
    const mergeReasons = [
      ...new Set(
        [...pairReasons.values()].flat().filter(Boolean),
      ),
    ]
    const conflicts = detectGroupConflicts(group, mergeReasons)
    const canonical = buildProspectSearchContactCanonicalSnapshot({
      source_records,
      merged_contact: merged,
      company_domain: input.company_domain,
    })
    const merge_confidence = computeMergeConfidence({
      groupSize: group.length,
      strongestReasons: mergeReasons,
      conflicts,
    })
    const conflict_status = resolveConflictStatus(conflicts, merge_confidence)
    const identity_key = buildContactIdentityAnchorKey({
      company_id: input.company_id,
      email: canonical.best_email.value,
      phone: canonical.best_phone.value,
      linkedin_url: canonical.best_linkedin.value,
      full_name: merged.full_name,
    })
    const identity_confidence = computeIdentityConfidence({
      mergeConfidence: merge_confidence,
      canonical,
      conflictStatus: conflict_status,
      operatorConfirmed: false,
    })
    const timeline = buildProspectSearchContactIdentityTimeline({
      source_records,
      conflicts,
      canonical,
    })

    const resolution: ProspectSearchContactIdentityResolution = {
      qa_marker: GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER,
      identity_key,
      merge_confidence,
      identity_confidence,
      primary_name: merged.full_name,
      primary_title: merged.title ?? null,
      known_emails: [...new Set(source_records.map((record) => record.email).filter(Boolean) as string[])],
      known_phones: [...new Set(source_records.map((record) => record.phone).filter(Boolean) as string[])],
      known_linkedin_urls: [
        ...new Set(source_records.map((record) => record.linkedin_url).filter(Boolean) as string[]),
      ],
      known_branches: [
        ...new Set(
          source_records
            .map((record) =>
              [record.branch_name, record.branch_city, record.branch_state].filter(Boolean).join(" · "),
            )
            .filter(Boolean),
        ),
      ],
      source_evidence: merged.source_evidence,
      source_records,
      source_count: source_records.length,
      conflict_status,
      conflicts,
      conflict_flags: conflicts.map((conflict) => conflict.label),
      canonical,
      timeline,
      operator_confirmed: false,
      operator_review: null,
      primary_contact_id: merged.id,
    }

    merged_contacts.push(merged)
    resolutions.push(resolution)
    for (const record of source_records) {
      resolutions_by_contact_id.set(record.contact_id, resolution)
    }
  }

  return {
    qa_marker: GROWTH_EVIDENCE_FUSION_QA_MARKER,
    merged_contacts,
    resolutions,
    resolutions_by_contact_id,
  }
}

export {
  GROWTH_CONTACT_IDENTITY_RESOLUTION_QA_MARKER,
  GROWTH_CONTACT_CONFLICT_REVIEW_QA_MARKER,
  GROWTH_EVIDENCE_FUSION_QA_MARKER,
}
