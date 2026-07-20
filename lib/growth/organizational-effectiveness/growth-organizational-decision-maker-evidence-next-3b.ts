/** GE-AIOS-NEXT-3B — Decision-maker readiness evidence (client-safe). */

import type {
  GrowthDecisionMakerReadinessFinding,
  GrowthEvidenceCompletenessClassification,
} from "./growth-organizational-evidence-completeness-next-3b-types"

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1]! + sorted[mid]!) / 2
  return sorted[mid] ?? null
}

export function buildDecisionMakerReadinessFinding(input: {
  waitingForDm: number
  waitingForContactVerification: number
  verifiedWithDecisionMakerId: number
  contactVerificationFailed: number
  draftFactoryActive: number
  progressionHoursSamples: number[]
  blockingReasons: Array<{ reason: string; count: number }>
}): GrowthDecisionMakerReadinessFinding {
  const unresolved = input.waitingForDm + input.waitingForContactVerification
  const verifiedTotal = input.verifiedWithDecisionMakerId
  const denominator = input.draftFactoryActive > 0 ? input.draftFactoryActive : verifiedTotal + unresolved

  const verificationRatePct =
    denominator > 0
      ? Math.round(((denominator - unresolved) / denominator) * 1000) / 10
      : null

  const averageProgressionHours =
    input.progressionHoursSamples.length > 0
      ? Math.round((median(input.progressionHoursSamples) ?? 0) * 10) / 10
      : null

  const sortedBlocking = [...input.blockingReasons].sort((a, b) => b.count - a.count)

  let completeness: GrowthEvidenceCompletenessClassification = "partially_available"
  if (denominator === 0) completeness = "insufficient_evidence"
  else if (verifiedTotal > 0 && sortedBlocking.length > 0) completeness = "available"

  return {
    completeness,
    waitingForDecisionMaker: input.waitingForDm,
    waitingForContactVerification: input.waitingForContactVerification,
    verifiedWithDecisionMakerId: verifiedTotal,
    contactVerificationFailed: input.contactVerificationFailed,
    verificationRatePct,
    averageProgressionHours,
    blockingReasons: sortedBlocking.slice(0, 5),
    completenessNote:
      sortedBlocking.length === 0
        ? "Blocking reasons not yet normalized from draft-factory error codes."
        : null,
  }
}
