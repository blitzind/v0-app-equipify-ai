/** Snapshot promotion integrity — no cross-company reassignment. Client-safe. */

export function evaluateCompanyIntelligenceSnapshotPromotion(input: {
  existing: { company_id: string; confidence: number; verification_status: string } | null
  target_company_id: string
  incoming_confidence: number
  incoming_verification_status: string
}): { allowed: boolean; reason: string } {
  if (input.incoming_verification_status !== "verified") {
    return { allowed: false, reason: "Only verified findings may promote to snapshots." }
  }
  if (input.incoming_confidence < 0.85) {
    return { allowed: false, reason: "Confidence below promotion threshold (0.85)." }
  }
  if (!input.existing) {
    return { allowed: true, reason: "No existing snapshot for this intelligence key." }
  }
  if (input.existing.company_id !== input.target_company_id) {
    return { allowed: false, reason: "Snapshot belongs to a different canonical company." }
  }
  if (
    input.existing.verification_status === "verified" &&
    input.existing.confidence > input.incoming_confidence + 0.02
  ) {
    return {
      allowed: false,
      reason: "Existing verified snapshot has higher confidence; not overwritten.",
    }
  }
  return { allowed: true, reason: "Incoming verified finding meets promotion rules." }
}
