import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

export async function fetchOrganizationIndustryKey(
  admin: SupabaseClient,
  organizationId: string,
): Promise<WorkspaceIndustryKey | null> {
  const oid = organizationId.trim()
  if (!oid) return null
  try {
    const { data } = await admin.from("organizations").select("industry").eq("id", oid).maybeSingle()
    const raw = (data as { industry?: string | null } | null)?.industry
    if (!raw?.trim()) return null
    try {
      return normalizeIndustryKey(raw)
    } catch {
      return null
    }
  } catch {
    return null
  }
}
