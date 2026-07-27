/**
 * AVA-BLOCK-IMAGING-APPROVAL-BINDING-HOTFIX-1A — Deterministic outbound copy quality checks (client-safe).
 */

export const AVA_OUTBOUND_COPY_QUALITY_BOUNDARY_CORE_QA_MARKER =
  "ava-outbound-copy-quality-boundary-core-1a-v1" as const

/** Unicode em dash (—) — prohibited in Ava supervised outbound copy. */
export const AVA_OUTBOUND_PROHIBITED_EM_DASH = "\u2014" as const

export const AVA_OUTBOUND_STYLE_PROHIBITION_LINES = [
  "NEVER use an em dash (—) in outbound copy.",
  "Use a comma, period, colon, parentheses, or a rewritten sentence instead.",
] as const

export function containsProhibitedAvaOutboundStyleMarkers(text: string | null | undefined): boolean {
  if (!text) return false
  return text.includes(AVA_OUTBOUND_PROHIBITED_EM_DASH)
}

/**
 * Deterministic pre-persistence normalization for model punctuation slips.
 * Only safe substitutions — never run after message approval.
 */
export function normalizeProhibitedAvaOutboundCopy(text: string): string {
  let next = text
  while (next.includes(AVA_OUTBOUND_PROHIBITED_EM_DASH)) {
    next = next.replace(/\s*\u2014\s*/g, ", ")
  }
  return next.replace(/,\s+,/g, ", ").replace(/,\s+\./g, ".").trimEnd()
}

export function assertAvaOutboundCopyQualityForPersistence(input: {
  subject: string | null | undefined
  body: string | null | undefined
}): { ok: true; subject: string; body: string } | { ok: false; code: "prohibited_outbound_style"; field: "subject" | "body" } {
  const subject = input.subject?.trim() ?? ""
  const body = input.body?.trim() ?? ""
  if (!subject || !body) {
    return { ok: false, code: "prohibited_outbound_style", field: !subject ? "subject" : "body" }
  }

  const normalizedSubject = normalizeProhibitedAvaOutboundCopy(subject)
  const normalizedBody = normalizeProhibitedAvaOutboundCopy(body)

  if (containsProhibitedAvaOutboundStyleMarkers(normalizedSubject)) {
    return { ok: false, code: "prohibited_outbound_style", field: "subject" }
  }
  if (containsProhibitedAvaOutboundStyleMarkers(normalizedBody)) {
    return { ok: false, code: "prohibited_outbound_style", field: "body" }
  }

  return { ok: true, subject: normalizedSubject, body: normalizedBody }
}
