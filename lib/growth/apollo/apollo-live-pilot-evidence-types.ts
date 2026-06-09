/** Apollo AI-2 live pilot evidence schema — client-safe validation. */

export const APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER = "apollo-live-pilot-ai-2-v1" as const

export type ApolloLivePilotCanonicalMatchCounts = {
  matched: number
  created: number
  deduped: number
  rejected: number
}

export type ApolloLivePilotContactQuality = {
  decision_maker_count: number
  with_email: number
  with_phone: number
  with_verified_email: number
  with_linkedin: number
  irrelevant_title_skipped: number
  buying_committee_relevant: number
  average_decision_maker_score: number | null
  title_buckets: Record<string, number>
}

export type ApolloLivePilotResearchPipeline = {
  company_intelligence_present: boolean
  buying_committee_present: boolean
  fit_score_present: boolean
  relationship_intelligence_present: boolean
  next_best_action_present: boolean
  automated_flow_confirmed: boolean
}

export type ApolloLivePilotReadinessFunnel = {
  imported: number
  research_complete: number
  score_available: number
  contactable: number
  sequence_ready: number
}

export type ApolloLivePilotEvidence = {
  qa_marker: typeof APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER
  pilot_at: string
  mock: boolean
  company: {
    canonical_company_id: string | null
    company_candidate_id: string
    company_name: string
    domain: string | null
  }
  runtime: {
    duration_ms: number
    api_calls: number
    credits_consumed: number
    errors: string[]
  }
  discovery: {
    raw_contacts_returned: number
    contacts_mapped: number
    contacts_skipped: number
    contacts_rejected: number
    candidates_stored: number
    company_contacts_synced: number
  }
  canonical_matching: {
    company: ApolloLivePilotCanonicalMatchCounts
    person: ApolloLivePilotCanonicalMatchCounts
  }
  contact_quality: ApolloLivePilotContactQuality
  research_pipeline: ApolloLivePilotResearchPipeline
  readiness_funnel: ApolloLivePilotReadinessFunnel
  contact_ids?: {
    candidate_ids?: string[]
    company_contact_ids?: string[]
    canonical_person_ids?: string[]
  }
}

export type ApolloLivePilotEvidenceValidation = {
  ok: boolean
  errors: string[]
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
}

function readMatchCounts(value: unknown, label: string, errors: string[]): ApolloLivePilotCanonicalMatchCounts | null {
  if (!value || typeof value !== "object") {
    errors.push(`${label} counts required`)
    return null
  }
  const record = value as Record<string, unknown>
  for (const key of ["matched", "created", "deduped", "rejected"] as const) {
    if (!isNonNegativeInt(record[key])) {
      errors.push(`${label}.${key} must be a non-negative integer`)
      return null
    }
  }
  return {
    matched: record.matched as number,
    created: record.created as number,
    deduped: record.deduped as number,
    rejected: record.rejected as number,
  }
}

export function validateApolloLivePilotEvidence(input: unknown): ApolloLivePilotEvidenceValidation {
  const errors: string[] = []
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Evidence must be a JSON object"] }
  }
  const record = input as Record<string, unknown>

  if (record.qa_marker !== APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER) {
    errors.push(`qa_marker must be ${APOLLO_LIVE_PILOT_EVIDENCE_QA_MARKER}`)
  }
  if (typeof record.pilot_at !== "string" || !record.pilot_at.trim()) {
    errors.push("pilot_at ISO timestamp required")
  }
  if (typeof record.mock !== "boolean") {
    errors.push("mock boolean required")
  }

  const company = record.company
  if (!company || typeof company !== "object") {
    errors.push("company object required")
  } else {
    const c = company as Record<string, unknown>
    if (typeof c.company_candidate_id !== "string" || !c.company_candidate_id.trim()) {
      errors.push("company.company_candidate_id required")
    }
    if (typeof c.company_name !== "string" || !c.company_name.trim()) {
      errors.push("company.company_name required")
    }
  }

  const runtime = record.runtime
  if (!runtime || typeof runtime !== "object") {
    errors.push("runtime object required")
  } else {
    const r = runtime as Record<string, unknown>
    if (!isNonNegativeInt(r.duration_ms)) errors.push("runtime.duration_ms required")
    if (!isNonNegativeInt(r.api_calls)) errors.push("runtime.api_calls required")
    if (!isNonNegativeInt(r.credits_consumed)) errors.push("runtime.credits_consumed required")
    if (!Array.isArray(r.errors)) errors.push("runtime.errors array required")
  }

  const discovery = record.discovery
  if (!discovery || typeof discovery !== "object") {
    errors.push("discovery object required")
  } else {
    const d = discovery as Record<string, unknown>
    for (const key of [
      "raw_contacts_returned",
      "contacts_mapped",
      "contacts_skipped",
      "contacts_rejected",
      "candidates_stored",
      "company_contacts_synced",
    ] as const) {
      if (!isNonNegativeInt(d[key])) errors.push(`discovery.${key} required`)
    }
  }

  const canonical = record.canonical_matching
  if (!canonical || typeof canonical !== "object") {
    errors.push("canonical_matching object required")
  } else {
    const cm = canonical as Record<string, unknown>
    readMatchCounts(cm.company, "canonical_matching.company", errors)
    readMatchCounts(cm.person, "canonical_matching.person", errors)
  }

  const quality = record.contact_quality
  if (!quality || typeof quality !== "object") {
    errors.push("contact_quality object required")
  }

  const research = record.research_pipeline
  if (!research || typeof research !== "object") {
    errors.push("research_pipeline object required")
  } else {
    for (const key of [
      "company_intelligence_present",
      "buying_committee_present",
      "fit_score_present",
      "relationship_intelligence_present",
      "next_best_action_present",
      "automated_flow_confirmed",
    ] as const) {
      if (typeof (research as Record<string, unknown>)[key] !== "boolean") {
        errors.push(`research_pipeline.${key} boolean required`)
      }
    }
  }

  const funnel = record.readiness_funnel
  if (!funnel || typeof funnel !== "object") {
    errors.push("readiness_funnel object required")
  } else {
    for (const key of ["imported", "research_complete", "score_available", "contactable", "sequence_ready"] as const) {
      if (!isNonNegativeInt((funnel as Record<string, unknown>)[key])) {
        errors.push(`readiness_funnel.${key} required`)
      }
    }
  }

  return { ok: errors.length === 0, errors }
}

export function assertApolloLivePilotEvidence(input: unknown): asserts input is ApolloLivePilotEvidence {
  const validation = validateApolloLivePilotEvidence(input)
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "))
  }
}
