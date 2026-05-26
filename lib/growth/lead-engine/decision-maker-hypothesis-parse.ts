import {
  GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS,
  type GrowthLeadEngineDecisionMakerAvoidRole,
  type GrowthLeadEngineDecisionMakerHypothesisOutput,
  type GrowthLeadEngineDecisionMakerRoleHypothesis,
  type GrowthLeadEngineDecisionMakerRolePatterns,
} from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"

const EMAIL_LIKE = /@/
const PHONE_LIKE = /(?:\+?\d[\d\s().-]{7,}\d)/

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

function asCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

function looksLikePersonIdentifier(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (EMAIL_LIKE.test(trimmed)) return true
  if (PHONE_LIKE.test(trimmed)) return true
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/\b(linkedin|facebook|twitter|instagram)\b/i.test(trimmed)) return true
  return false
}

function asRoleHypothesis(value: unknown): GrowthLeadEngineDecisionMakerRoleHypothesis | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const role = asString(row.role)
  if (!role || looksLikePersonIdentifier(role)) return null
  const reason = asString(row.reason)
  if (looksLikePersonIdentifier(reason)) return null
  return {
    role,
    confidence: asConfidence(row.confidence),
    reason,
  }
}

function asRoleHypothesisList(value: unknown): GrowthLeadEngineDecisionMakerRoleHypothesis[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRoleHypothesis(entry))
    .filter((entry): entry is GrowthLeadEngineDecisionMakerRoleHypothesis => entry !== null)
}

function asAvoidRole(value: unknown): GrowthLeadEngineDecisionMakerAvoidRole | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const role = asString(row.role)
  if (!role || looksLikePersonIdentifier(role)) return null
  const reason = asString(row.reason)
  if (looksLikePersonIdentifier(reason)) return null
  return { role, reason }
}

function asAvoidRoleList(value: unknown): GrowthLeadEngineDecisionMakerAvoidRole[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asAvoidRole(entry))
    .filter((entry): entry is GrowthLeadEngineDecisionMakerAvoidRole => entry !== null)
}

function asRolePatterns(value: unknown): GrowthLeadEngineDecisionMakerRolePatterns {
  const group = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const patterns = {} as GrowthLeadEngineDecisionMakerRolePatterns
  for (const key of GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS) {
    patterns[key] = asStringArray(group[key]).filter((entry) => !looksLikePersonIdentifier(entry))
  }
  return patterns
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

export function parseGrowthLeadEngineDecisionMakerHypothesisOutput(
  raw: string,
): { ok: true; output: GrowthLeadEngineDecisionMakerHypothesisOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Decision maker hypothesis response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>

    const strategyGroup =
      record.recommended_targeting_strategy && typeof record.recommended_targeting_strategy === "object"
        ? (record.recommended_targeting_strategy as Record<string, unknown>)
        : {}

    const committeeGroup =
      record.buying_committee && typeof record.buying_committee === "object"
        ? (record.buying_committee as Record<string, unknown>)
        : {}

    const completenessGroup =
      record.committee_completeness && typeof record.committee_completeness === "object"
        ? (record.committee_completeness as Record<string, unknown>)
        : {}

    const confidenceGroup =
      record.confidence_assessment && typeof record.confidence_assessment === "object"
        ? (record.confidence_assessment as Record<string, unknown>)
        : {}

    const output: GrowthLeadEngineDecisionMakerHypothesisOutput = {
      recommended_targeting_strategy: {
        primary_motion: asString(strategyGroup.primary_motion),
        reason: asString(strategyGroup.reason),
      },
      buying_committee: {
        primary_targets: asRoleHypothesisList(committeeGroup.primary_targets),
        secondary_targets: asRoleHypothesisList(committeeGroup.secondary_targets),
        avoid_roles: asAvoidRoleList(committeeGroup.avoid_roles),
      },
      role_patterns: asRolePatterns(record.role_patterns),
      committee_completeness: {
        recommended_contacts: asCount(completenessGroup.recommended_contacts),
        minimum_contacts: asCount(completenessGroup.minimum_contacts),
        critical_missing_roles: asStringArray(completenessGroup.critical_missing_roles),
      },
      escalation_path: asStringArray(record.escalation_path),
      engagement_priority: asStringArray(record.engagement_priority),
      confidence_assessment: {
        score: asScore(confidenceGroup.score),
        reasoning: asStringArray(confidenceGroup.reasoning),
      },
    }

    if (!output.recommended_targeting_strategy.primary_motion) {
      return {
        ok: false,
        message: "Decision maker hypothesis response missing recommended_targeting_strategy.primary_motion.",
      }
    }
    if (output.buying_committee.primary_targets.length === 0) {
      return {
        ok: false,
        message: "Decision maker hypothesis response must include at least one buying_committee.primary_targets role.",
      }
    }
    if (output.escalation_path.length === 0) {
      return {
        ok: false,
        message: "Decision maker hypothesis response must include at least one escalation_path step.",
      }
    }
    if (output.engagement_priority.length === 0) {
      return {
        ok: false,
        message: "Decision maker hypothesis response must include at least one engagement_priority entry.",
      }
    }
    if (
      output.committee_completeness.recommended_contacts > 0 &&
      output.committee_completeness.minimum_contacts > 0 &&
      output.committee_completeness.recommended_contacts < output.committee_completeness.minimum_contacts
    ) {
      return {
        ok: false,
        message: "committee_completeness.recommended_contacts must be >= minimum_contacts.",
      }
    }

    return { ok: true, output }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not parse decision maker hypothesis JSON.",
    }
  }
}

export function assertGrowthLeadEngineDecisionMakerHypothesisOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_OUTPUT_JSON_KEYS
}
