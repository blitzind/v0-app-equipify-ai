import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateCanonicalProfilePromotion,
  type CanonicalProfileSnapshot,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-integrity-rules"

export type CanonicalCompanyProfileRow = CanonicalProfileSnapshot

export { evaluateCanonicalProfilePromotion }

export async function fetchCanonicalCompanyProfileByNormalizedKey(
  admin: SupabaseClient,
  normalized_profile_key: string,
): Promise<CanonicalCompanyProfileRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_profiles")
    .select("company_id, normalized_profile_key, confidence, verification_status, metadata")
    .eq("normalized_profile_key", normalized_profile_key)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01") return null
    throw new Error(`fetchCanonicalCompanyProfileByNormalizedKey: ${error.message}`)
  }
  if (!data || typeof data.company_id !== "string") return null

  return {
    owner_id: data.company_id,
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

export async function companyHasVerifiedSocialProfile(
  admin: SupabaseClient,
  company_id: string,
  profile_type?: string,
): Promise<boolean> {
  let query = admin
    .schema("growth")
    .from("company_profiles")
    .select("id")
    .eq("company_id", company_id)
    .in("verification_status", ["verified", "operator_verified"])

  if (profile_type) query = query.eq("profile_type", profile_type)

  const { data, error } = await query.limit(1).maybeSingle()
  if (error?.code === "42P01") return false
  return Boolean(data?.id)
}
