import type { SupabaseClient } from "@supabase/supabase-js"
import { listTechniciansForOrg } from "@/lib/technicians/technician-table"
import {
  queryOrganizationMembersForRoster,
  queryProfilesForRoster,
} from "@/lib/technicians/roster-queries"

export type TechnicianAssignOption = {
  /** `technicians.id` — primary assignment key. */
  id: string
  label: string
  avatarUrl: string | null
  /** Job title when set, else "Technician". */
  roleLabel: string
  region: string
  /** Field availability / roster status (Available, …). */
  fieldStatus: string
  /** invited / active / suspended when linked to a member; else "Field resource". */
  membershipLabel: string
}

function formatMemberRole(role: string): string {
  if (!role) return "Member"
  return role.charAt(0).toUpperCase() + role.slice(1)
}

/**
 * Technicians eligible for assignment (operational `technicians` rows).
 * Optional profile avatar when linked to a login via organization_members.
 */
const ROSTER_MEMBER_ROLES = ["owner", "admin", "manager", "tech"] as const

/** Pre-technicians-table: assignment options keyed by auth user id (assigned_user_id only). */
async function loadTechnicianAssignOptionsLegacy(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianAssignOption[]> {
  const {
    data: members,
    error: memErr,
    rosterColumnsAvailable: omRoster,
  } = await queryOrganizationMembersForRoster(supabase, {
    organizationId,
    statusIn: ["active", "invited"],
    roleIn: ROSTER_MEMBER_ROLES,
  })

  if (memErr || !members?.length) return []

  type M = {
    user_id: string
    role: string
    status: string
    job_title?: string | null
    region?: string | null
    availability_status?: string | null
  }

  const memberList = members as M[]
  const userIds = [...new Set(memberList.map((m) => m.user_id))]
  const { data: profs, error: profErr } = await queryProfilesForRoster(supabase, userIds)
  if (profErr) return []

  const profileById = new Map(
    ((profs ?? []) as Array<{
      id: string
      full_name: string | null
      email: string | null
      avatar_url?: string | null
    }>).map((p) => [p.id, p]),
  )
  const memberByUser = new Map(memberList.map((m) => [m.user_id, m]))

  const out: TechnicianAssignOption[] = []
  for (const uid of userIds) {
    const p = profileById.get(uid)
    const m = memberByUser.get(uid)
    if (!p || !m) continue

    const label =
      (p.full_name && p.full_name.trim()) || (p.email && p.email.trim()) || "Team member"

    const roleLabel =
      omRoster && m.job_title?.trim()
        ? m.job_title.trim()
        : formatMemberRole(m.role)

    const region = omRoster && m.region?.trim() ? m.region.trim() : "—"

    const fieldStatus =
      omRoster && m.availability_status?.trim() ? m.availability_status.trim() : "—"

    const membershipLabel =
      m.status === "invited" ? "Invite pending" : m.status === "suspended" ? "Suspended" : "Active"

    out.push({
      id: uid,
      label,
      avatarUrl: p.avatar_url?.trim() || null,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel,
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

export async function loadTechnicianAssignOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<TechnicianAssignOption[]> {
  let rows: Awaited<ReturnType<typeof listTechniciansForOrg>>
  try {
    rows = await listTechniciansForOrg(supabase, organizationId)
  } catch {
    return loadTechnicianAssignOptionsLegacy(supabase, organizationId)
  }

  if (!rows.length) return loadTechnicianAssignOptionsLegacy(supabase, organizationId)

  const membershipIds = [...new Set(rows.map((r) => r.membership_id).filter(Boolean))] as string[]

  type OmRow = { membership_id: string; user_id: string; status: string; role: string }
  let omList: OmRow[] = []
  if (membershipIds.length) {
    const { data: oms } = await supabase
      .from("organization_members")
      .select("membership_id, user_id, status, role")
      .eq("organization_id", organizationId)
      .in("membership_id", membershipIds)
    omList = (oms ?? []) as OmRow[]
  }
  const omByMembership = new Map(omList.map((o) => [o.membership_id, o]))

  const userIds = [...new Set(omList.map((o) => o.user_id))]
  const profileById = new Map<
    string,
    { id: string; full_name: string | null; email: string | null; avatar_url: string | null }
  >()
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .in("id", userIds)
    for (const p of (profs ?? []) as Array<{
      id: string
      full_name: string | null
      email: string | null
      avatar_url: string | null
    }>) {
      profileById.set(p.id, p)
    }
  }

  const out: TechnicianAssignOption[] = []
  for (const t of rows) {
    const om = t.membership_id ? omByMembership.get(t.membership_id) : undefined
    const prof = om ? profileById.get(om.user_id) : undefined

    const label =
      (t.full_name && t.full_name.trim()) ||
      (t.email && t.email.trim()) ||
      (prof?.full_name && prof.full_name.trim()) ||
      (prof?.email && prof.email.trim()) ||
      "Technician"

    const roleLabel =
      (t.job_title && t.job_title.trim()) || (om ? formatMemberRole(om.role) : "Technician")

    const region = (t.region && t.region.trim()) || "—"
    const fieldStatus = (t.availability_status && t.availability_status.trim()) || "—"

    let membershipLabel = "Field resource"
    if (om) {
      membershipLabel =
        om.status === "invited" ? "Invite pending" : om.status === "suspended" ? "Suspended" : "Active"
    }

    const avatarUrl =
      (t.avatar_url && t.avatar_url.trim()) || prof?.avatar_url?.trim() || null

    out.push({
      id: t.id,
      label,
      avatarUrl,
      roleLabel,
      region,
      fieldStatus,
      membershipLabel,
    })
  }

  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}
