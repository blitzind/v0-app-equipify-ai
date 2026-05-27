/** Client-safe person signal metadata readers + API sanitization. */

import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"

const INTERNAL_METADATA_KEYS = new Set([
  "people_provider",
  "raw_import_batch",
  "internal_debug",
  "provider_debug",
])

export type SanitizedPersonSignalMetadata = {
  person_signal?: boolean
  person_name?: string | null
  identity_confidence?: number | null
  identity_confidence_reason?: string | null
  required_review?: boolean
  previous_company_name?: string | null
  previous_company_domain?: string | null
  new_company_name?: string | null
  new_company_domain?: string | null
  previous_title?: string | null
  new_title?: string | null
  transition_type?: string | null
  same_company_transition?: boolean
  seniority_delta?: number | null
  evidence_urls?: string[]
  source_label?: string | null
  no_autonomous_outreach?: boolean
  department?: string | null
}

export function sanitizePersonSignalMetadata(
  metadata: Record<string, unknown> | null | undefined,
): SanitizedPersonSignalMetadata {
  const raw = metadata ?? {}
  const evidenceUrls = Array.isArray(raw.evidence_urls)
    ? raw.evidence_urls.filter((url): url is string => typeof url === "string" && url.startsWith("http"))
    : []

  return {
    person_signal: raw.person_signal === true ? true : undefined,
    person_name: typeof raw.person_name === "string" ? raw.person_name : null,
    identity_confidence:
      typeof raw.identity_confidence === "number" ? raw.identity_confidence : null,
    identity_confidence_reason:
      typeof raw.identity_confidence_reason === "string" ? raw.identity_confidence_reason : null,
    required_review: raw.required_review === true ? true : undefined,
    previous_company_name:
      typeof raw.previous_company_name === "string" ? raw.previous_company_name : null,
    previous_company_domain:
      typeof raw.previous_company_domain === "string" ? raw.previous_company_domain : null,
    new_company_name: typeof raw.new_company_name === "string" ? raw.new_company_name : null,
    new_company_domain: typeof raw.new_company_domain === "string" ? raw.new_company_domain : null,
    previous_title: typeof raw.previous_title === "string" ? raw.previous_title : null,
    new_title: typeof raw.new_title === "string" ? raw.new_title : null,
    transition_type: typeof raw.transition_type === "string" ? raw.transition_type : null,
    same_company_transition: raw.same_company_transition === true ? true : undefined,
    seniority_delta: typeof raw.seniority_delta === "number" ? raw.seniority_delta : null,
    evidence_urls: evidenceUrls.length ? evidenceUrls : undefined,
    source_label: typeof raw.source_label === "string" ? raw.source_label : null,
    no_autonomous_outreach: raw.no_autonomous_outreach === true ? true : undefined,
    department: typeof raw.department === "string" ? raw.department : null,
  }
}

export function readPersonSignalMetadata(signal: Pick<GrowthSignalRow, "metadata">): SanitizedPersonSignalMetadata {
  return sanitizePersonSignalMetadata(signal.metadata)
}

export function isPersonLevelSignal(signal: Pick<GrowthSignalRow, "metadata" | "signal_type">): boolean {
  if (signal.signal_type === "job_change" || signal.signal_type === "promotion") return true
  return signal.metadata?.person_signal === true
}

export function formatIdentityConfidenceBadge(confidence: number | null | undefined): string {
  if (confidence == null) return "—"
  if (confidence >= 0.9) return "High"
  if (confidence >= 0.75) return "Verified"
  if (confidence >= 0.5) return "Review"
  return "Low"
}

export function stripInternalPersonMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...metadata }
  for (const key of INTERNAL_METADATA_KEYS) {
    delete copy[key]
  }
  delete copy.person_external_id
  return sanitizePersonSignalMetadata(copy) as Record<string, unknown>
}
