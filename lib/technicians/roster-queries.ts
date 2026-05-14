import type { SupabaseClient } from "@supabase/supabase-js"

const ORG_MEMBERS_ROSTER_CORE =
  "user_id, role, status, job_title, region, skills, availability_status, start_date"

/** Same as {@link ORG_MEMBERS_ROSTER_CORE} but without `skills` (optional column drift). */
const ORG_MEMBERS_ROSTER_NO_SKILLS =
  "user_id, role, status, job_title, region, availability_status, start_date"

/** Full roster shape: roster columns + permission overlays + field-resource flag. */
export const ORG_MEMBERS_SELECT_FULL =
  `${ORG_MEMBERS_ROSTER_CORE}, permission_profile, permissions_json, is_field_resource`

/** Keeps `is_field_resource` when `skills` (or other roster columns) break the wider projection. */
export const ORG_MEMBERS_SELECT_NO_SKILLS_FULL =
  `${ORG_MEMBERS_ROSTER_NO_SKILLS}, permission_profile, permissions_json, is_field_resource`

/** When `is_field_resource` is not migrated yet. */
export const ORG_MEMBERS_SELECT_FULL_NO_FIELD_RESOURCE =
  `${ORG_MEMBERS_ROSTER_CORE}, permission_profile, permissions_json`

/** When `skills` fails but permissions + field flag exist. */
export const ORG_MEMBERS_SELECT_NO_SKILLS_NO_FIELD_RESOURCE =
  `${ORG_MEMBERS_ROSTER_NO_SKILLS}, permission_profile, permissions_json`

/** Fallback when `permission_profile` / `permissions_json` are not deployed yet. */
export const ORG_MEMBERS_SELECT_FULL_NO_PERMISSIONS =
  `${ORG_MEMBERS_ROSTER_CORE}, is_field_resource`

export const ORG_MEMBERS_SELECT_NO_SKILLS_NO_PERMISSIONS =
  `${ORG_MEMBERS_ROSTER_NO_SKILLS}, is_field_resource`

export const ORG_MEMBERS_SELECT_FULL_NO_PERMISSIONS_NO_FIELD =
  `${ORG_MEMBERS_ROSTER_CORE}`

export const ORG_MEMBERS_SELECT_MINIMAL = "user_id, role, status"

export const PROFILES_SELECT_FULL = "id, email, full_name, created_at, avatar_url, phone"

export const PROFILES_SELECT_MINIMAL = "id, email, full_name, created_at, avatar_url"

function isMissingColumnOrSchemaError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase()
  return (
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("could not find") ||
    (m.includes("schema cache") && m.includes("column"))
  )
}

export async function queryOrganizationMembersForRoster(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    statusIn: string[]
    roleIn: readonly string[]
  },
) {
  const base = (select: string) =>
    supabase
      .from("organization_members")
      .select(select)
      .eq("organization_id", params.organizationId)
      .in("status", params.statusIn)
      .in("role", [...params.roleIn])

  const ordered = [
    ORG_MEMBERS_SELECT_FULL,
    ORG_MEMBERS_SELECT_NO_SKILLS_FULL,
    ORG_MEMBERS_SELECT_FULL_NO_FIELD_RESOURCE,
    ORG_MEMBERS_SELECT_NO_SKILLS_NO_FIELD_RESOURCE,
    ORG_MEMBERS_SELECT_FULL_NO_PERMISSIONS,
    ORG_MEMBERS_SELECT_NO_SKILLS_NO_PERMISSIONS,
    ORG_MEMBERS_SELECT_FULL_NO_PERMISSIONS_NO_FIELD,
    ORG_MEMBERS_SELECT_MINIMAL,
  ] as const

  let last = await base(ordered[0])
  if (!last.error) {
    return { ...last, rosterColumnsAvailable: true as const }
  }

  // Try progressively narrower projections until one succeeds (schema drift, optional columns, etc.).
  for (let i = 1; i < ordered.length; i++) {
    last = await base(ordered[i])
    if (!last.error) {
      const rosterColumnsAvailable = ordered[i].includes("job_title")
      return { ...last, rosterColumnsAvailable }
    }
    if (!isMissingColumnOrSchemaError(last.error)) {
      continue
    }
  }

  return { ...last, rosterColumnsAvailable: false as const }
}

export async function queryProfilesForRoster(supabase: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) {
    return { data: [] as unknown[], error: null, rosterColumnsAvailable: true as const }
  }

  const first = await supabase.from("profiles").select(PROFILES_SELECT_FULL).in("id", userIds)
  if (first.error && isMissingColumnOrSchemaError(first.error)) {
    const fallback = await supabase.from("profiles").select(PROFILES_SELECT_MINIMAL).in("id", userIds)
    return { ...fallback, rosterColumnsAvailable: false as const }
  }
  return { ...first, rosterColumnsAvailable: true as const }
}

const PROFILE_DRAWER_FULL = "full_name, email, avatar_url, phone"
const PROFILE_DRAWER_MINIMAL = "full_name, email, avatar_url"

const ORG_MEMBER_DRAWER_FULL =
  "role, status, job_title, region, skills, availability_status, start_date"
const ORG_MEMBER_DRAWER_MINIMAL = "role, status"

/** Single-row profile load for technician drawer (phone optional column). */
export async function queryDrawerProfile(supabase: SupabaseClient, techId: string) {
  const full = await supabase.from("profiles").select(PROFILE_DRAWER_FULL).eq("id", techId).single()
  if (full.error && isMissingColumnOrSchemaError(full.error)) {
    return await supabase.from("profiles").select(PROFILE_DRAWER_MINIMAL).eq("id", techId).single()
  }
  return full
}

/** Single organization_members row for technician drawer (roster columns optional). */
export async function queryDrawerOrganizationMember(
  supabase: SupabaseClient,
  organizationId: string,
  techId: string,
) {
  const full = await supabase
    .from("organization_members")
    .select(ORG_MEMBER_DRAWER_FULL)
    .eq("organization_id", organizationId)
    .eq("user_id", techId)
    .maybeSingle()
  if (full.error && isMissingColumnOrSchemaError(full.error)) {
    return await supabase
      .from("organization_members")
      .select(ORG_MEMBER_DRAWER_MINIMAL)
      .eq("organization_id", organizationId)
      .eq("user_id", techId)
      .maybeSingle()
  }
  return full
}
