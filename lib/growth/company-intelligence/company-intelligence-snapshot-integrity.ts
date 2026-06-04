import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** At least one verified intelligence snapshot exists for this canonical company. */
export async function companyHasVerifiedIntelligenceSnapshots(
  admin: SupabaseClient,
  company_id: string,
): Promise<boolean> {
  const id = asString(company_id)
  if (!id) return false

  const { count, error } = await admin
    .schema("growth")
    .from("company_intelligence_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("company_id", id)
    .eq("verification_status", "verified")

  if (error) return false
  return (count ?? 0) > 0
}
