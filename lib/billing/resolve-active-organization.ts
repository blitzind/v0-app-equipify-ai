import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/** Matches client-side demo ordering in active-organization-context (without localStorage). */
const DEMO_WORKSPACE_SLUG_ORDER = ["acme", "zephyr", "medology", "precision-biomedical-demo"]

export type ResolvedActiveOrganization = {
  organizationId: string
  name: string
  slug: string
}

function sortOrganizationsDemoFirst(orgs: ResolvedActiveOrganization[]): ResolvedActiveOrganization[] {
  return [...orgs].sort((a, b) => {
    const sa = a.slug.trim().toLowerCase()
    const sb = b.slug.trim().toLowerCase()
    const ia = DEMO_WORKSPACE_SLUG_ORDER.indexOf(sa)
    const ib = DEMO_WORKSPACE_SLUG_ORDER.indexOf(sb)
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1
      if (ib === -1) return -1
      if (ia !== ib) return ia - ib
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

/**
 * Resolves the active organization for billing server actions using the same rules as the client
 * except localStorage: profile.default_organization_id when still a member, otherwise first member org.
 */
export async function resolveActiveOrganizationForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedActiveOrganization | { error: string }> {
  const { data: memberRows, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name, slug)")
    .eq("user_id", userId)
    .eq("status", "active")

  if (memberError) {
    return { error: memberError.message }
  }

  const raw = (memberRows ?? []) as Array<{
    organization_id: string
    organizations:
      | { id: string; name: string; slug: string }
      | { id: string; name: string; slug: string }[]
      | null
  }>

  const orgs: ResolvedActiveOrganization[] = []
  for (const row of raw) {
    const o = row.organizations
    const org = Array.isArray(o) ? o[0] : o
    if (org?.id && org.name) {
      orgs.push({
        organizationId: org.id,
        name: org.name,
        slug: String(org.slug ?? ""),
      })
    }
  }

  if (orgs.length === 0) {
    return { error: "No active organization. Join or create a workspace first." }
  }

  const sorted = sortOrganizationsDemoFirst(orgs)
  const memberIds = new Set(sorted.map((o) => o.organizationId))

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_organization_id")
    .eq("id", userId)
    .maybeSingle()

  const def = profile?.default_organization_id as string | undefined | null
  const chosen =
    def && memberIds.has(def)
      ? sorted.find((o) => o.organizationId === def)!
      : sorted[0]!

  return chosen
}
