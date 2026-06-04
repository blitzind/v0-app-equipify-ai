import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateCanonicalProfilePromotion,
  type CanonicalProfileSnapshot,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-integrity-rules"

export type CanonicalPersonProfileRow = CanonicalProfileSnapshot

export { evaluateCanonicalProfilePromotion }

export async function fetchCanonicalPersonProfileByNormalizedKey(
  admin: SupabaseClient,
  normalized_profile_key: string,
): Promise<CanonicalPersonProfileRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("person_profiles")
    .select("person_id, normalized_profile_key, confidence, verification_status, metadata")
    .eq("normalized_profile_key", normalized_profile_key)
    .maybeSingle()

  if (error) throw new Error(`fetchCanonicalPersonProfileByNormalizedKey: ${error.message}`)
  if (!data || typeof data.person_id !== "string") return null

  return {
    owner_id: data.person_id,
    normalized_profile_key:
      typeof data.normalized_profile_key === "string" ? data.normalized_profile_key : normalized_profile_key,
    confidence: typeof data.confidence === "number" ? data.confidence : Number(data.confidence) || 0,
    verification_status:
      typeof data.verification_status === "string" ? data.verification_status : "unverified",
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
  }
}

export async function personHasVerifiedSocialProfile(
  admin: SupabaseClient,
  person_id: string,
  profile_type?: string,
): Promise<boolean> {
  let query = admin
    .schema("growth")
    .from("person_profiles")
    .select("id")
    .eq("person_id", person_id)
    .in("verification_status", ["verified", "operator_verified"])

  if (profile_type) {
    query = query.in("profile_type", [profile_type, profile_type === "linkedin_person" ? "linkedin" : profile_type])
  }

  const { data } = await query.limit(1).maybeSingle()
  return Boolean(data?.id)
}
