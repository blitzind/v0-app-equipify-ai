/** Job change / promotion normalization — deterministic, evidence-backed. */

import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { classifyJobDepartment } from "@/lib/growth/signals/job-signal-classification"

export const GROWTH_PEOPLE_SIGNALS_QA_MARKER = "growth-people-signals-v1" as const

export const PERSON_SIGNAL_TRANSITION_TYPES = [
  "company_move",
  "internal_promotion",
  "title_change",
  "role_start",
  "role_end",
  "unknown",
] as const

export type PersonSignalTransitionType = (typeof PERSON_SIGNAL_TRANSITION_TYPES)[number]

export type JobChangeManualInputItem = {
  person_name?: string
  person_external_id?: string
  source_url?: string
  url?: string
  source_label?: string
  excerpt?: string
  snippet?: string
  occurred_at?: string
  detected_at?: string
  previous_company_name?: string
  previous_company_domain?: string
  new_company_name?: string
  new_company_domain?: string
  previous_title?: string
  new_title?: string
  title?: string
  department?: string
  transition_type?: string
  explicit_promotion?: boolean
  provider_event_id?: string
}

const SENIORITY_RANK: Record<string, number> = {
  individual: 1,
  manager: 2,
  director: 3,
  vp: 4,
  c_suite: 5,
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

function normalizeCompanyName(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? ""
}

function normalizeCompanyDomain(value: string | null | undefined): string | null {
  const normalized = normalizeDomain(value)
  return normalized || null
}

export function classifyTitleSeniority(title: string | null | undefined): string {
  const hay = asString(title).toLowerCase()
  if (!hay) return "individual"
  if (/\b(ceo|cto|cfo|coo|chief|president|founder)\b/.test(hay)) return "c_suite"
  if (/\b(vp|vice president|svp|evp)\b/.test(hay)) return "vp"
  if (/\b(director|head of)\b/.test(hay)) return "director"
  if (/\b(manager|supervisor|lead)\b/.test(hay)) return "manager"
  return "individual"
}

export function computeSeniorityDelta(previousTitle: string | null, newTitle: string | null): number {
  const prev = SENIORITY_RANK[classifyTitleSeniority(previousTitle)] ?? 0
  const next = SENIORITY_RANK[classifyTitleSeniority(newTitle)] ?? 0
  return next - prev
}

export function detectTransitionType(input: {
  previous_company_name?: string | null
  previous_company_domain?: string | null
  new_company_name?: string | null
  new_company_domain?: string | null
  previous_title?: string | null
  new_title?: string | null
  explicit_promotion?: boolean
}): PersonSignalTransitionType {
  if (input.explicit_promotion) return "internal_promotion"

  const prevDomain = normalizeCompanyDomain(input.previous_company_domain)
  const newDomain = normalizeCompanyDomain(input.new_company_domain)
  const prevName = normalizeCompanyName(input.previous_company_name).toLowerCase()
  const newName = normalizeCompanyName(input.new_company_name).toLowerCase()

  const sameCompany =
    (prevDomain && newDomain && prevDomain === newDomain) ||
    (prevName && newName && prevName === newName && prevName.length >= 3)

  if (!sameCompany && (prevDomain || prevName) && (newDomain || newName)) {
    return "company_move"
  }

  if (sameCompany) {
    const delta = computeSeniorityDelta(input.previous_title ?? null, input.new_title ?? null)
    if (delta > 0 && input.previous_title && input.new_title) return "internal_promotion"
    if (input.previous_title && input.new_title) return "title_change"
    if (input.new_title) return "role_start"
  }

  return "unknown"
}

export function buildPersonSignalEvidenceSummary(input: {
  person_name: string
  transition_type: PersonSignalTransitionType
  previous_title?: string | null
  new_title?: string | null
  previous_company_name?: string | null
  new_company_name?: string | null
  excerpt?: string | null
}): string {
  const person = input.person_name.trim()
  const newTitle = asString(input.new_title)
  const prevTitle = asString(input.previous_title)
  const newCo = asString(input.new_company_name)
  const prevCo = asString(input.previous_company_name)

  if (input.transition_type === "internal_promotion" && person && newTitle) {
    return `${person} promoted to ${newTitle}${newCo ? ` at ${newCo}` : ""}.`
  }
  if (input.transition_type === "company_move" && person && newTitle && newCo) {
    return `${person} moved to ${newTitle} at ${newCo}${prevCo ? ` from ${prevCo}` : ""}.`
  }
  if (input.excerpt) return input.excerpt.slice(0, 240)
  if (person && newTitle) return `${person} — ${newTitle}.`
  return "Verified person employment change."
}

export function buildPersonSignalDedupeKey(input: {
  person_external_id?: string | null
  person_name: string
  source_url?: string | null
  new_company_domain?: string | null
  new_company_name?: string | null
  new_title?: string | null
  occurred_at: string
  signal_type: "job_change" | "promotion"
}): string {
  const externalId = asString(input.person_external_id)
  if (externalId) {
    return [
      input.signal_type,
      externalId,
      normalizeCompanyDomain(input.new_company_domain) ?? normalizeCompanyName(input.new_company_name).toLowerCase(),
      asString(input.new_title).toLowerCase(),
      input.occurred_at.slice(0, 7),
    ].join("|")
  }

  const sourceUrl = asString(input.source_url)
  if (sourceUrl) {
    return [
      input.signal_type,
      asString(input.person_name).toLowerCase(),
      sourceUrl.toLowerCase(),
      asString(input.new_title).toLowerCase(),
      input.occurred_at.slice(0, 7),
    ].join("|")
  }

  return [
    input.signal_type,
    asString(input.person_name).toLowerCase(),
    normalizeCompanyDomain(input.new_company_domain) ?? normalizeCompanyName(input.new_company_name).toLowerCase(),
    asString(input.new_title).toLowerCase(),
    input.occurred_at.slice(0, 7),
  ].join("|")
}

export function parseJobChangeManualItem(raw: unknown): JobChangeManualInputItem | null {
  if (!raw || typeof raw !== "object") return null
  return raw as JobChangeManualInputItem
}

export function normalizeJobChangeManualFields(raw: JobChangeManualInputItem) {
  const personName = asString(raw.person_name)
  const sourceUrl = asString(raw.source_url) || asString(raw.url)
  const excerpt = asString(raw.excerpt) || asString(raw.snippet)
  const newTitle = asString(raw.new_title) || asString(raw.title)
  const previousTitle = asNullableString(raw.previous_title)
  const newCompanyName = normalizeCompanyName(raw.new_company_name)
  const newCompanyDomain = normalizeCompanyDomain(raw.new_company_domain)
  const previousCompanyName = normalizeCompanyName(raw.previous_company_name)
  const previousCompanyDomain = normalizeCompanyDomain(raw.previous_company_domain)
  const occurredAtRaw = asString(raw.occurred_at) || asString(raw.detected_at)
  const occurredAt =
    occurredAtRaw && Number.isFinite(Date.parse(occurredAtRaw))
      ? new Date(occurredAtRaw).toISOString()
      : new Date().toISOString()

  const department = classifyJobDepartment({
    title: newTitle,
    department: raw.department,
    excerpt,
  })
  const seniority = classifyTitleSeniority(newTitle)
  const transitionType = detectTransitionType({
    previous_company_name: previousCompanyName,
    previous_company_domain: previousCompanyDomain,
    new_company_name: newCompanyName,
    new_company_domain: newCompanyDomain,
    previous_title: previousTitle,
    new_title: newTitle,
    explicit_promotion: raw.explicit_promotion === true || raw.transition_type === "internal_promotion",
  })
  const seniorityDelta = computeSeniorityDelta(previousTitle, newTitle)

  return {
    personName,
    personExternalId: asNullableString(raw.person_external_id),
    sourceUrl,
    sourceLabel: asNullableString(raw.source_label),
    excerpt,
    newTitle,
    previousTitle,
    newCompanyName,
    newCompanyDomain,
    previousCompanyName,
    previousCompanyDomain,
    occurredAt,
    department,
    seniority,
    transitionType,
    seniorityDelta,
    providerEventId: asNullableString(raw.provider_event_id),
  }
}

export const GROWTH_JOB_CHANGE_MANUAL_QUEUE_SAMPLE_INPUT = [
  {
    person_name: "Jane Smith",
    person_external_id: "manual-123",
    source_url: "https://example.com/profile/jane-smith",
    source_label: "Manual verified profile",
    excerpt:
      "Jane Smith started a new role as Director of Operations at Acme Health Systems.",
    occurred_at: "2026-05-20T12:00:00Z",
    previous_company_name: "OldCo Services",
    previous_company_domain: "oldco.com",
    new_company_name: "Acme Health Systems",
    new_company_domain: "acmehealth.com",
    previous_title: "Operations Manager",
    new_title: "Director of Operations",
    department: "Operations",
  },
] as const

export const GROWTH_PROMOTION_MANUAL_QUEUE_SAMPLE_INPUT = [
  {
    person_name: "Alex Rivera",
    person_external_id: "manual-promo-44",
    source_url: "https://example.com/profile/alex-rivera",
    source_label: "Manual verified profile",
    excerpt: "Alex Rivera promoted to Director of Field Service at Summit Biomed.",
    occurred_at: "2026-05-18T09:00:00Z",
    new_company_name: "Summit Biomed",
    new_company_domain: "summitbiomed.com",
    previous_company_name: "Summit Biomed",
    previous_company_domain: "summitbiomed.com",
    previous_title: "Field Service Manager",
    new_title: "Director of Field Service",
    department: "Field Service",
    transition_type: "internal_promotion",
    explicit_promotion: true,
  },
] as const
