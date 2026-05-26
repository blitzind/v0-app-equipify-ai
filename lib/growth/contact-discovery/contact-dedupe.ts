import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { NormalizedContactCandidate } from "@/lib/growth/contact-discovery/contact-normalizer"

export async function findExistingContactDedupeHashes(
  admin: SupabaseClient,
  company_candidate_id: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set()
  try {
    const { data } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("dedupe_hash")
      .eq("company_candidate_id", company_candidate_id)
      .in("dedupe_hash", hashes.slice(0, 100))
    const found = new Set<string>()
    for (const row of data ?? []) {
      const h = (row as { dedupe_hash: string }).dedupe_hash
      if (h) found.add(h)
    }
    return found
  } catch {
    return new Set()
  }
}

export function filterNewContacts(
  rows: NormalizedContactCandidate[],
  existing: Set<string>,
): NormalizedContactCandidate[] {
  return rows.filter((r) => !existing.has(r.dedupe_hash))
}
