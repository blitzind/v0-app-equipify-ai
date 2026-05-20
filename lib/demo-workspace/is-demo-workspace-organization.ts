import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isDemoWorkspaceSlug } from "@/lib/demo-workspace/demo-workspace-slugs"

/** True when the organization is a built-in dev/demo workspace (mutations blocked for AI scan). */
export async function isDemoWorkspaceOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) return false
  return isDemoWorkspaceSlug((data as { slug?: string | null } | null)?.slug)
}
