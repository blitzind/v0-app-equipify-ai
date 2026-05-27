import type { PersonalizationEvidenceCandidate } from "@/lib/growth/personalization/personalization-evidence-engine"
import {
  detectPersonalizationRisks,
  shouldBlockPersonalization,
  type PersonalizationRiskFinding,
} from "@/lib/growth/personalization/personalization-risk-engine"

export type PersonalizationValidationResult = {
  ok: boolean
  blocked: boolean
  blockedReason: string
  riskFindings: PersonalizationRiskFinding[]
  personalizationScore: number
}

function scorePersonalization(input: {
  evidence: PersonalizationEvidenceCandidate[]
  body: string
  riskCount: number
}): number {
  let score = Math.min(60, input.evidence.length * 8)
  const sourceCount = new Set(input.evidence.map((entry) => entry.sourceType)).size
  score += Math.min(25, sourceCount * 5)
  if (input.body.length >= 120) score += 10
  score -= Math.min(30, input.riskCount * 8)
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function validatePersonalizationGeneration(input: {
  subject: string
  body: string
  companyName: string
  evidence: PersonalizationEvidenceCandidate[]
}): PersonalizationValidationResult {
  const riskFindings = detectPersonalizationRisks(input)
  const blocked = shouldBlockPersonalization(riskFindings)
  const blockedReason = blocked
    ? riskFindings.find((finding) => finding.severity === "critical")?.description ?? "Unsupported personalization blocked."
    : ""

  return {
    ok: !blocked,
    blocked,
    blockedReason,
    riskFindings,
    personalizationScore: scorePersonalization({
      evidence: input.evidence,
      body: input.body,
      riskCount: riskFindings.length,
    }),
  }
}

export function assertPersonalizationCanBeApproved(input: {
  status: string
  blockedReason?: string | null
}): void {
  if (input.status === "blocked") {
    throw new Error(input.blockedReason ?? "personalization_blocked")
  }
  if (input.status !== "draft") {
    throw new Error("invalid_status_for_approval")
  }
}

export function assertPersonalizationCanBeSent(input: { status: string }): void {
  if (input.status !== "approved") throw new Error("personalization_not_approved")
}
