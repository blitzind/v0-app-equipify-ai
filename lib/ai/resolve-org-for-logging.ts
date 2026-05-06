import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Picks a single org for AI usage logging when the request has no `organizationId` in the URL
 * (e.g. global certificate import). Deterministic: first active membership by `organization_id`.
 * TODO(ai-router-migration): pass explicit `organizationId` from client when product flow allows.
 */
export async function resolveFirstOrganizationIdForUser(userId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("organization_id", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.organization_id) return null
  const id = data.organization_id as string
  return UUID_RE.test(id) ? id : null
}
