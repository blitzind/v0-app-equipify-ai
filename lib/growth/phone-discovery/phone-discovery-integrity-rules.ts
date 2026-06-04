/** Client-safe canonical person phone promotion rules (Phase 7.4A). */

export type CanonicalPersonPhoneSnapshot = {
  person_id: string
  normalized_phone: string
  confidence: number
  verification_status: string
  metadata: Record<string, unknown>
}

export function evaluateCanonicalPersonPhonePromotion(input: {
  existing: CanonicalPersonPhoneSnapshot | null
  target_person_id: string
  incoming_confidence: number
  incoming_verification_status: string
}): { allowed: boolean; reason: string; merge_metadata: Record<string, unknown> } {
  const { existing, target_person_id, incoming_confidence, incoming_verification_status } = input

  if (!existing) {
    return { allowed: true, reason: "No existing canonical phone row.", merge_metadata: {} }
  }

  if (existing.person_id !== target_person_id) {
    return {
      allowed: false,
      reason: `normalized_phone is already owned by person ${existing.person_id}.`,
      merge_metadata: {},
    }
  }

  const existingVerified =
    existing.verification_status === "verified" ||
    existing.verification_status === "operator_verified"
  const incomingVerified = incoming_verification_status === "verified"

  if (existingVerified && !incomingVerified) {
    return {
      allowed: false,
      reason: "Existing verified phone retained; incoming candidate is not verified.",
      merge_metadata: existing.metadata,
    }
  }

  if (existingVerified && incomingVerified && existing.confidence > incoming_confidence) {
    return {
      allowed: false,
      reason: "Existing verified phone has higher confidence than incoming candidate.",
      merge_metadata: existing.metadata,
    }
  }

  const history = Array.isArray(existing.metadata.promotion_history)
    ? [...(existing.metadata.promotion_history as unknown[])]
    : []
  history.push({
    at: new Date().toISOString(),
    confidence: incoming_confidence,
    verification_status: incoming_verification_status,
  })

  return {
    allowed: true,
    reason: "Promotion updates phone for same person.",
    merge_metadata: {
      ...existing.metadata,
      promotion_history: history.slice(-20),
    },
  }
}
