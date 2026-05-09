import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProspectListItem, ProspectRow } from "@/lib/prospects/types"

/** Resolve friendly labels for auth user ids (org peers via profiles RLS). */
export async function profileLabelsByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return map
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids)
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
    const label =
      (row.full_name && row.full_name.trim()) || (row.email && row.email.trim()) || "Team"
    map.set(row.id, label)
  }
  return map
}

/**
 * Adds converted customer names + ownership labels for prospects list/detail API payloads.
 */
export async function enrichProspectRows(
  supabase: SupabaseClient,
  organizationId: string,
  rows: ProspectRow[],
): Promise<ProspectListItem[]> {
  const customerIds = Array.from(
    new Set(rows.map((r) => r.converted_customer_id).filter((id): id is string => Boolean(id))),
  )
  const customerNameMap = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: cRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", customerIds)
    for (const c of (cRows ?? []) as Array<{ id: string; company_name: string }>) {
      customerNameMap.set(c.id, c.company_name)
    }
  }

  const profileIds: string[] = []
  for (const r of rows) {
    if (r.assigned_to_user_id) profileIds.push(r.assigned_to_user_id)
    if (r.last_contacted_by_user_id) profileIds.push(r.last_contacted_by_user_id)
    if (r.next_action_owner_user_id) profileIds.push(r.next_action_owner_user_id)
  }
  const labelMap = await profileLabelsByUserIds(supabase, profileIds)

  return rows.map((r) => ({
    ...r,
    converted_customer_name: r.converted_customer_id
      ? customerNameMap.get(r.converted_customer_id) ?? null
      : null,
    assigned_to_label: r.assigned_to_user_id ? labelMap.get(r.assigned_to_user_id) ?? null : null,
    last_contacted_by_label: r.last_contacted_by_user_id
      ? labelMap.get(r.last_contacted_by_user_id) ?? null
      : null,
    next_action_owner_label: r.next_action_owner_user_id
      ? labelMap.get(r.next_action_owner_user_id) ?? null
      : null,
  }))
}
