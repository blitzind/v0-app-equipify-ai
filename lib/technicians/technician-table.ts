import type { SupabaseClient } from "@supabase/supabase-js"

/** Row shape for `public.technicians` (operational profile). */
export type TechnicianTableRow = {
  id: string
  organization_id: string
  membership_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  job_title: string | null
  region: string | null
  skills: string[] | null
  availability_status: string | null
  start_date: string | null
  labor_rate_cents: number | null
  operational_status: string
  notes: string | null
  created_at: string
  updated_at: string
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Load technician by primary id, or resolve legacy deep-links that used `auth.users` id
 * (via linked organization_members.membership_id).
 */
export async function loadTechnicianRowForDrawer(
  supabase: SupabaseClient,
  organizationId: string,
  techIdOrLegacyUserId: string,
): Promise<{ row: TechnicianTableRow; linkedUserId: string | null } | null> {
  const direct = await supabase
    .from("technicians")
    .select(
      "id, organization_id, membership_id, full_name, email, phone, avatar_url, job_title, region, skills, availability_status, start_date, labor_rate_cents, operational_status, notes, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", techIdOrLegacyUserId)
    .maybeSingle()

  if (!direct.error && direct.data) {
    const row = direct.data as TechnicianTableRow
    const linked = await resolveLinkedUserId(supabase, organizationId, row.membership_id)
    return { row, linkedUserId: linked }
  }

  if (!isUuid(techIdOrLegacyUserId)) return null

  const viaMember = await supabase
    .from("organization_members")
    .select("membership_id")
    .eq("organization_id", organizationId)
    .eq("user_id", techIdOrLegacyUserId)
    .maybeSingle()

  const mid = (viaMember.data as { membership_id?: string } | null)?.membership_id
  if (!mid) return null

  const linked = await supabase
    .from("technicians")
    .select(
      "id, organization_id, membership_id, full_name, email, phone, avatar_url, job_title, region, skills, availability_status, start_date, labor_rate_cents, operational_status, notes, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("membership_id", mid)
    .maybeSingle()

  if (linked.error || !linked.data) return null
  return {
    row: linked.data as TechnicianTableRow,
    linkedUserId: techIdOrLegacyUserId,
  }
}

async function resolveLinkedUserId(
  supabase: SupabaseClient,
  organizationId: string,
  membershipId: string | null,
): Promise<string | null> {
  if (!membershipId) return null
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("membership_id", membershipId)
    .maybeSingle()
  return (data as { user_id?: string } | null)?.user_id ?? null
}

/** All technicians for roster / assignment pickers. */
export async function listTechniciansForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianTableRow[]> {
  const { data, error } = await supabase
    .from("technicians")
    .select(
      "id, organization_id, membership_id, full_name, email, phone, avatar_url, job_title, region, skills, availability_status, start_date, labor_rate_cents, operational_status, notes, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("operational_status", "active")
    .order("full_name", { ascending: true })

  if (error) {
    if (
      error.message?.includes("does not exist") ||
      error.message?.includes("schema cache")
    ) {
      return []
    }
    throw new Error(error.message)
  }
  return (data ?? []) as TechnicianTableRow[]
}
