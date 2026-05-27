/** Deterministic person identity confidence for people signals — no AI, no fuzzy cross-company matching. */

export type PersonIdentityConfidenceInput = {
  person_name: string
  person_external_id?: string | null
  source_url?: string | null
  source_label?: string | null
  excerpt?: string | null
  new_company_name?: string | null
  new_company_domain?: string | null
  new_title?: string | null
  occurred_at?: string | null
}

export type PersonIdentityConfidenceResult = {
  identity_confidence: number
  confidence_reason: string
  accept: boolean
  required_review: boolean
}

const REJECT_THRESHOLD = 0.5
const REVIEW_THRESHOLD = 0.75

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function evaluatePersonIdentityConfidence(
  input: PersonIdentityConfidenceInput,
): PersonIdentityConfidenceResult {
  const personName = asString(input.person_name)
  const externalId = asString(input.person_external_id)
  const sourceUrl = asString(input.source_url)
  const excerpt = asString(input.excerpt)
  const company = asString(input.new_company_name) || asString(input.new_company_domain)
  const title = asString(input.new_title)
  const occurredAt = asString(input.occurred_at)

  if (!personName) {
    return {
      identity_confidence: 0,
      confidence_reason: "Missing person name — person-level signal rejected.",
      accept: false,
      required_review: true,
    }
  }

  if (externalId && isHttpUrl(sourceUrl)) {
    return {
      identity_confidence: 1,
      confidence_reason: "Exact import id + matching source profile URL.",
      accept: true,
      required_review: false,
    }
  }

  if (personName && isHttpUrl(sourceUrl) && company && title) {
    return {
      identity_confidence: 0.9,
      confidence_reason: "Person name + source profile URL + company/title.",
      accept: true,
      required_review: false,
    }
  }

  if (personName && company && title && excerpt && occurredAt) {
    return {
      identity_confidence: 0.75,
      confidence_reason: "Person name + company + title + dated source excerpt.",
      accept: true,
      required_review: true,
    }
  }

  if (externalId && excerpt) {
    return {
      identity_confidence: 0.5,
      confidence_reason: "Import id + evidence excerpt without source URL.",
      accept: true,
      required_review: true,
    }
  }

  return {
    identity_confidence: 0.35,
    confidence_reason: "Insufficient identity evidence for person-level signal.",
    accept: false,
    required_review: true,
  }
}

export function meetsPromotionIdentityThreshold(identityConfidence: number): boolean {
  return identityConfidence >= REVIEW_THRESHOLD
}

export { REJECT_THRESHOLD as PERSON_IDENTITY_REJECT_THRESHOLD }
