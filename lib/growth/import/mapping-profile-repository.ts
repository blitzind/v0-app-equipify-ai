import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthImportColumnMapping, GrowthImportMappingProfile } from "@/lib/growth/import/types"

type ProfileDbRow = {
  id: string
  name: string
  source_vendor: string
  column_mapping: Record<string, string>
  created_by: string | null
  created_at: string
  updated_at: string
}

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_import_mapping_profiles")
}

function mapProfile(row: ProfileDbRow): GrowthImportMappingProfile {
  return {
    id: row.id,
    name: row.name,
    sourceVendor: row.source_vendor,
    columnMapping: row.column_mapping ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listGrowthImportMappingProfiles(
  admin: SupabaseClient,
  sourceVendor?: string,
): Promise<GrowthImportMappingProfile[]> {
  let query = profilesTable(admin)
    .select("id, name, source_vendor, column_mapping, created_by, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100)
  if (sourceVendor) query = query.eq("source_vendor", sourceVendor)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as ProfileDbRow[]).map(mapProfile)
}

export async function createGrowthImportMappingProfile(
  admin: SupabaseClient,
  input: {
    name: string
    sourceVendor: string
    columnMapping: GrowthImportColumnMapping
    createdBy?: string | null
  },
): Promise<GrowthImportMappingProfile> {
  const { data, error } = await profilesTable(admin)
    .insert({
      name: input.name.trim(),
      source_vendor: input.sourceVendor,
      column_mapping: input.columnMapping,
      created_by: input.createdBy ?? null,
    })
    .select("id, name, source_vendor, column_mapping, created_by, created_at, updated_at")
    .single()
  if (error) throw new Error(error.message)
  return mapProfile(data as ProfileDbRow)
}
