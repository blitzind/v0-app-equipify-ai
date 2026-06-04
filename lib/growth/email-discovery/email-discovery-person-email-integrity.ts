import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateCanonicalPersonEmailPromotion,
  type CanonicalPersonEmailSnapshot,
} from "@/lib/growth/email-discovery/email-discovery-integrity-rules"

export type CanonicalPersonEmailRow = CanonicalPersonEmailSnapshot

export { evaluateCanonicalPersonEmailPromotion }

export async function fetchCanonicalPersonEmailByNormalized(
  admin: SupabaseClient,
  normalized_email: string,
): Promise<CanonicalPersonEmailRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("person_emails")
    .select("person_id, normalized_email, confidence, verification_status, metadata")
    .eq("normalized_email", normalized_email)
    .maybeSingle()

  if (error) throw new Error(`fetchCanonicalPersonEmailByNormalized: ${error.message}`)
  if (!data || typeof data.person_id !== "string") return null

  return {
    person_id: data.person_id,
    normalized_email: typeof data.normalized_email === "string" ? data.normalized_email : normalized_email,
    confidence: typeof data.confidence === "number" ? data.confidence : Number(data.confidence) || 0,
    verification_status:
      typeof data.verification_status === "string" ? data.verification_status : "unverified",
    metadata:
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {},
  }
}

export async function clearPrimaryFlagsForPersonExcept(
  admin: SupabaseClient,
  person_id: string,
  normalized_email: string,
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("person_emails")
    .update({ is_primary: false })
    .eq("person_id", person_id)
    .neq("normalized_email", normalized_email)

  if (error) throw new Error(`clearPrimaryFlagsForPersonExcept: ${error.message}`)
}
