import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/** Prefer automation owner; fallback org owner/admin/manager for service inserts. */
export async function resolveWorkflowActorUserId(
  supabase: SupabaseClient,
  organizationId: string,
  preferredUserId: string | null,
): Promise<string | null> {
  if (preferredUserId) return preferredUserId
  const roles = ["owner", "admin", "manager"] as const
  for (const role of roles) {
    const { data } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .eq("role", role)
      .limit(1)
      .maybeSingle()
    const uid = (data as { user_id?: string } | null)?.user_id
    if (uid) return uid
  }
  return null
}
