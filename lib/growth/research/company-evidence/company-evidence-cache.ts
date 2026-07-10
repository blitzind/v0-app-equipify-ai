/** GE-AIOS-22 — Company evidence cache policy (client-safe). */

import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"

export const COMPANY_EVIDENCE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function shouldRefreshCompanyEvidence(input: {
  existing: GrowthCompanyEvidenceBundle | null | undefined
  website: string | null
  rebuild?: boolean
  missionChanged?: boolean
  operatorRefresh?: boolean
  now?: number
}): boolean {
  if (input.rebuild || input.operatorRefresh) return true
  if (input.missionChanged) return true
  if (!input.existing) return true

  const normalizedWebsite = (input.website ?? "").trim().toLowerCase()
  const existingWebsite = (input.existing.websiteUrl ?? "").trim().toLowerCase()
  if (normalizedWebsite && existingWebsite && normalizedWebsite !== existingWebsite) return true

  const collectedAt = Date.parse(input.existing.collectedAt)
  if (!Number.isFinite(collectedAt)) return true

  const now = input.now ?? Date.now()
  if (now - collectedAt > COMPANY_EVIDENCE_CACHE_TTL_MS) return true

  if ((input.existing.qualityScores.overallEvidenceConfidence ?? 0) < 0.45) return true

  return false
}
