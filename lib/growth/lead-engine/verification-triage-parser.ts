import {
  GROWTH_LEAD_ENGINE_VERIFICATION_DISPOSITIONS,
  GROWTH_LEAD_ENGINE_VERIFICATION_POSITIVE_REASON_CODES,
  GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES,
  GROWTH_LEAD_ENGINE_VERIFICATION_REJECT_REASON_CODES,
  GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_OUTPUT_JSON_KEYS,
  type GrowthLeadEngineChannelVerificationSignals,
  type GrowthLeadEngineVerificationDisposition,
  type GrowthLeadEngineVerificationReasonCode,
  type GrowthLeadEngineVerificationSourceAttribution,
  type GrowthLeadEngineVerificationTriageOutput,
} from "@/lib/growth/lead-engine/verification-triage-types"

const REJECT_CODES = new Set<string>(GROWTH_LEAD_ENGINE_VERIFICATION_REJECT_REASON_CODES)
const POSITIVE_CODES = new Set<string>(GROWTH_LEAD_ENGINE_VERIFICATION_POSITIVE_REASON_CODES)
const ALLOWED_CODES = new Set<string>(GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES)

const POSITIVE_CHANNEL_BY_CODE: Record<string, keyof Pick<GrowthLeadEngineVerificationTriageOutput, "email_verification_signals" | "phone_verification_signals" | "linkedin_verification_signals">> = {
  EMAIL_CONFIRMED: "email_verification_signals",
  PHONE_CONFIRMED: "phone_verification_signals",
  LINKEDIN_CONFIRMED: "linkedin_verification_signals",
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
}

function asRiskScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asDisposition(value: unknown): GrowthLeadEngineVerificationDisposition {
  const raw = asString(value).toLowerCase()
  return GROWTH_LEAD_ENGINE_VERIFICATION_DISPOSITIONS.includes(
    raw as GrowthLeadEngineVerificationDisposition,
  )
    ? (raw as GrowthLeadEngineVerificationDisposition)
    : "risky"
}

function asReasonCodes(value: unknown): GrowthLeadEngineVerificationReasonCode[] {
  const raw = asStringArray(value)
  const filtered = raw.filter((code): code is GrowthLeadEngineVerificationReasonCode =>
    ALLOWED_CODES.has(code),
  )
  return [...new Set(filtered)]
}

function asChannelSignals(value: unknown): GrowthLeadEngineChannelVerificationSignals {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    status: asString(group.status) || "unverified",
    confidence: asConfidence(group.confidence),
    reason_codes: asReasonCodes(group.reason_codes),
    evidence: asString(group.evidence),
    sources: asStringArray(group.sources),
  }
}

