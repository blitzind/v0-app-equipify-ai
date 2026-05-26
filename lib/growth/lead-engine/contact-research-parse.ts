import {
  GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_OUTPUT_JSON_KEYS,
  type GrowthLeadEngineContactCandidate,
  type GrowthLeadEngineContactResearchOutput,
  type GrowthLeadEngineContactSourceEvidence,
} from "@/lib/growth/lead-engine/contact-research-types"

const GUESSED_EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
}

function asScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asSourceEvidence(value: unknown): GrowthLeadEngineContactSourceEvidence[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      return {
        claim: asString(row.claim),
        evidence: asString(row.evidence),
        source: asString(row.source),
      }
    })
    .filter((row) => row.claim.length > 0 || row.evidence.length > 0)
}

function evidenceSupportsField(
  evidence: GrowthLeadEngineContactSourceEvidence[],
  fieldValue: string,
): boolean {
  if (!fieldValue.trim()) return true
  const needle = fieldValue.trim().toLowerCase()
  return evidence.some((row) => {
    const hay = `${row.claim} ${row.evidence}`.toLowerCase()
    return hay.includes(needle)
  })
}

function asContactCandidate(value: unknown): GrowthLeadEngineContactCandidate | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const full_name = asString(row.full_name)
  if (!full_name) return null

  const source_evidence = asSourceEvidence(row.source_evidence)
  if (source_evidence.length === 0) return null

  const email = asString(row.email)
  const phone = asString(row.phone)
  const linkedin_url = asString(row.linkedin_url)
  const confidence = asConfidence(row.confidence)
  const email_confidence = asConfidence(row.email_confidence)
  const phone_confidence = asConfidence(row.phone_confidence)

  if (confidence <= 0) return null
  if (email && email_confidence <= 0) return null
  if (phone && phone_confidence <= 0) return null
  if (email && !evidenceSupportsField(source_evidence, email)) return null
  if (phone && !evidenceSupportsField(source_evidence, phone)) return null
  if (linkedin_url && !evidenceSupportsField(source_evidence, linkedin_url)) return null

  const evidenceText = source_evidence.map((entry) => `${entry.claim} ${entry.evidence}`).join(" ").toLowerCase()
  if (!evidenceText.includes(full_name.toLowerCase().split(/\s+/)[0] ?? "")) {
    return null
  }

  return {
    full_name,
    job_title: asString(row.job_title),
    department: asString(row.department),
    role_match_type: asString(row.role_match_type),
    email,
    email_confidence: email ? email_confidence : 0,
    phone,
    phone_confidence: phone ? phone_confidence : 0,
    linkedin_url,
    source_evidence,
    confidence,
  }
}

function asContactCandidates(value: unknown): GrowthLeadEngineContactCandidate[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asContactCandidate(entry))
    .filter((entry): entry is GrowthLeadEngineContactCandidate => entry !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

export function parseGrowthLeadEngineContactResearchOutput(
  raw: string,
): { ok: true; output: GrowthLeadEngineContactResearchOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Contact research response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const coverageGroup =
      record.coverage && typeof record.coverage === "object"
        ? (record.coverage as Record<string, unknown>)
        : {}

    const qualityGroup =
      record.research_quality && typeof record.research_quality === "object"
        ? (record.research_quality as Record<string, unknown>)
        : {}

    const rawCandidates = Array.isArray(record.contact_candidates) ? record.contact_candidates : []
    const contact_candidates = asContactCandidates(record.contact_candidates)

    if (rawCandidates.length > 0 && contact_candidates.length === 0) {
      return {
        ok: false,
        message:
          "Contact research candidates were present but failed evidence validation (missing source_evidence, unsupported email/phone, or zero confidence).",
      }
    }

    for (const candidate of contact_candidates) {
      if (candidate.email && GUESSED_EMAIL_PATTERN.test(candidate.email)) {
        const hasEmailInEvidence = candidate.source_evidence.some((row) =>
          row.evidence.toLowerCase().includes(candidate.email.toLowerCase()),
        )
        if (!hasEmailInEvidence) {
          return {
            ok: false,
            message: `Contact "${candidate.full_name}" email is not supported by source_evidence.`,
          }
        }
      }
    }

    const output: GrowthLeadEngineContactResearchOutput = {
      contact_candidates,
      coverage: {
        primary_roles_found: asStringArray(coverageGroup.primary_roles_found),
        missing_roles: asStringArray(coverageGroup.missing_roles),
        committee_completion: asScore(coverageGroup.committee_completion),
      },
      research_quality: {
        score: asScore(qualityGroup.score),
        reasoning: asStringArray(qualityGroup.reasoning),
      },
    }

    return { ok: true, output }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse contact research JSON.",
    }
  }
}

export function assertGrowthLeadEngineContactResearchOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_OUTPUT_JSON_KEYS
}
