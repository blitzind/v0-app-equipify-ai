import {
  GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_OUTPUT_JSON_KEYS,
  type GrowthLeadEngineAccountBriefOutput,
  type GrowthLeadEngineAccountBriefSourceAttribution,
  type GrowthLeadEngineEvidenceBackedClaim,
} from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

const OUTREACH_LIKE = /\b(dear |hi |hello |hey |subject:|unsubscribe|click here|book a demo|schedule a call with me)\b/i

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

function asCompleteness(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asEvidenceClaims(value: unknown): GrowthLeadEngineEvidenceBackedClaim[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const claim = asString(row.claim)
      const evidence = asString(row.evidence)
      const source = asString(row.source)
      const confidence = asConfidence(row.confidence)
      if (!claim || !evidence || !source) return null
      if (confidence <= 0) return null
      return { claim, evidence, source, confidence }
    })
    .filter((row): row is GrowthLeadEngineEvidenceBackedClaim => row !== null)
}

function asSourceAttribution(value: unknown): GrowthLeadEngineAccountBriefSourceAttribution[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const section = asString(row.section)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = asConfidence(row.confidence)
      if (!source || !section || !signal || !evidence) return null
      if (confidence <= 0) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthLeadEngineAccountBriefSourceAttribution => row !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

function claimSupportedByAttribution(
  claim: GrowthLeadEngineEvidenceBackedClaim,
  attributions: GrowthLeadEngineAccountBriefSourceAttribution[],
): boolean {
  const needle = claim.claim.toLowerCase()
  const evidenceNeedle = claim.evidence.toLowerCase()
  return attributions.some((row) => {
    const hay = `${row.signal} ${row.evidence}`.toLowerCase()
    return hay.includes(needle) || hay.includes(evidenceNeedle) || claim.evidence.length > 0
  })
}

const UNSUPPORTED_EVIDENCE = /\b(assumed|invented|guess|speculated|likely competes|market overlap)\b/i

function filterEvidenceClaims(
  items: GrowthLeadEngineEvidenceBackedClaim[],
  attributions: GrowthLeadEngineAccountBriefSourceAttribution[],
): GrowthLeadEngineEvidenceBackedClaim[] {
  return items.filter(
    (item) =>
      item.confidence >= 0.4 &&
      item.evidence.length > 0 &&
      !UNSUPPORTED_EVIDENCE.test(item.evidence) &&
      (claimSupportedByAttribution(item, attributions) || item.source.length > 0),
  )
}

function filterCompetitiveClaims(
  items: GrowthLeadEngineEvidenceBackedClaim[],
  attributions: GrowthLeadEngineAccountBriefSourceAttribution[],
): GrowthLeadEngineEvidenceBackedClaim[] {
  const corpus = [
    ...attributions.map((row) => `${row.signal} ${row.evidence}`),
    ...items.map((row) => row.evidence),
  ]
    .join(" ")
    .toLowerCase()

  return items.filter((item) => {
    if (item.confidence < 0.4 || !item.evidence || UNSUPPORTED_EVIDENCE.test(item.evidence)) {
      return false
    }
    const claimLower = item.claim.toLowerCase()
    const claimTokens = claimLower
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 3)
    const namedInEvidence = claimTokens.some((token) => item.evidence.toLowerCase().includes(token))
    const namedInCorpus = claimTokens.some((token) => corpus.includes(token))
    return namedInEvidence && (namedInCorpus || claimSupportedByAttribution(item, attributions))
  })
}

function looksLikeOutreachCopy(value: string): boolean {
  return OUTREACH_LIKE.test(value) || value.length > 280
}

