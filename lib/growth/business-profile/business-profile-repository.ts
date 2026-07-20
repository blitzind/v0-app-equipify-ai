import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BUSINESS_PROFILE_APPROVED_LABEL,
  BUSINESS_PROFILE_DRAFT_LABEL,
  GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER,
  type BusinessProfileDraftContent,
  type BusinessProfileInput,
  type BusinessProfileRecord,
  type BusinessProfileStatus,
} from "@/lib/growth/business-profile/business-profile-types"

const PROFILE_SELECT =
  "id, organization_id, status, company_name, website, profile_json, draft_input_json, created_by, approved_by, approved_at, rejected_at, created_at, updated_at"

type ProfileRow = {
  id: string
  organization_id: string
  status: BusinessProfileStatus
  company_name: string
  website: string
  profile_json: BusinessProfileDraftContent
  draft_input_json: BusinessProfileInput
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_at: string | null
  created_at: string
  updated_at: string
}

function profilesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("organization_business_profiles")
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "42P01" || /organization_business_profiles/i.test(error.message ?? "")
}

function mapRow(row: ProfileRow): BusinessProfileRecord {
  const isActive = row.status === "approved"
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status,
    isActive,
    companyName: row.company_name,
    website: row.website,
    input: row.draft_input_json ?? ({} as BusinessProfileInput),
    profile: row.profile_json ?? ({} as BusinessProfileDraftContent),
    label: isActive ? BUSINESS_PROFILE_APPROVED_LABEL : BUSINESS_PROFILE_DRAFT_LABEL,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function isBusinessProfileSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await profilesTable(admin).select("id").limit(1)
  return !error
}

export async function getActiveApprovedBusinessProfile(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BusinessProfileRecord | null> {
  const { data, error } = await profilesTable(admin)
    .select(PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapRow(data as ProfileRow)
}

export async function listOrganizationIdsWithApprovedBusinessProfiles(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<string[]> {
  const { data, error } = await profilesTable(admin)
    .select("organization_id")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(input?.limit ?? 50)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }

  return [...new Set((data ?? []).map((row) => String(row.organization_id)).filter(Boolean))]
}

export async function getLatestDraftBusinessProfile(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BusinessProfileRecord | null> {
  const { data, error } = await profilesTable(admin)
    .select(PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapRow(data as ProfileRow)
}

export async function getBusinessProfileById(
  admin: SupabaseClient,
  organizationId: string,
  profileId: string,
): Promise<BusinessProfileRecord | null> {
  const { data, error } = await profilesTable(admin)
    .select(PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", profileId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapRow(data as ProfileRow)
}

export async function insertBusinessProfileDraft(
  admin: SupabaseClient,
  input: {
    organizationId: string
    companyName: string
    website: string
    profile: BusinessProfileDraftContent
    draftInput: BusinessProfileInput
    createdBy: string | null
  },
): Promise<BusinessProfileRecord | null> {
  const { data, error } = await profilesTable(admin)
    .insert({
      organization_id: input.organizationId,
      status: "draft",
      company_name: input.companyName,
      website: input.website,
      profile_json: input.profile,
      draft_input_json: input.draftInput,
      created_by: input.createdBy,
    })
    .select(PROFILE_SELECT)
    .single()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return mapRow(data as ProfileRow)
}

export async function updateBusinessProfileRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    companyName?: string
    website?: string
    profile?: BusinessProfileDraftContent
  },
): Promise<BusinessProfileRecord | null> {
  const patch: Record<string, unknown> = {}
  if (input.companyName !== undefined) patch.company_name = input.companyName
  if (input.website !== undefined) patch.website = input.website
  if (input.profile !== undefined) patch.profile_json = input.profile

  const { data, error } = await profilesTable(admin)
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.profileId)
    .eq("status", "draft")
    .select(PROFILE_SELECT)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapRow(data as ProfileRow)
}

export async function rejectOtherApprovedBusinessProfiles(
  admin: SupabaseClient,
  organizationId: string,
  exceptProfileId: string,
): Promise<void> {
  const { error } = await profilesTable(admin)
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      approved_by: null,
      approved_at: null,
    })
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .neq("id", exceptProfileId)

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message)
  }
}

export async function approveBusinessProfileRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    approvedBy: string | null
  },
): Promise<BusinessProfileRecord | null> {
  const now = new Date().toISOString()
  const { data, error } = await profilesTable(admin)
    .update({
      status: "approved",
      approved_by: input.approvedBy,
      approved_at: now,
      rejected_at: null,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.profileId)
    .eq("status", "draft")
    .select(PROFILE_SELECT)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapRow(data as ProfileRow)
}

export async function rejectBusinessProfileRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
  },
): Promise<BusinessProfileRecord | null> {
  const now = new Date().toISOString()
  const { data, error } = await profilesTable(admin)
    .update({
      status: "rejected",
      rejected_at: now,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.profileId)
    .eq("status", "draft")
    .select(PROFILE_SELECT)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  if (!data) return null
  return mapRow(data as ProfileRow)
}

export { GROWTH_AIOS_BUSINESS_PROFILE_1A_QA_MARKER }