function asSourceAttribution(value: unknown): GrowthLeadEngineVerificationSourceAttribution[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const channel = asString(row.channel)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = asConfidence(row.confidence)
      if (!source || !channel || !signal || !evidence) return null
      return { source, channel, signal, evidence, confidence }
    })
    .filter((row): row is GrowthLeadEngineVerificationSourceAttribution => row !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

function channelSupportsPositiveCode(
  channel: GrowthLeadEngineChannelVerificationSignals,
  code: string,
): boolean {
  if (!POSITIVE_CODES.has(code)) return true
  const confirmed =
    channel.status.toLowerCase().includes("confirm") ||
    channel.reason_codes.includes(code as GrowthLeadEngineVerificationReasonCode)
  return confirmed && channel.confidence > 0 && channel.evidence.length > 0
}

function attributionSupportsPositiveCode(
  attributions: GrowthLeadEngineVerificationSourceAttribution[],
  code: string,
): boolean {
  const channelKey = POSITIVE_CHANNEL_BY_CODE[code]
  if (!channelKey) return true
  const channelName = channelKey.replace("_verification_signals", "")
  return attributions.some(
    (row) =>
      row.channel.toLowerCase().includes(channelName) &&
      row.evidence.length > 0 &&
      row.confidence > 0,
  )
}

function stripUnsupportedPositiveCodes(
  codes: GrowthLeadEngineVerificationReasonCode[],
  output: GrowthLeadEngineVerificationTriageOutput,
): GrowthLeadEngineVerificationReasonCode[] {
  return codes.filter((code) => {
    if (!POSITIVE_CODES.has(code)) return true
    const channelKey = POSITIVE_CHANNEL_BY_CODE[code]
    if (!channelKey) return true
    const channel = output[channelKey]
    return (
      channelSupportsPositiveCode(channel, code) &&
      attributionSupportsPositiveCode(output.verification_source_attribution, code)
    )
  })
}

function enforceDisposition(output: GrowthLeadEngineVerificationTriageOutput): GrowthLeadEngineVerificationTriageOutput {
  let disposition = output.disposition
  let verification_confidence = output.verification_confidence
  let verification_reason_codes = [...output.verification_reason_codes]
  let human_review_required = output.human_review_required

  verification_reason_codes = stripUnsupportedPositiveCodes(verification_reason_codes, output)

  const hasRejectCode = verification_reason_codes.some((code) => REJECT_CODES.has(code))
  const hasIncomplete =
    verification_reason_codes.includes("CONTACT_INCOMPLETE") ||
    verification_reason_codes.includes("LOW_EVIDENCE")
  const hasConflict = verification_reason_codes.includes("MULTIPLE_CONFLICTING_SIGNALS")

  if (hasRejectCode || verification_confidence < 0.5) {
    disposition = "reject"
    human_review_required = true
  }

  if (disposition === "validated") {
    if (verification_confidence < 0.85) {
      disposition = "risky"
      if (!verification_reason_codes.includes("LOW_EVIDENCE")) {
        verification_reason_codes.push("LOW_EVIDENCE")
      }
      human_review_required = true
    }
    if (output.verification_source_attribution.length === 0) {
      disposition = "risky"
      if (!verification_reason_codes.includes("LOW_EVIDENCE")) {
        verification_reason_codes.push("LOW_EVIDENCE")
      }
      human_review_required = true
    }
    if (hasIncomplete || hasConflict || output.contact_completeness < 50) {
      disposition = "risky"
      human_review_required = true
    }
    if (output.risk_score >= 70) {
      disposition = "risky"
      if (!verification_reason_codes.includes("HIGH_RISK_CONTACT")) {
        verification_reason_codes.push("HIGH_RISK_CONTACT")
      }
      human_review_required = true
    }
  }

  if (disposition === "risky") {
    human_review_required = true
  }

  if (disposition === "reject") {
    human_review_required = true
    verification_confidence = Math.min(verification_confidence, 0.49)
  }

  return {
    ...output,
    disposition,
    verification_confidence,
    verification_reason_codes: [...new Set(verification_reason_codes)],
    human_review_required,
  }
}

export function parseGrowthLeadEngineVerificationTriageOutput(
  raw: string,
): { ok: true; output: GrowthLeadEngineVerificationTriageOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Verification triage response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const readinessGroup =
      record.duplicate_detection_readiness && typeof record.duplicate_detection_readiness === "object"
        ? (record.duplicate_detection_readiness as Record<string, unknown>)
        : {}

    const hashGroup =
      record.duplicate_hash_inputs && typeof record.duplicate_hash_inputs === "object"
        ? (record.duplicate_hash_inputs as Record<string, unknown>)
        : {}

    const attribution = asSourceAttribution(record.verification_source_attribution)
    if (attribution.length === 0) {
      return {
        ok: false,
        message: "Verification triage response must include verification_source_attribution with evidence.",
      }
    }

    const output: GrowthLeadEngineVerificationTriageOutput = {
      disposition: asDisposition(record.disposition),
      verification_confidence: asConfidence(record.verification_confidence),
      verification_reason_codes: asReasonCodes(record.verification_reason_codes),
      email_verification_signals: asChannelSignals(record.email_verification_signals),
      phone_verification_signals: asChannelSignals(record.phone_verification_signals),
      linkedin_verification_signals: asChannelSignals(record.linkedin_verification_signals),
      contact_completeness: asRiskScore(record.contact_completeness),
      risk_score: asRiskScore(record.risk_score),
      duplicate_detection_readiness: {
        ready: readinessGroup.ready === true,
        reason: asString(readinessGroup.reason),
        missing_inputs: asStringArray(readinessGroup.missing_inputs),
      },
      duplicate_hash_inputs: {
        company_name: asString(hashGroup.company_name),
        domain: asString(hashGroup.domain),
        contact_email: asString(hashGroup.contact_email),
        contact_phone: asString(hashGroup.contact_phone),
        full_name: asString(hashGroup.full_name),
        normalized_key: asString(hashGroup.normalized_key),
      },
      verification_source_attribution: attribution,
      human_review_required: record.human_review_required === true,
    }

    if (output.duplicate_detection_readiness.ready) {
      const missing: string[] = []
      if (!output.duplicate_hash_inputs.company_name) missing.push("company_name")
      if (!output.duplicate_hash_inputs.domain) missing.push("domain")
      if (!output.duplicate_hash_inputs.contact_email && !output.duplicate_hash_inputs.full_name) {
        missing.push("contact_email_or_full_name")
      }
      if (missing.length > 0) {
        output.duplicate_detection_readiness = {
          ready: false,
          reason: "Missing required hash inputs for dedupe readiness.",
          missing_inputs: missing,
        }
      }
    }

    const enforced = enforceDisposition(output)

    if (enforced.disposition === "validated" && enforced.verification_confidence < 0.85) {
      return {
        ok: false,
        message: "Parser invariant failed: validated disposition requires confidence >= 0.85.",
      }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not parse verification triage JSON.",
    }
  }
}

export function assertGrowthLeadEngineVerificationTriageOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_OUTPUT_JSON_KEYS
}
