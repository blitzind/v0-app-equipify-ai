/** Client-safe canonical profile promotion rules (Phase 7.5A). */

export type CanonicalProfileSnapshot = {
  owner_id: string
  normalized_profile_key: string
  confidence: number
  verification_status: string
  metadata: Record<string, unknown>
}

export function evaluateCanonicalProfilePromotion(input: {
  existing: CanonicalProfileSnapshot | null
  target_owner_id: string
  incoming_confidence: number
  incoming_verification_status: string
}): { allowed: boolean; reason: string; merge_metadata: Record<string, unknown> } {
  const { existing, target_owner_id, incoming_confidence, incoming_verification_status } = input

  if (!existing) {
    return { allowed: true, reason: "No existing canonical profile row.", merge_metadata: {} }
  }

  if (existing.owner_id !== target_owner_id) {
    return {
      allowed: false,
      reason: `normalized_profile_key is already owned by ${existing.owner_id}.`,
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
      reason: "Existing verified profile retained; incoming candidate is not verified.",
      merge_metadata: existing.metadata,
    }
  }

  if (existingVerified && incomingVerified && existing.confidence > incoming_confidence) {
    return {
      allowed: false,
      reason: "Existing verified profile has higher confidence than incoming candidate.",
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
    reason: "Promotion updates profile for same owner.",
    merge_metadata: {
      ...existing.metadata,
      promotion_history: history.slice(-20),
    },
  }
}
