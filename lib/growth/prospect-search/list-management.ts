import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthProspectSearchSchemaReady } from "@/lib/growth/prospect-search/prospect-search-schema-health"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchListMemberRow,
  GrowthProspectSearchListRow,
  GrowthProspectSearchPersonResult,
  GrowthProspectSearchSourceType,
} from "@/lib/growth/prospect-search/prospect-search-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function listProspectSearchLists(
  admin: SupabaseClient,
): Promise<GrowthProspectSearchListRow[]> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return []

  const { data: lists, error } = await admin
    .schema("growth")
    .from("prospect_search_lists")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50)
  if (error || !lists?.length) return []

  const ids = lists.map((l) => (l as { id: string }).id)
  const { data: counts } = await admin
    .schema("growth")
    .from("prospect_search_list_members")
    .select("list_id")
    .in("list_id", ids)

  const countByList = new Map<string, number>()
  for (const row of counts ?? []) {
    const listId = (row as { list_id: string }).list_id
    countByList.set(listId, (countByList.get(listId) ?? 0) + 1)
  }

  return lists.map((row) => {
    const r = row as Record<string, unknown>
    const id = asString(r.id)
    return {
      id,
      created_at: asString(r.created_at),
      updated_at: asString(r.updated_at),
      created_by: asString(r.created_by) || null,
      name: asString(r.name),
      description: asString(r.description),
      member_count: countByList.get(id) ?? 0,
      metadata:
        r.metadata && typeof r.metadata === "object"
          ? (r.metadata as Record<string, unknown>)
          : {},
    }
  })
}

export async function createProspectSearchList(
  admin: SupabaseClient,
  input: { created_by?: string | null; name: string; description?: string },
): Promise<GrowthProspectSearchListRow | null> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return null
  const { data, error } = await admin
    .schema("growth")
    .from("prospect_search_lists")
    .insert({
      created_by: input.created_by ?? null,
      name: input.name.trim().slice(0, 120),
      description: (input.description ?? "").trim().slice(0, 500),
      metadata: {},
    })
    .select("*")
    .single()
  if (error || !data) return null
  const r = data as Record<string, unknown>
  return {
    id: asString(r.id),
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
    created_by: asString(r.created_by) || null,
    name: asString(r.name),
    description: asString(r.description),
    member_count: 0,
    metadata: {},
  }
}

export async function addProspectSearchListMembers(
  admin: SupabaseClient,
  listId: string,
  members: Array<{
    source_type: GrowthProspectSearchSourceType | "person"
    source_id: string
    company_name: string
    snapshot: Record<string, unknown>
  }>,
): Promise<number> {
  if (!(await isGrowthProspectSearchSchemaReady(admin)) || members.length === 0) return 0
  const rows = members.map((m) => ({
    list_id: listId,
    source_type: m.source_type,
    source_id: m.source_id,
    company_name: m.company_name,
    snapshot: m.snapshot,
  }))
  const { data, error } = await admin
    .schema("growth")
    .from("prospect_search_list_members")
    .upsert(rows, { onConflict: "list_id,source_type,source_id", ignoreDuplicates: true })
    .select("id")
  if (error) return 0
  return data?.length ?? 0
}

export function companyResultToListMember(
  row: GrowthProspectSearchCompanyResult,
): {
  source_type: GrowthProspectSearchSourceType
  source_id: string
  company_name: string
  snapshot: Record<string, unknown>
} {
  return {
    source_type: row.source_type,
    source_id: row.id,
    company_name: row.company_name,
    snapshot: { ...row },
  }
}

export function personResultToListMember(row: GrowthProspectSearchPersonResult): {
  source_type: "person"
  source_id: string
  company_name: string
  snapshot: Record<string, unknown>
} {
  return {
    source_type: "person",
    source_id: row.id,
    company_name: row.company_name,
    snapshot: { ...row },
  }
}

export async function listProspectSearchListMembers(
  admin: SupabaseClient,
  listId: string,
): Promise<GrowthProspectSearchListMemberRow[]> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return []
  const { data, error } = await admin
    .schema("growth")
    .from("prospect_search_list_members")
    .select("*")
    .eq("list_id", listId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) return []
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: asString(r.id),
      created_at: asString(r.created_at),
      list_id: asString(r.list_id),
      source_type: asString(r.source_type) as GrowthProspectSearchListMemberRow["source_type"],
      source_id: asString(r.source_id),
      company_name: asString(r.company_name),
      snapshot:
        r.snapshot && typeof r.snapshot === "object"
          ? (r.snapshot as Record<string, unknown>)
          : {},
    }
  })
}
