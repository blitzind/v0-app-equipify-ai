/** Canonical contact snapshot selection — explainable primary channel/title picks. Client-safe. */

import type { ProspectSearchContactIntelligenceInputContact } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence"
import {
  isGenericRoleEmail,
  normalizeContactIdentityEmail,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-normalize"
import type {
  ProspectSearchContactCanonicalChannelSelection,
  ProspectSearchContactCanonicalSnapshot,
  ProspectSearchContactIdentitySourceRecord,
} from "@/lib/growth/prospect-search/prospect-search-contact-identity-types"

function scoreSourceRecord(record: ProspectSearchContactIdentitySourceRecord): number {
  let score = record.confidence
  if (record.evidence_quality_label === "strong_public_evidence") score += 0.12
  else if (record.evidence_quality_label === "moderate_public_evidence") score += 0.06
  if (record.source_page_url) score += 0.03
  if (record.provider.includes("website")) score += 0.04
  if (record.provider.includes("manual") || record.provider.includes("verified")) score += 0.08
  return score
}

function selectBestChannel(input: {
  records: ProspectSearchContactIdentitySourceRecord[]
  pick: (record: ProspectSearchContactIdentitySourceRecord) => string | null
  channelLabel: string
  penalizeGenericEmail?: boolean
}): ProspectSearchContactCanonicalChannelSelection {
  const candidates = input.records
    .map((record) => ({
      record,
      value: input.pick(record),
      score: scoreSourceRecord(record),
    }))
    .filter((candidate) => candidate.value?.trim())

  if (candidates.length === 0) {
    return {
      value: null,
      source_contact_id: null,
      provider: null,
      reasons: [`No ${input.channelLabel} observed across merged sources`],
      downgraded_alternatives: [],
    }
  }

  const ranked = [...candidates].sort((a, b) => {
    const genericPenaltyA =
      input.penalizeGenericEmail && isGenericRoleEmail(a.value) ? -0.15 : 0
    const genericPenaltyB =
      input.penalizeGenericEmail && isGenericRoleEmail(b.value) ? -0.15 : 0
    return b.score + genericPenaltyB - (a.score + genericPenaltyA)
  })

  const winner = ranked[0]!
  const reasons = [
    `Selected ${input.channelLabel} from ${winner.record.provider.replace(/_/g, " ")} source`,
  ]
  if (winner.record.evidence_quality_label) {
    reasons.push(`Evidence quality: ${winner.record.evidence_quality_label.replace(/_/g, " ")}`)
  }
  if (winner.record.source_page_url) reasons.push("Published on a source page")
  if (input.penalizeGenericEmail && isGenericRoleEmail(winner.value)) {
    reasons.push("Generic role inbox selected — person confidence reduced")
  }

  return {
    value: winner.value,
    source_contact_id: winner.record.contact_id,
    provider: winner.record.provider,
    reasons,
    downgraded_alternatives: ranked
      .slice(1, 3)
      .map((candidate) => candidate.value!)
      .filter((value) => value !== winner.value),
  }
}

function selectBestTitle(records: ProspectSearchContactIdentitySourceRecord[]): {
  title: string | null
  reasons: string[]
} {
  const titled = records.filter((record) => record.title?.trim())
  if (titled.length === 0) {
    return { title: null, reasons: ["No title evidence across merged sources"] }
  }
  const winner = [...titled].sort((a, b) => scoreSourceRecord(b) - scoreSourceRecord(a))[0]!
  return {
    title: winner.title,
    reasons: [
      `Preferred title from ${winner.provider.replace(/_/g, " ")}`,
      winner.evidence_quality_label
        ? `Evidence quality: ${winner.evidence_quality_label.replace(/_/g, " ")}`
        : "Highest-confidence title evidence",
    ],
  }
}

export function buildProspectSearchContactCanonicalSnapshot(input: {
  source_records: ProspectSearchContactIdentitySourceRecord[]
  merged_contact: ProspectSearchContactIntelligenceInputContact
  company_domain?: string | null
}): ProspectSearchContactCanonicalSnapshot {
  const best_email = selectBestChannel({
    records: input.source_records,
    pick: (record) => record.email,
    channelLabel: "email",
    penalizeGenericEmail: true,
  })
  const best_phone = selectBestChannel({
    records: input.source_records,
    pick: (record) => record.phone,
    channelLabel: "phone",
  })
  const best_linkedin = selectBestChannel({
    records: input.source_records,
    pick: (record) => record.linkedin_url,
    channelLabel: "LinkedIn reference",
  })
  const titleSelection = selectBestTitle(input.source_records)

  const branchRecord = [...input.source_records]
    .filter((record) => record.branch_city || record.branch_name)
    .sort((a, b) => scoreSourceRecord(b) - scoreSourceRecord(a))[0]

  const best_source =
    [...input.source_records].sort((a, b) => scoreSourceRecord(b) - scoreSourceRecord(a))[0]?.provider ??
    input.merged_contact.discovery_sources?.[0] ??
    null

  let confidence =
    input.merged_contact.confidence * 0.35 +
    Math.max(...input.source_records.map((record) => scoreSourceRecord(record))) * 0.35
  if (best_email.value && !isGenericRoleEmail(best_email.value)) confidence += 0.08
  if (best_phone.value) confidence += 0.06
  if (best_linkedin.value) confidence += 0.04
  if (titleSelection.title) confidence += 0.04
  if (
    best_email.value &&
    input.company_domain &&
    normalizeContactIdentityEmail(best_email.value)?.endsWith(input.company_domain.replace(/^www\./, ""))
  ) {
    confidence += 0.04
  }

  const selection_summary = [
    ...titleSelection.reasons.slice(0, 1),
    ...best_email.reasons.slice(0, 1),
    ...best_phone.reasons.slice(0, 1),
    best_linkedin.value ? best_linkedin.reasons[0] : "No LinkedIn website reference selected",
  ].filter(Boolean)

  return {
    display_name: input.merged_contact.full_name,
    best_title: titleSelection.title,
    best_email,
    best_phone,
    best_linkedin,
    best_branch_name: branchRecord?.branch_name ?? null,
    best_branch_city: branchRecord?.branch_city ?? null,
    best_branch_state: branchRecord?.branch_state ?? null,
    best_source,
    confidence: Number(Math.min(0.99, Math.max(0.1, confidence)).toFixed(3)),
    selection_summary,
  }
}