function enforceAccountBrief(
  output: GrowthLeadEngineAccountBriefOutput,
  verificationDisposition: string | null,
): GrowthLeadEngineAccountBriefOutput {
  let research_confidence = output.research_confidence
  let brief_completeness = output.brief_completeness
  let human_review_required = output.human_review_required

  const pain_points = filterEvidenceClaims(output.pain_points, output.source_attribution)
  const growth_signals = filterEvidenceClaims(output.growth_signals, output.source_attribution)
  const buying_signals = filterEvidenceClaims(output.buying_signals, output.source_attribution)
  const competitive_context = filterCompetitiveClaims(
    output.competitive_context,
    output.source_attribution,
  )

  let recommended_cta = output.recommended_cta
  let recommended_angle = output.recommended_angle
  if (looksLikeOutreachCopy(recommended_cta)) {
    recommended_cta = "Review upstream evidence and validate fit on next discovery call."
    human_review_required = true
  }
  if (looksLikeOutreachCopy(recommended_angle)) {
    recommended_angle = "Position around evidenced operational pain and ICP fit — avoid scripted outreach."
    human_review_required = true
  }

  if (output.source_attribution.length === 0) {
    research_confidence = Math.min(research_confidence, 0.45)
    brief_completeness = Math.min(brief_completeness, 40)
    human_review_required = true
  }

  if (research_confidence < 0.7) {
    human_review_required = true
  }
  if (brief_completeness < 60) {
    human_review_required = true
  }
  if (verificationDisposition === "reject" || verificationDisposition === "risky") {
    human_review_required = true
    if (verificationDisposition === "reject") {
      research_confidence = Math.min(research_confidence, 0.49)
    }
  }

  if (!output.company_summary) {
    brief_completeness = Math.min(brief_completeness, 30)
    human_review_required = true
  }

  return {
    ...output,
    pain_points,
    growth_signals,
    buying_signals,
    competitive_context,
    recommended_angle,
    recommended_cta,
    research_confidence,
    brief_completeness,
    human_review_required,
  }
}

export function parseGrowthLeadEngineAccountBriefOutput(
  raw: string,
  options?: { verificationDisposition?: string | null },
): { ok: true; output: GrowthLeadEngineAccountBriefOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Account brief response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const source_attribution = asSourceAttribution(record.source_attribution)
    if (source_attribution.length === 0) {
      return {
        ok: false,
        message: "Account brief response must include source_attribution with evidence.",
      }
    }

    const output: GrowthLeadEngineAccountBriefOutput = {
      company_summary: asString(record.company_summary),
      why_this_account: asString(record.why_this_account),
      fit_summary: asString(record.fit_summary),
      pain_points: asEvidenceClaims(record.pain_points),
      growth_signals: asEvidenceClaims(record.growth_signals),
      buying_signals: asEvidenceClaims(record.buying_signals),
      technology_summary: asString(record.technology_summary),
      buying_committee_summary: asString(record.buying_committee_summary),
      verified_contacts_summary: asString(record.verified_contacts_summary),
      risk_summary: asString(record.risk_summary),
      competitive_context: asEvidenceClaims(record.competitive_context),
      recommended_angle: asString(record.recommended_angle),
      recommended_value_props: asStringArray(record.recommended_value_props).slice(0, 8),
      recommended_cta: asString(record.recommended_cta),
      research_confidence: asConfidence(record.research_confidence),
      brief_completeness: asCompleteness(record.brief_completeness),
      human_review_required: record.human_review_required === true,
      evidence_summary: asString(record.evidence_summary),
      source_attribution,
    }

    if (!output.company_summary) {
      return { ok: false, message: "Account brief response missing company_summary." }
    }
    if (!output.recommended_angle) {
      return { ok: false, message: "Account brief response missing recommended_angle." }
    }
    if (!output.recommended_cta) {
      return { ok: false, message: "Account brief response missing recommended_cta." }
    }

    const enforced = enforceAccountBrief(output, options?.verificationDisposition ?? null)

    if (enforced.research_confidence > 0.85 && enforced.human_review_required && enforced.brief_completeness < 50) {
      return {
        ok: false,
        message: "Account brief marked high confidence but completeness too low for human review flag.",
      }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse account brief JSON.",
    }
  }
}

export function parseGrowthLeadEngineAccountBriefFromUpstream(
  raw: string,
  verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string,
): ReturnType<typeof parseGrowthLeadEngineAccountBriefOutput> {
  let disposition: string | null = null
  if (verificationTriage && typeof verificationTriage === "object") {
    disposition = verificationTriage.disposition
  }
  return parseGrowthLeadEngineAccountBriefOutput(raw, { verificationDisposition: disposition })
}

export function assertGrowthLeadEngineAccountBriefOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_OUTPUT_JSON_KEYS
}
