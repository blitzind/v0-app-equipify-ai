import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateCanonicalPersonPhonePromotion,
  type CanonicalPersonPhoneSnapshot,
} from "@/lib/growth/phone-discovery/phone-discovery-integrity-rules"

export type CanonicalPersonPhoneRow = CanonicalPersonPhoneSnapshot

export { evaluateCanonicalPersonPhonePromotion }

export async function fetchCanonicalPersonPhoneByNormalized(
  admin: SupabaseClient,
  normalized_phone: string,
): Promise<CanonicalPersonPhoneRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("person_phones")
    .select("person_id, normalized_phone, confidence, verification_status, metadata")
    .eq("normalized_phone", normalized_phone)
    .maybeSingle()

  if (error) throw new Error(`fetchCanonicalPersonPhoneByNormalized: ${error.message}`)
  if (!data || typeof data.person_id !== "string") return null

  return {
    person_id: data.person_id,
    normalized_phone: typeof data.normalized_phone === "string" ? data.normalized_phone : normalized_phone,
    confidence: typeof data.confidence === "number" ? data.confidence : Number(data.confidence) || 0,
    verification_status:
      typeof data.verification_status === "string" ? data.verification_status : "unverified",
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
  }
}

export async function personHasVerifiedPhone(
  admin: SupabaseClient,
  personId: string,
): Promise<boolean> {
  const { data } = await admin
    .schema("growth")
    .from("person_phones")
    .select("id")
    .eq("person_id", personId)
    .in("verification_status", ["verified", "operator_verified"])
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

export async function clearPrimaryPhoneFlagsForPersonExcept(
  admin: SupabaseClient,
  person_id: string,
  normalized_phone: string,
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("person_phones")
    .update({ is_primary: false })
    .eq("person_id", person_id)
    .neq("normalized_phone", normalized_phone)

  if (error) throw new Error(`clearPrimaryPhoneFlagsForPersonExcept: ${error.message}`)
}
