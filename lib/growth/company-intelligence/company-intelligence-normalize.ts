/** Deterministic intelligence key + value normalization. Client-safe. */

import type { GrowthCompanyIntelligenceCategory } from "@/lib/growth/company-intelligence/company-intelligence-types"

function trimOrNull(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

export function normalizeIntelligenceKeyPart(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
}

export function buildNormalizedIntelligenceKey(input: {
  intelligence_category: GrowthCompanyIntelligenceCategory
  intelligence_key: string
}): string {
  const category = normalizeIntelligenceKeyPart(input.intelligence_category)
  const key = normalizeIntelligenceKeyPart(input.intelligence_key)
  return `${category}:${key}`
}

export function normalizeIntelligenceValueText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return trimOrNull(value)
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return null
}

export function normalizeTechnologyIntelligenceKey(technologyName: string): string {
  return `tech_${normalizeIntelligenceKeyPart(technologyName)}`
}

export function normalizeWebsiteSignalKey(signalKey: string): string {
  return `signal_${normalizeIntelligenceKeyPart(signalKey)}`
}

export function normalizeSocialPresenceKey(profileType: string): string {
  return `social_${normalizeIntelligenceKeyPart(profileType)}`
}
